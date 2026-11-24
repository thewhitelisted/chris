import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fetchOwnerRepos, selectPortfolioProjects, repoToProject, validateRepo, GitHubDataError } from './github.js'

const fixture = (name) => JSON.parse(readFileSync(path.join(import.meta.dirname, 'fixtures', name), 'utf8'))
const recorded = fixture('users-repos-2026-11-24.json')
const recordedTagged = fixture('users-repos-2026-11-24-tagged.json')
const TOPIC = 'portfolio'

function tagged(names, extraTopics = {}) {
  return structuredClone(recorded).map((repo) =>
    names.includes(repo.name) ? { ...repo, topics: [...repo.topics, ...(extraTopics[repo.name] ?? []), TOPIC] } : repo,
  )
}

const byName = (repos, name) => repos.find((r) => r.name === name)

function jsonResponse(body, status = 200) {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('selectPortfolioProjects with the recorded response', () => {
  it('finds nothing in the response recorded before any repo was tagged', () => {
    expect(selectPortfolioProjects(recorded, TOPIC)).toEqual([])
  })

  it('maps crowdbook and Pathos from the response recorded after the owner tagged them', () => {
    const projects = selectPortfolioProjects(recordedTagged, TOPIC)
    expect(projects.map((p) => p.title)).toEqual(['crowdbook', 'Pathos'])
    const crowdbook = projects.find((p) => p.title === 'crowdbook')
    expect(crowdbook).toEqual({
      slug: 'crowdbook',
      title: 'crowdbook',
      date: '2026-10',
      description: byName(recorded, 'crowdbook').description,
      technologies: ['C++'],
      type: 'C++',
      github: 'https://github.com/thewhitelisted/crowdbook',
      color: crowdbook.color,
    })
    expect(crowdbook.description).toMatch(/^A deterministic, high-performance agent-based limit order book simulator/)
    expect(crowdbook).not.toHaveProperty('live')
    expect(projects.find((p) => p.title === 'Pathos')).toMatchObject({
      slug: 'pathos',
      type: 'Rust',
      date: '2026-10',
      technologies: ['Rust'],
      github: 'https://github.com/thewhitelisted/Pathos',
    })
    expect(projects.find((p) => p.title === 'Pathos').description).toMatch(/^A Rust-native, sentiment-driven portfolio optimizer/)
  })

  it('maps baskets too if it is ever tagged', () => {
    const [project] = selectPortfolioProjects(tagged(['baskets']), TOPIC)
    expect(project).toMatchObject({ title: 'baskets', type: 'TypeScript', date: '2026-11' })
  })

  it.each([
    ['description', 'bell\u0007'],
    ['name', 'x\u0000'],
  ])('fails on a tagged repo with a control character in %s', (field, value) => {
    const repos = tagged(['crowdbook'])
    byName(repos, 'crowdbook')[field] = value
    expect(() => selectPortfolioProjects(repos, TOPIC)).toThrow(/contains the control character U\+000[07]/)
  })

  it('builds technologies from language then topics, minus the portfolio topic, without case duplicates', () => {
    const [project] = selectPortfolioProjects(tagged(['Pathos'], { Pathos: ['finbert', 'rust', 'black-litterman'] }), TOPIC)
    expect(project.technologies).toEqual(['Rust', 'finbert', 'black-litterman'])
  })

  it('uses topics alone and "Repository" as the type when GitHub reports no language', () => {
    const [project] = selectPortfolioProjects(tagged(['thewhitelisted']), TOPIC)
    expect(project.technologies).toEqual(['config', 'github-config'])
    expect(project.type).toBe('Repository')
  })

  it('includes a tagged fork, and skips private repos even if tagged', () => {
    const repos = tagged(['catanatron', 'crowdbook'])
    byName(repos, 'crowdbook').private = true
    expect(selectPortfolioProjects(repos, TOPIC).map((p) => p.title)).toEqual(['catanatron'])
  })

  it('turns an https homepage into a live link', () => {
    const [project] = selectPortfolioProjects(tagged(['catanatron']), TOPIC)
    expect(project.live).toBe('https://docs.catanatron.com')
  })

  it('treats an empty-string homepage as no live link', () => {
    expect(byName(recorded, 'Pathos').homepage).toBe('')
    const [project] = selectPortfolioProjects(tagged(['Pathos']), TOPIC)
    expect(project).not.toHaveProperty('live')
  })

  it('fails on a tagged repo whose homepage is not https', () => {
    const repos = tagged(['chris'])
    byName(repos, 'chris').description = 'this site'
    expect(() => selectPortfolioProjects(repos, TOPIC)).toThrow('repo chris has homepage "http://www.christopherjlee.ca/"; use an https URL or clear it')
  })

  it.each(['cg-engine', 'crowdbook-arena'])('fails on tagged repo %s with no description', (name) => {
    expect(() => selectPortfolioProjects(tagged([name]), TOPIC)).toThrow(`repo ${name} is tagged "portfolio" but has no description`)
  })

  it('ignores an untagged repo with no description', () => {
    expect(() => selectPortfolioProjects(recorded, TOPIC)).not.toThrow()
  })

  it('gives each repo a stable colour', () => {
    const a = selectPortfolioProjects(tagged(['crowdbook', 'Pathos', 'baskets']), TOPIC)
    const b = selectPortfolioProjects(tagged(['crowdbook', 'Pathos', 'baskets']), TOPIC)
    expect(a.map((p) => p.color)).toEqual(b.map((p) => p.color))
    for (const p of a) expect(p.color).toMatch(/^#[0-9a-f]{6}$/)
  })
})

describe('validateRepo rejects malformed data', () => {
  const base = byName(recorded, 'crowdbook')
  it.each([
    ['name', undefined],
    ['name', ''],
    ['private', 'false'],
    ['html_url', 'http://github.com/x'],
    ['html_url', 'not a url'],
    ['description', 42],
    ['language', ['C++']],
    ['homepage', 1],
    ['topics', 'portfolio'],
    ['topics', [1]],
    ['topics', undefined],
    ['created_at', '2026-10-06'],
    ['pushed_at', null],
  ])('field %s = %j', (field, value) => {
    expect(() => validateRepo({ ...base, [field]: value })).toThrow(GitHubDataError)
    expect(() => validateRepo({ ...base, [field]: value })).toThrow(`field "${field}"`)
  })

  it.each([null, 'repo', [base]])('non-object %j', (value) => {
    expect(() => validateRepo(value)).toThrow(GitHubDataError)
  })

  it('rejects a non-array response', () => {
    expect(() => selectPortfolioProjects({ message: 'Not Found' }, TOPIC)).toThrow(/expected an array of repos/)
  })

  it('rejects a malformed untagged repo too', () => {
    const repos = structuredClone(recorded)
    byName(repos, 'leeto-security').topics = null
    expect(() => selectPortfolioProjects(repos, TOPIC)).toThrow(/repo leeto-security: field "topics"/)
  })

  it('maps a valid repo after validation', () => {
    expect(repoToProject(validateRepo({ ...base, topics: [TOPIC] }), TOPIC).slug).toBe('crowdbook')
  })
})

describe('fetchOwnerRepos', () => {
  function recordingFetch(responses) {
    const calls = []
    const fetchImpl = async (url, init) => {
      calls.push({ url, headers: init.headers })
      const next = responses.shift()
      if (next instanceof Error) throw next
      return next
    }
    return { calls, fetchImpl }
  }

  it('requests owner repos unauthenticated when no token is given', async () => {
    const { calls, fetchImpl } = recordingFetch([jsonResponse(recorded)])
    expect(await fetchOwnerRepos({ user: 'thewhitelisted', fetchImpl })).toEqual(recorded)
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe('https://api.github.com/users/thewhitelisted/repos?type=owner&per_page=100&page=1')
    expect(calls[0].headers).not.toHaveProperty('Authorization')
    expect(calls[0].headers['X-GitHub-Api-Version']).toBe('2022-11-28')
  })

  it('sends the token and honours a custom API URL', async () => {
    const { calls, fetchImpl } = recordingFetch([jsonResponse([])])
    await fetchOwnerRepos({ user: 'u', token: 'tkn', apiUrl: 'http://127.0.0.1:9', fetchImpl })
    expect(calls[0].url.startsWith('http://127.0.0.1:9/users/u/repos?')).toBe(true)
    expect(calls[0].headers.Authorization).toBe('Bearer tkn')
  })

  it('follows pages until one comes back short', async () => {
    const full = Array.from({ length: 100 }, (_, i) => ({ ...recorded[0], name: `r${i}` }))
    const { calls, fetchImpl } = recordingFetch([jsonResponse(full), jsonResponse(recorded.slice(0, 3))])
    expect(await fetchOwnerRepos({ user: 'u', fetchImpl })).toHaveLength(103)
    expect(calls.map((c) => new URL(c.url).searchParams.get('page'))).toEqual(['1', '2'])
  })

  it('fetches one more page when the last full page is exactly 100', async () => {
    const full = Array.from({ length: 100 }, (_, i) => ({ ...recorded[0], name: `r${i}` }))
    const { calls, fetchImpl } = recordingFetch([jsonResponse(full), jsonResponse([])])
    expect(await fetchOwnerRepos({ user: 'u', fetchImpl })).toHaveLength(100)
    expect(calls).toHaveLength(2)
  })

  it('aborts a request that outlives the timeout', async () => {
    let aborted = false
    const fetchImpl = (_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => {
        aborted = true
        reject(init.signal.reason)
      })
    })
    const started = Date.now()
    const error = await fetchOwnerRepos({ user: 'u', fetchImpl, timeoutMs: 50 }).catch((err) => err)
    expect(aborted).toBe(true)
    expect(Date.now() - started).toBeLessThan(2000)
    expect(error).toBeInstanceOf(GitHubDataError)
    expect(error.message).toMatch(/request to .* failed: .*(timed out|aborted)/i)
  })

  it('uses a 20 second timeout by default', async () => {
    let signal
    const fetchImpl = async (_url, init) => {
      signal = init.signal
      return jsonResponse([])
    }
    await fetchOwnerRepos({ user: 'u', fetchImpl })
    expect(signal).toBeInstanceOf(AbortSignal)
    expect(signal.aborted).toBe(false)
  })

  it('stops with an error instead of truncating after 10 full pages', async () => {
    const full = Array.from({ length: 100 }, (_, i) => ({ ...recorded[0], name: `r${i}` }))
    const { fetchImpl } = recordingFetch(Array.from({ length: 10 }, () => jsonResponse(full)))
    await expect(fetchOwnerRepos({ user: 'u', fetchImpl })).rejects.toThrow(/more than 1000 repos/)
  })

  it.each([
    ['HTTP 403 rate limit', jsonResponse({ message: 'API rate limit exceeded' }, 403), /returned HTTP 403: .*rate limit/],
    ['HTTP 500', jsonResponse('oops', 500), /returned HTTP 500: oops/],
    ['a non-JSON body', jsonResponse('<html>'), /did not return JSON/],
    ['an object instead of an array', jsonResponse({ message: 'Not Found' }), /instead of a repo array/],
    ['a network error', new TypeError('fetch failed'), /request to .* failed: fetch failed/],
  ])('fails loudly on %s', async (_name, response, message) => {
    const { fetchImpl } = recordingFetch([response])
    const error = await fetchOwnerRepos({ user: 'u', fetchImpl }).catch((err) => err)
    expect(error).toBeInstanceOf(GitHubDataError)
    expect(error.message).toMatch(message)
  })
})

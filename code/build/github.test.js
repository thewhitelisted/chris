import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fetchOwnerRepos, selectPortfolioProjects, repoToProject, validateRepo, GitHubDataError, IN_PROGRESS_TOPIC } from './github.js'

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
      updated: byName(recorded, 'crowdbook').pushed_at.slice(0, 10),
      description: byName(recorded, 'crowdbook').description,
      technologies: ['C++'],
      type: 'C++',
      status: 'complete',
      private: false,
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

  it('includes a tagged fork', () => {
    expect(selectPortfolioProjects(tagged(['catanatron']), TOPIC).map((p) => p.title)).toEqual(['catanatron'])
  })

  it('skips a private repo that is not tagged', () => {
    const repos = tagged(['crowdbook'])
    byName(repos, 'baskets').private = true
    expect(selectPortfolioProjects(repos, TOPIC).map((p) => p.title)).toEqual(['crowdbook'])
  })

  it('turns an https homepage into a live link', () => {
    const [project] = selectPortfolioProjects(tagged(['catanatron']), TOPIC)
    expect(project.live).toBe('https://docs.catanatron.com')
  })

  it('trims whitespace around the homepage before using it', () => {
    const repos = tagged(['crowdbook'])
    byName(repos, 'crowdbook').homepage = '  https://crowdbook.example/  '
    const [project] = selectPortfolioProjects(repos, TOPIC)
    expect(project.live).toBe('https://crowdbook.example/')
  })

  it('treats a whitespace-only homepage as none', () => {
    const repos = tagged(['crowdbook'])
    byName(repos, 'crowdbook').homepage = '   '
    expect(selectPortfolioProjects(repos, TOPIC)[0]).not.toHaveProperty('live')
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

describe('project status', () => {
  it('is complete for a tagged repo with no status topic', () => {
    expect(selectPortfolioProjects(tagged(['crowdbook']), TOPIC)[0].status).toBe('complete')
  })

  it('is in-progress when the repo has the in-progress topic, which is not listed as a technology', () => {
    const [project] = selectPortfolioProjects(tagged(['Pathos'], { Pathos: [IN_PROGRESS_TOPIC, 'finbert'] }), TOPIC)
    expect(IN_PROGRESS_TOPIC).toBe('in-progress')
    expect(project.status).toBe('in-progress')
    expect(project.technologies).toEqual(['Rust', 'finbert'])
  })

  it('is archived for an archived repo', () => {
    const repos = tagged(['crowdbook'])
    byName(repos, 'crowdbook').archived = true
    expect(selectPortfolioProjects(repos, TOPIC)[0].status).toBe('archived')
  })

  it('fails on an archived repo tagged in-progress', () => {
    const repos = tagged(['crowdbook'], { crowdbook: [IN_PROGRESS_TOPIC] })
    byName(repos, 'crowdbook').archived = true
    expect(() => selectPortfolioProjects(repos, TOPIC)).toThrow('repo crowdbook is archived but tagged "in-progress"; remove the topic or unarchive it')
  })

  it('takes the last-updated day from pushed_at', () => {
    const repos = tagged(['crowdbook'])
    byName(repos, 'crowdbook').pushed_at = '2026-11-20T23:59:59Z'
    expect(selectPortfolioProjects(repos, TOPIC)[0].updated).toBe('2026-11-20')
  })
})

describe('private repos', () => {
  const SECRET_FIELDS = {
    html_url: 'https://github.com/thewhitelisted/stealth-alpha',
    full_name: 'thewhitelisted/stealth-alpha-full',
    clone_url: 'https://github.com/thewhitelisted/stealth-alpha.git',
    ssh_url: 'git@github.com:thewhitelisted/stealth-alpha.git',
    default_branch: 'secret-branch-name',
    size: 987654,
    stargazers_count: 31337,
    owner: { login: 'thewhitelisted', id: 424242 },
  }
  const privateRepo = (overrides = {}) => ({
    ...byName(recorded, 'crowdbook'),
    ...SECRET_FIELDS,
    name: 'stealth-alpha',
    private: true,
    description: 'A private strategy',
    topics: [TOPIC],
    ...overrides,
  })

  it('lists a tagged private repo, marked private, with no code link', () => {
    const [project] = selectPortfolioProjects([privateRepo()], TOPIC)
    expect(project).toMatchObject({ title: 'stealth-alpha', private: true, status: 'complete', description: 'A private strategy' })
    expect(project).not.toHaveProperty('github')
  })

  it('keeps an https homepage as the live link', () => {
    const [project] = selectPortfolioProjects([privateRepo({ homepage: 'https://stealth.example' })], TOPIC)
    expect(project.live).toBe('https://stealth.example')
  })

  it('publishes only the listed fields, and none of the other repo data', () => {
    const [project] = selectPortfolioProjects([privateRepo({ topics: [TOPIC, IN_PROGRESS_TOPIC] })], TOPIC)
    expect(Object.keys(project).sort()).toEqual(['color', 'date', 'description', 'private', 'slug', 'status', 'technologies', 'title', 'type', 'updated'])
    const published = JSON.stringify(project)
    for (const value of ['github.com', 'stealth-alpha.git', 'stealth-alpha-full', 'secret-branch-name', '987654', '31337', '424242']) {
      expect(published).not.toContain(value)
    }
  })

  it('skips an untagged private repo without checking it, so its name never reaches an error or log', () => {
    const broken = privateRepo({ name: 'hidden-thing', topics: [], pushed_at: null, description: null })
    expect(selectPortfolioProjects([broken, privateRepo()], TOPIC).map((p) => p.title)).toEqual(['stealth-alpha'])
  })

  it('still checks a tagged private repo', () => {
    expect(() => selectPortfolioProjects([privateRepo({ pushed_at: null })], TOPIC)).toThrow('repo stealth-alpha: field "pushed_at"')
  })

  it('needs a description like any tagged repo', () => {
    expect(() => selectPortfolioProjects([privateRepo({ description: null })], TOPIC)).toThrow('repo stealth-alpha is tagged "portfolio" but has no description')
  })
})

describe('validateRepo rejects malformed data', () => {
  const base = byName(recorded, 'crowdbook')
  it.each([
    ['name', undefined],
    ['name', ''],
    ['private', 'false'],
    ['archived', undefined],
    ['archived', 'false'],
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

  it('lists private repos through /user/repos with the token', async () => {
    const { calls, fetchImpl } = recordingFetch([jsonResponse(recorded)])
    expect(await fetchOwnerRepos({ user: 'thewhitelisted', token: 'pat', includePrivate: true, fetchImpl })).toEqual(recorded)
    expect(calls[0].url).toBe('https://api.github.com/user/repos?affiliation=owner&visibility=all&per_page=100&page=1')
    expect(calls[0].headers.Authorization).toBe('Bearer pat')
  })

  it('pages through /user/repos too', async () => {
    const full = Array.from({ length: 100 }, (_, i) => ({ ...recorded[0], name: `r${i}` }))
    const { calls, fetchImpl } = recordingFetch([jsonResponse(full), jsonResponse([])])
    await fetchOwnerRepos({ user: 'thewhitelisted', token: 'pat', includePrivate: true, fetchImpl })
    expect(calls.map((c) => new URL(c.url).searchParams.get('page'))).toEqual(['1', '2'])
  })

  it('refuses to list private repos without a token', async () => {
    const { calls, fetchImpl } = recordingFetch([])
    await expect(fetchOwnerRepos({ user: 'u', includePrivate: true, fetchImpl })).rejects.toThrow('listing private repos needs a token')
    expect(calls).toHaveLength(0)
  })

  it('fails when the token lists repos of another account', async () => {
    const foreign = [{ ...recorded[0], html_url: 'https://github.com/someone-else/baskets' }]
    const { fetchImpl } = recordingFetch([jsonResponse(foreign)])
    await expect(fetchOwnerRepos({ user: 'thewhitelisted', token: 'pat', includePrivate: true, fetchImpl })).rejects.toThrow(
      'PORTFOLIO_REPOS_TOKEN listed a repo not owned by thewhitelisted; create the token on the thewhitelisted account',
    )
    const error = await fetchOwnerRepos({ user: 'thewhitelisted', token: 'pat', includePrivate: true, fetchImpl: recordingFetch([jsonResponse(foreign)]).fetchImpl }).catch((err) => err)
    expect(error.message).not.toContain('someone-else')
  })

  it('accepts an owner name that differs only in case', async () => {
    const repos = [{ ...recorded[0], html_url: 'https://github.com/TheWhitelisted/baskets' }]
    const { fetchImpl } = recordingFetch([jsonResponse(repos)])
    await expect(fetchOwnerRepos({ user: 'thewhitelisted', token: 'pat', includePrivate: true, fetchImpl })).resolves.toHaveLength(1)
  })

  it('names the secret when the private-repo token is rejected', async () => {
    const { fetchImpl } = recordingFetch([jsonResponse({ message: 'Bad credentials' }, 401)])
    const error = await fetchOwnerRepos({ user: 'u', token: 'old', includePrivate: true, fetchImpl }).catch((err) => err)
    expect(error).toBeInstanceOf(GitHubDataError)
    expect(error.message).toMatch(/returned HTTP 401 \(PORTFOLIO_REPOS_TOKEN is expired, revoked or wrong; replace the secret\): .*Bad credentials/)
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

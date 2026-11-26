import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import {
  fetchOwnerRepos,
  selectPortfolioProjects,
  repoToProject,
  validateRepo,
  GitHubDataError,
  IN_PROGRESS_TOPIC,
  languagePercents,
  commitActivity,
  fetchRepoStats,
  addRepoStats,
} from './github.js'

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

// Input space for repo stats:
// - languages: the recorded response, {}, one language, zero-byte languages, equal byte counts, many random maps;
//   malformed: null, array, string, negative / fractional / string / unsafe byte counts, blank or control-character names
// - commit activity: the recorded response; 51 or 53 weeks; a week not on Sunday 00:00 UTC; 6 days; days not adding
//   up to the total; negative counts; a gap between weeks; a week starting after the build time; a newest week that
//   GitHub starts at 23:00 UTC Saturday, built in that last hour of Saturday; data that ends weeks before the build
//   date (GitHub caches stats until the next push)
// - last30Days boundary, all in UTC: today, 29 days ago (in), 30 days ago (out), later today in this week (out of the
//   future), build time at 00:00:00.000 and 23:59:59.999, build day Sunday and Saturday; randomised against a
//   reference built from Date arithmetic
// - fetching: 200, 202 then 200, 202 every time (bounded attempts with doubling delay), 204, 401 with and without the
//   private token, 403, 404, 500 on either endpoint, a 202 from /languages, non-JSON, a network error
// - which projects get stats: in-progress, complete, archived
const recordedLanguages = fixture('repos-crowdbook-languages-2026-11-26.json')
const recordedActivity = fixture('repos-crowdbook-commit-activity-2026-11-26.json')
const DAY_MS = 86400000

function weeksEnding(lastSundayIso, countFor = () => 0) {
  const last = Date.parse(`${lastSundayIso}T00:00:00Z`)
  return Array.from({ length: 52 }, (_, i) => {
    const start = last - (51 - i) * 7 * DAY_MS
    const days = Array.from({ length: 7 }, (_, d) => countFor(new Date(start + d * DAY_MS).toISOString().slice(0, 10)))
    return { total: days.reduce((a, b) => a + b, 0), week: start / 1000, days }
  })
}

function referenceActivity(weeks, nowMs) {
  const todayIso = new Date(nowMs).toISOString().slice(0, 10)
  const today = Date.parse(todayIso)
  const recent = new Set(Array.from({ length: 30 }, (_, k) => new Date(today - k * DAY_MS).toISOString().slice(0, 10)))
  let last30Days = 0
  for (const w of weeks) {
    w.days.forEach((count, d) => {
      if (recent.has(new Date(w.week * 1000 + d * DAY_MS).toISOString().slice(0, 10))) last30Days += count
    })
  }
  const sunday = today - new Date(today).getUTCDay() * DAY_MS
  const weekly = Array.from({ length: 52 }, (_, i) => weeks.find((w) => w.week * 1000 === sunday - (51 - i) * 7 * DAY_MS)?.total ?? 0)
  return { weekly, last30Days }
}

function seeded(seed) {
  let state = seed
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648
    return state / 2147483648
  }
}

describe('languagePercents', () => {
  it('turns the recorded byte counts into percentages, largest first', () => {
    expect(languagePercents(recordedLanguages, 'crowdbook')).toEqual([
      { name: 'C++', percent: 68.2 },
      { name: 'Python', percent: 30.4 },
      { name: 'CMake', percent: 1.3 },
      { name: 'Dockerfile', percent: 0.1 },
    ])
  })

  it('returns no languages for an empty repo and drops zero-byte languages', () => {
    expect(languagePercents({}, 'r')).toEqual([])
    expect(languagePercents({ Rust: 0 }, 'r')).toEqual([])
    expect(languagePercents({ Rust: 10, Shell: 0 }, 'r')).toEqual([{ name: 'Rust', percent: 100 }])
  })

  it('breaks byte-count ties by name', () => {
    expect(languagePercents({ Zig: 1, C: 1, Go: 2 }, 'r').map((l) => l.name)).toEqual(['Go', 'C', 'Zig'])
  })

  it('sorts descending and sums to 100 within rounding for random inputs', () => {
    const random = seeded(7)
    for (let run = 0; run < 500; run++) {
      const n = 1 + Math.floor(random() * 12)
      const input = Object.fromEntries(Array.from({ length: n }, (_, i) => [`L${i}`, Math.floor(random() ** 4 * 5e6) + 1]))
      const out = languagePercents(input, 'r')
      const total = Object.values(input).reduce((a, b) => a + b, 0)
      expect(out).toHaveLength(n)
      for (let i = 1; i < out.length; i++) expect(input[out[i - 1].name]).toBeGreaterThanOrEqual(input[out[i].name])
      for (const { name, percent } of out) expect(Math.abs(percent - (input[name] / total) * 100)).toBeLessThanOrEqual(0.05 + 1e-9)
      expect(Math.abs(out.reduce((sum, l) => sum + l.percent, 0) - 100)).toBeLessThanOrEqual(0.05 * n + 1e-9)
    }
  })

  it.each([
    ['null', null, /languages should be an object/],
    ['an array', [], /languages should be an object/],
    ['a string', 'C++', /languages should be an object/],
    ['a negative count', { C: -1 }, /language C should have a byte count, got -1/],
    ['a fractional count', { C: 1.5 }, /language C should have a byte count/],
    ['a string count', { C: '10' }, /language C should have a byte count/],
    ['an unsafe count', { C: 2 ** 60 }, /language C should have a byte count/],
    ['a blank name', { ' ': 1 }, /invalid language name " "/],
    ['a control character', { 'C\u0007': 1 }, /invalid language name/],
  ])('fails on %s', (_name, input, message) => {
    expect(() => languagePercents(input, 'r')).toThrow(GitHubDataError)
    expect(() => languagePercents(input, 'r')).toThrow(message)
  })
})

describe('commitActivity', () => {
  const at = (iso) => Date.parse(iso)

  it('reads the recorded response: 52 weekly totals, oldest first, and the last 30 days', () => {
    const activity = commitActivity(recordedActivity, 'crowdbook', at('2026-11-26T12:00:00Z'))
    expect(activity.weekly).toEqual(recordedActivity.map((w) => w.total))
    expect(activity.weekly.at(-6)).toBe(122)
    expect(activity.last30Days).toBe(0)
  })

  describe('last30Days counts the 30 UTC days ending on the build day, inclusive', () => {
    const ones = weeksEnding('2026-11-22', () => 1)
    const only = (iso) => weeksEnding('2026-11-22', (day) => (day === iso ? 1 : 0))

    it.each([
      ['today', '2026-11-26', 1],
      ['29 days ago', '2026-10-28', 1],
      ['30 days ago', '2026-10-27', 0],
      ['tomorrow, later this week', '2026-11-27', 0],
    ])('a commit %s (%s) counts %i', (_label, iso, expected) => {
      expect(commitActivity(only(iso), 'r', at('2026-11-26T12:00:00Z')).last30Days).toBe(expected)
    })

    it.each([
      ['the first millisecond of the day', '2026-11-26T00:00:00.000Z'],
      ['the last millisecond of the day', '2026-11-26T23:59:59.999Z'],
    ])('uses the UTC calendar day at %s', (_label, iso) => {
      expect(commitActivity(only('2026-10-28'), 'r', at(iso)).last30Days).toBe(1)
      expect(commitActivity(only('2026-10-27'), 'r', at(iso)).last30Days).toBe(0)
      expect(commitActivity(ones, 'r', at(iso)).last30Days).toBe(30)
    })

    it('rolls over at midnight UTC', () => {
      expect(commitActivity(only('2026-10-28'), 'r', at('2026-11-27T00:00:00.000Z')).last30Days).toBe(0)
    })

    it('works when the build day is the Sunday that starts the newest week, or the Saturday that ends it', () => {
      expect(commitActivity(ones, 'r', at('2026-11-22T08:00:00Z'))).toEqual({ weekly: ones.map((w) => w.total), last30Days: 30 })
      expect(commitActivity(ones, 'r', at('2026-11-28T08:00:00Z'))).toEqual({ weekly: ones.map((w) => w.total), last30Days: 30 })
    })
  })

  it('shifts stale data so the newest week is the build week, filling weeks GitHub has not counted with 0', () => {
    const stale = weeksEnding('2026-11-08', () => 1)
    const activity = commitActivity(stale, 'r', at('2026-11-26T12:00:00Z'))
    expect(activity.weekly).toEqual([...Array(50).fill(7), 0, 0])
    expect(activity.last30Days).toBe(18)
  })

  it('maps week starts GitHub shifts by an hour or so to the nearest UTC Sunday', () => {
    const shifted = (hours) => weeksEnding('2026-11-22', (day) => (day === '2026-11-01' ? 2 : 0)).map((w) => ({ ...w, week: w.week + hours * 3600 }))
    for (const hours of [-11, -1, 1, 11]) {
      expect(commitActivity(shifted(hours), 'r', at('2026-11-26T12:00:00Z'))).toEqual({ weekly: [...Array(48).fill(0), 2, 0, 0, 0], last30Days: 2 })
    }
  })

  describe('a newest week that GitHub starts at 23:00 UTC on Saturday', () => {
    const early = () => weeksEnding('2026-11-29', (day) => (day === '2026-11-29' ? 4 : day === '2026-11-28' ? 1 : 0))
      .map((w) => ({ ...w, week: w.week - 3600 }))

    it('ends the weekly counts with that week when built in the last hour of Saturday', () => {
      const activity = commitActivity(early(), 'r', at('2026-11-28T23:30:00Z'))
      expect(activity.weekly.slice(-2)).toEqual([1, 4])
      expect(activity.last30Days).toBe(1)
    })

    it('accepts a newest week that starts exactly at the build time', () => {
      const weeks = weeksEnding('2026-11-22', (day) => (day === '2026-11-22' ? 2 : 0))
      expect(commitActivity(weeks, 'r', at('2026-11-22T00:00:00.000Z'))).toEqual({ weekly: [...Array(51).fill(0), 2], last30Days: 2 })
      expect(() => commitActivity(weeks, 'r', at('2026-11-21T23:59:59.999Z'))).toThrow(/has a week starting after the build time/)
    })

    it('still fails when built before that week starts', () => {
      expect(() => commitActivity(early(), 'r', at('2026-11-28T22:59:59.999Z'))).toThrow(/has a week starting after the build time/)
    })
  })

  it('returns all zeros when the data is more than a year old', () => {
    expect(commitActivity(weeksEnding('2024-01-07', () => 3), 'r', at('2026-11-26T12:00:00Z'))).toEqual({ weekly: Array(52).fill(0), last30Days: 0 })
  })

  it('matches a reference built from Date arithmetic on random data and build times', () => {
    const random = seeded(11)
    for (let run = 0; run < 300; run++) {
      const lag = Math.floor(random() * 60)
      const lastSunday = new Date(Date.parse('2026-11-22T00:00:00Z') - lag * 7 * DAY_MS).toISOString().slice(0, 10)
      const weeks = weeksEnding(lastSunday, () => (random() < 0.4 ? Math.floor(random() * 9) : 0))
      const nowMs = Date.parse('2026-11-22T00:00:00Z') + Math.floor(random() * 7 * DAY_MS)
      expect(commitActivity(weeks, 'r', nowMs)).toEqual(referenceActivity(weeks, nowMs))
    }
  })

  const good = () => weeksEnding('2026-11-22', () => 1)
  it.each([
    ['51 weeks', () => good().slice(1), /should be 52 weeks/],
    ['53 weeks', () => [...weeksEnding('2025-11-23').slice(0, 1), ...good()], /should be 52 weeks/],
    ['an object', () => ({}), /should be 52 weeks/],
    ['a Monday week start', () => good().map((w) => ({ ...w, week: w.week + 86400 })), /week 0 .* should start within 12 hours of a Sunday 00:00 UTC/],
    ['a week start at 13:00 on Sunday', () => good().map((w) => ({ ...w, week: w.week + 13 * 3600 })), /should start within 12 hours of a Sunday/],
    ['a week start at 11:00 on Saturday', () => good().map((w) => ({ ...w, week: w.week - 13 * 3600 })), /should start within 12 hours of a Sunday/],
    ['a string week', () => good().map((w, i) => (i === 3 ? { ...w, week: String(w.week) } : w)), /week 3 .* should start within 12 hours of a Sunday/],
    ['six days', () => good().map((w, i) => (i === 5 ? { ...w, days: w.days.slice(1), total: 6 } : w)), /week 5 .* should have a total and 7 daily counts/],
    ['a negative count', () => good().map((w, i) => (i === 5 ? { ...w, days: [-1, 1, 1, 1, 1, 1, 1], total: 5 } : w)), /should have a total and 7 daily counts/],
    ['days not adding up', () => good().map((w, i) => (i === 5 ? { ...w, total: 8 } : w)), /week 5 .* daily counts that do not add up/],
    ['a gap', () => good().map((w, i) => (i === 10 ? { ...w, week: w.week + 7 * 86400 } : w)), /week 10 .* does not follow the previous week|week 11/],
    ['a week after the build date', () => weeksEnding('2026-11-29'), /has a week starting after the build time 2026-11-26T12:00:00.000Z/],
  ])('fails on %s, naming the repo', (_name, make, message) => {
    const error = (() => {
      try {
        commitActivity(make(), 'crowdbook', at('2026-11-26T12:00:00Z'))
      } catch (err) {
        return err
      }
    })()
    expect(error).toBeInstanceOf(GitHubDataError)
    expect(error.message).toMatch(/^GitHub projects: repo crowdbook: commit activity /)
    expect(error.message).toMatch(message)
  })
})

describe('fetchRepoStats', () => {
  const NOW = Date.parse('2026-11-26T12:00:00Z')
  const statusResponse = (status) => new Response(status === 204 ? null : '{}', { status })

  function routedFetch({ languages = () => jsonResponse(recordedLanguages), activity }) {
    const calls = []
    const fetchImpl = async (url, init) => {
      calls.push({ url, headers: init.headers })
      if (url.endsWith('/languages')) return languages()
      if (url.endsWith('/stats/commit_activity')) return activity(calls.filter((c) => c.url.endsWith('/stats/commit_activity')).length)
      throw new Error(`unexpected request ${url}`)
    }
    return { calls, fetchImpl }
  }

  function run(fetchImpl, extra = {}) {
    const warnings = []
    const delays = []
    const promise = fetchRepoStats({
      user: 'thewhitelisted',
      repo: 'crowdbook',
      token: 'tkn',
      fetchImpl,
      nowMs: NOW,
      warn: (message) => warnings.push(message),
      sleep: async (ms) => { delays.push(ms) },
      ...extra,
    })
    return { promise, warnings, delays }
  }

  it('fetches languages and commit activity for the repo with the token', async () => {
    const { calls, fetchImpl } = routedFetch({ activity: () => jsonResponse(recordedActivity) })
    const { promise, warnings, delays } = run(fetchImpl)
    expect(await promise).toEqual({
      languages: languagePercents(recordedLanguages, 'crowdbook'),
      activity: commitActivity(recordedActivity, 'crowdbook', NOW),
    })
    expect(calls.map((c) => c.url)).toEqual([
      'https://api.github.com/repos/thewhitelisted/crowdbook/languages',
      'https://api.github.com/repos/thewhitelisted/crowdbook/stats/commit_activity',
    ])
    expect(calls.every((c) => c.headers.Authorization === 'Bearer tkn')).toBe(true)
    expect(warnings).toEqual([])
    expect(delays).toEqual([])
  })

  it('returns exactly languages and activity, nothing else from the responses', async () => {
    const { fetchImpl } = routedFetch({ activity: () => jsonResponse(recordedActivity) })
    const stats = await run(fetchImpl).promise
    expect(Object.keys(stats)).toEqual(['languages', 'activity'])
    expect(Object.keys(stats.activity)).toEqual(['weekly', 'last30Days'])
    expect(stats.languages.every((l) => Object.keys(l).join() === 'name,percent')).toBe(true)
  })

  it('retries while GitHub computes the stats (HTTP 202), doubling the delay', async () => {
    const { calls, fetchImpl } = routedFetch({ activity: (n) => (n < 3 ? statusResponse(202) : jsonResponse(recordedActivity)) })
    const { promise, warnings, delays } = run(fetchImpl)
    expect((await promise).activity).toEqual(commitActivity(recordedActivity, 'crowdbook', NOW))
    expect(calls.filter((c) => c.url.endsWith('commit_activity'))).toHaveLength(3)
    expect(delays).toEqual([1000, 2000])
    expect(warnings).toEqual([])
  })

  it('gives up after 5 attempts with activity null and a warning, not an error', async () => {
    const { calls, fetchImpl } = routedFetch({ activity: () => statusResponse(202) })
    const { promise, warnings, delays } = run(fetchImpl)
    expect(await promise).toEqual({ languages: languagePercents(recordedLanguages, 'crowdbook'), activity: null })
    expect(calls.filter((c) => c.url.endsWith('commit_activity'))).toHaveLength(5)
    expect(delays).toEqual([1000, 2000, 4000, 8000])
    expect(warnings).toEqual(['GitHub projects: GitHub was still computing commit activity for crowdbook after 5 attempts (HTTP 202); building without it'])
  })

  it('honours a custom attempt count and delay, and waits for real by default', async () => {
    const { calls, fetchImpl } = routedFetch({ activity: () => statusResponse(202) })
    const started = Date.now()
    const warnings = []
    const stats = await fetchRepoStats({
      user: 'u', repo: 'r', fetchImpl, nowMs: NOW, warn: (m) => warnings.push(m), activityAttempts: 3, retryDelayMs: 20,
    })
    expect(stats.activity).toBeNull()
    expect(calls.filter((c) => c.url.endsWith('commit_activity'))).toHaveLength(3)
    expect(Date.now() - started).toBeGreaterThanOrEqual(55)
    expect(warnings).toHaveLength(1)
  })

  it('sets activity null with a warning when GitHub has no activity (HTTP 204)', async () => {
    const { fetchImpl } = routedFetch({ activity: () => statusResponse(204) })
    const { promise, warnings, delays } = run(fetchImpl)
    expect((await promise).activity).toBeNull()
    expect(delays).toEqual([])
    expect(warnings).toEqual(['GitHub projects: repo crowdbook has no commit activity (HTTP 204); building without it'])
  })

  it('names the secret when the private-repo token is rejected', async () => {
    const { fetchImpl } = routedFetch({ languages: () => jsonResponse({ message: 'Bad credentials' }, 401), activity: () => statusResponse(202) })
    await expect(run(fetchImpl, { privateToken: true }).promise).rejects.toThrow(/languages returned HTTP 401 \(PORTFOLIO_REPOS_TOKEN is expired/)
    const { fetchImpl: plain } = routedFetch({ languages: () => jsonResponse({ message: 'Bad credentials' }, 401), activity: () => statusResponse(202) })
    const error = await run(plain).promise.catch((err) => err)
    expect(error.message).toMatch(/languages returned HTTP 401: .*Bad credentials/)
    expect(error.message).not.toContain('PORTFOLIO_REPOS_TOKEN')
  })

  it.each([
    ['languages', 403], ['languages', 404], ['languages', 500], ['languages', 202],
    ['commit_activity', 401], ['commit_activity', 403], ['commit_activity', 404], ['commit_activity', 500],
  ])('fails loudly when %s returns HTTP %i', async (endpoint, status) => {
    const failing = () => jsonResponse({ message: 'nope' }, status)
    const { fetchImpl } = routedFetch(endpoint === 'languages'
      ? { languages: failing, activity: () => jsonResponse(recordedActivity) }
      : { activity: failing })
    const { promise, warnings } = run(fetchImpl)
    const error = await promise.catch((err) => err)
    expect(error).toBeInstanceOf(GitHubDataError)
    expect(error.message).toMatch(new RegExp(`/${endpoint} returned HTTP ${status}`))
    expect(warnings).toEqual([])
  })

  it.each([
    ['a non-JSON activity body', { activity: () => jsonResponse('<html>') }, /commit_activity did not return JSON/],
    ['malformed activity', { activity: () => jsonResponse([]) }, /commit activity should be 52 weeks/],
    ['malformed languages', { languages: () => jsonResponse([]), activity: () => jsonResponse(recordedActivity) }, /languages should be an object/],
    ['a network error', { activity: () => { throw new TypeError('fetch failed') } }, /commit_activity failed: fetch failed/],
  ])('fails loudly on %s', async (_name, routes, message) => {
    const { fetchImpl } = routedFetch(routes)
    await expect(run(fetchImpl).promise).rejects.toThrow(message)
  })
})

describe('addRepoStats', () => {
  it('fetches stats for in-progress projects only, by repo name, and sets null for the rest', async () => {
    const asked = []
    const projects = [
      { title: 'Live', status: 'in-progress' },
      { title: 'Done', status: 'complete' },
      { title: 'Old', status: 'archived' },
    ]
    const result = await addRepoStats(projects, async (repo) => {
      asked.push(repo)
      return { languages: [], activity: null }
    })
    expect(asked).toEqual(['Live'])
    expect(result).toEqual([
      { title: 'Live', status: 'in-progress', stats: { languages: [], activity: null } },
      { title: 'Done', status: 'complete', stats: null },
      { title: 'Old', status: 'archived', stats: null },
    ])
  })

  it('fails when fetching stats fails', async () => {
    await expect(addRepoStats([{ title: 'Live', status: 'in-progress' }], async () => {
      throw new GitHubDataError('boom')
    })).rejects.toThrow('boom')
  })
})

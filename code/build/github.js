import { invalidXmlChar } from './text.js'

const PER_PAGE = 100
const MAX_PAGES = 10
const TIMESTAMP = /^((\d{4}-\d{2})-\d{2})T\d{2}:\d{2}:\d{2}Z$/
export const IN_PROGRESS_TOPIC = 'in-progress'
const PALETTE = ['#3b82f6', '#10b981', '#8b5cf6', '#ef4444', '#f59e0b', '#06b6d4', '#ec4899', '#84cc16']

export class GitHubDataError extends Error {
  constructor(message) {
    super(`GitHub projects: ${message}`)
    this.name = 'GitHubDataError'
  }
}

function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}

function expectType(repo, field, ok, description) {
  if (!ok(repo[field])) {
    const name = typeof repo.name === 'string' ? repo.name : JSON.stringify(repo.name)
    throw new GitHubDataError(`repo ${name}: field "${field}" should be ${description}, got ${JSON.stringify(repo[field])}`)
  }
}

const isString = (v) => typeof v === 'string'
const isStringOrNull = (v) => v === null || typeof v === 'string'

export function validateRepo(repo) {
  if (repo === null || typeof repo !== 'object' || Array.isArray(repo)) {
    throw new GitHubDataError(`expected a repo object, got ${JSON.stringify(repo)}`)
  }
  expectType(repo, 'name', (v) => isString(v) && v !== '', 'a non-empty string')
  expectType(repo, 'private', (v) => typeof v === 'boolean', 'a boolean')
  expectType(repo, 'archived', (v) => typeof v === 'boolean', 'a boolean')
  expectType(repo, 'html_url', isHttpsUrl, 'an https URL')
  expectType(repo, 'description', isStringOrNull, 'a string or null')
  expectType(repo, 'language', isStringOrNull, 'a string or null')
  expectType(repo, 'homepage', isStringOrNull, 'a string or null')
  expectType(repo, 'topics', (v) => Array.isArray(v) && v.every(isString), 'an array of strings')
  expectType(repo, 'created_at', (v) => isString(v) && TIMESTAMP.test(v), 'an ISO timestamp')
  expectType(repo, 'pushed_at', (v) => isString(v) && TIMESTAMP.test(v), 'an ISO timestamp')
  return repo
}

function colorFor(name) {
  let hash = 0
  for (const char of name) hash = (hash * 31 + char.codePointAt(0)) >>> 0
  return PALETTE[hash % PALETTE.length]
}

export function repoToProject(repo, topic) {
  const description = (repo.description ?? '').trim()
  if (description === '') {
    throw new GitHubDataError(`repo ${repo.name} is tagged "${topic}" but has no description; add one on GitHub`)
  }
  for (const text of [repo.name, description, repo.language ?? '', ...repo.topics]) {
    const bad = invalidXmlChar(text)
    if (bad) throw new GitHubDataError(`repo ${repo.name} contains the control character ${bad}`)
  }
  const homepage = (repo.homepage ?? '').trim()
  if (homepage !== '' && !isHttpsUrl(homepage)) {
    throw new GitHubDataError(`repo ${repo.name} has homepage ${JSON.stringify(homepage)}; use an https URL or clear it`)
  }
  const inProgress = repo.topics.includes(IN_PROGRESS_TOPIC)
  if (inProgress && repo.archived) {
    throw new GitHubDataError(`repo ${repo.name} is archived but tagged "${IN_PROGRESS_TOPIC}"; remove the topic or unarchive it`)
  }
  const technologies = []
  for (const tech of [repo.language, ...repo.topics.filter((t) => t !== topic && t !== IN_PROGRESS_TOPIC)]) {
    if (tech && !technologies.some((t) => t.toLowerCase() === tech.toLowerCase())) technologies.push(tech)
  }
  return {
    slug: repo.name.toLowerCase(),
    title: repo.name,
    date: TIMESTAMP.exec(repo.created_at)[2],
    updated: TIMESTAMP.exec(repo.pushed_at)[1],
    description,
    technologies,
    type: repo.language ?? 'Repository',
    status: repo.archived ? 'archived' : inProgress ? 'in-progress' : 'complete',
    private: repo.private,
    ...(repo.private ? {} : { github: repo.html_url }),
    ...(homepage === '' ? {} : { live: homepage }),
    color: colorFor(repo.name),
  }
}

function isUntaggedPrivate(repo, topic) {
  return repo?.private === true && !(Array.isArray(repo.topics) && repo.topics.includes(topic))
}

export function selectPortfolioProjects(repos, topic) {
  if (!Array.isArray(repos)) throw new GitHubDataError(`expected an array of repos, got ${JSON.stringify(repos)?.slice(0, 200)}`)
  return repos
    .filter((repo) => !isUntaggedPrivate(repo, topic))
    .map(validateRepo)
    .filter((repo) => repo.topics.includes(topic))
    .map((repo) => repoToProject(repo, topic))
}

function repoListUrl(apiUrl, user, includePrivate, page) {
  const paging = `per_page=${PER_PAGE}&page=${page}`
  return includePrivate
    ? `${apiUrl}/user/repos?affiliation=owner&visibility=all&${paging}`
    : `${apiUrl}/users/${encodeURIComponent(user)}/repos?type=owner&${paging}`
}

function checkOwnedBy(repos, user) {
  const prefix = `https://github.com/${user}/`.toLowerCase()
  for (const repo of repos) {
    if (typeof repo?.html_url !== 'string' || !repo.html_url.toLowerCase().startsWith(prefix)) {
      throw new GitHubDataError(`PORTFOLIO_REPOS_TOKEN listed a repo not owned by ${user}; create the token on the ${user} account`)
    }
  }
}

const REJECTED_PRIVATE_TOKEN = ' (PORTFOLIO_REPOS_TOKEN is expired, revoked or wrong; replace the secret)'

async function getJson(url, { token, fetchImpl, timeoutMs, privateToken, acceptStatuses = [200] }) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'portfolio-site-build',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
  let res
  try {
    res = await fetchImpl(url, { headers, signal: AbortSignal.timeout(timeoutMs) })
  } catch (err) {
    throw new GitHubDataError(`request to ${url} failed: ${err.message}`)
  }
  if (!acceptStatuses.includes(res.status)) {
    const body = await res.text()
    const hint = privateToken && res.status === 401 ? REJECTED_PRIVATE_TOKEN : ''
    throw new GitHubDataError(`${url} returned HTTP ${res.status}${hint}: ${body.slice(0, 300)}`)
  }
  if (res.status !== 200) {
    await res.body?.cancel()
    return { status: res.status, data: null }
  }
  try {
    return { status: 200, data: await res.json() }
  } catch (err) {
    throw new GitHubDataError(`${url} did not return JSON: ${err.message}`)
  }
}

export async function fetchOwnerRepos({
  user,
  token,
  includePrivate = false,
  apiUrl = 'https://api.github.com',
  fetchImpl = fetch,
  timeoutMs = 20000,
}) {
  if (includePrivate && !token) throw new GitHubDataError('listing private repos needs a token')
  const repos = []
  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = repoListUrl(apiUrl, user, includePrivate, page)
    const { data } = await getJson(url, { token, fetchImpl, timeoutMs, privateToken: includePrivate })
    if (!Array.isArray(data)) throw new GitHubDataError(`${url} returned ${JSON.stringify(data).slice(0, 200)} instead of a repo array`)
    if (includePrivate) checkOwnedBy(data, user)
    repos.push(...data)
    if (data.length < PER_PAGE) return repos
  }
  throw new GitHubDataError(`more than ${MAX_PAGES * PER_PAGE} repos; raise MAX_PAGES in build/github.js`)
}

const DAY_SECONDS = 86400
// 1970-01-01 was a Thursday: (day + EPOCH_WEEKDAY) % 7 is days since Sunday.
const EPOCH_WEEKDAY = 4
const WEEKS = 52
const RECENT_DAYS = 30
const isCount = (v) => Number.isSafeInteger(v) && v >= 0

export function languagePercents(languages, repo) {
  if (languages === null || typeof languages !== 'object' || Array.isArray(languages)) {
    throw new GitHubDataError(`repo ${repo}: languages should be an object of byte counts, got ${JSON.stringify(languages)?.slice(0, 200)}`)
  }
  const entries = Object.entries(languages)
  for (const [name, bytes] of entries) {
    if (name.trim() === '' || invalidXmlChar(name)) throw new GitHubDataError(`repo ${repo}: invalid language name ${JSON.stringify(name)}`)
    if (!isCount(bytes)) throw new GitHubDataError(`repo ${repo}: language ${name} should have a byte count, got ${JSON.stringify(bytes)}`)
  }
  const used = entries.filter(([, bytes]) => bytes > 0)
  const total = used.reduce((sum, [, bytes]) => sum + bytes, 0)
  return used
    .sort(([nameA, bytesA], [nameB, bytesB]) => bytesB - bytesA || (nameA < nameB ? -1 : nameA > nameB ? 1 : 0))
    .map(([name, bytes]) => ({ name, percent: Math.round((bytes / total) * 1000) / 10 }))
}

export function commitActivity(weeks, repo, nowMs) {
  const fail = (message) => {
    throw new GitHubDataError(`repo ${repo}: commit activity ${message}`)
  }
  if (!Array.isArray(weeks) || weeks.length !== WEEKS) {
    fail(`should be ${WEEKS} weeks, got ${JSON.stringify(weeks)?.slice(0, 200)}`)
  }
  const firstDay = (w) => Math.round(w.week / DAY_SECONDS)
  const isSunday = (day) => (day + EPOCH_WEEKDAY) % 7 === 0
  weeks.forEach((w, i) => {
    const label = `week ${i} (${JSON.stringify(w)?.slice(0, 200)})`
    if (w === null || typeof w !== 'object' || !Number.isSafeInteger(w.week) || !isSunday(firstDay(w))) {
      fail(`${label} should start within 12 hours of a Sunday 00:00 UTC`)
    }
    if (!isCount(w.total) || !Array.isArray(w.days) || w.days.length !== 7 || !w.days.every(isCount)) {
      fail(`${label} should have a total and 7 daily counts`)
    }
    if (w.days.reduce((sum, n) => sum + n, 0) !== w.total) fail(`${label} has daily counts that do not add up to its total`)
    if (i > 0 && firstDay(w) - firstDay(weeks[i - 1]) !== 7) fail(`${label} does not follow the previous week`)
  })

  const today = Math.floor(nowMs / 1000 / DAY_SECONDS)
  const thisWeekStart = today - ((today + EPOCH_WEEKDAY) % 7)
  if (firstDay(weeks.at(-1)) > thisWeekStart) fail(`has a week after the build date ${new Date(nowMs).toISOString()}`)

  const totals = new Map(weeks.map((w) => [firstDay(w), w.total]))
  const weekly = Array.from({ length: WEEKS }, (_, i) => totals.get(thisWeekStart - (WEEKS - 1 - i) * 7) ?? 0)
  let last30Days = 0
  for (const w of weeks) {
    w.days.forEach((count, d) => {
      const day = firstDay(w) + d
      if (day > today - RECENT_DAYS && day <= today) last30Days += count
    })
  }
  return { weekly, last30Days }
}

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export async function fetchRepoStats({
  user,
  repo,
  token,
  privateToken = false,
  warn,
  apiUrl = 'https://api.github.com',
  fetchImpl = fetch,
  timeoutMs = 20000,
  activityAttempts = 5,
  retryDelayMs = 1000,
  sleep = pause,
  nowMs = Date.now(),
}) {
  const base = `${apiUrl}/repos/${encodeURIComponent(user)}/${encodeURIComponent(repo)}`
  const request = { token, fetchImpl, timeoutMs, privateToken }
  const { data: languages } = await getJson(`${base}/languages`, request)
  const stats = { languages: languagePercents(languages, repo), activity: null }

  for (let attempt = 1; ; attempt++) {
    const { status, data } = await getJson(`${base}/stats/commit_activity`, { ...request, acceptStatuses: [200, 202, 204] })
    if (status === 200) return { ...stats, activity: commitActivity(data, repo, nowMs) }
    if (status === 204) {
      warn(`GitHub projects: repo ${repo} has no commit activity (HTTP 204); building without it`)
      return stats
    }
    if (attempt === activityAttempts) {
      warn(`GitHub projects: GitHub was still computing commit activity for ${repo} after ${activityAttempts} attempts (HTTP 202); building without it`)
      return stats
    }
    await sleep(retryDelayMs * 2 ** (attempt - 1))
  }
}

export function addRepoStats(projects, statsFor) {
  return Promise.all(projects.map(async (project) => ({
    ...project,
    stats: project.status === 'in-progress' ? await statsFor(project.title) : null,
  })))
}

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

export function selectPortfolioProjects(repos, topic) {
  if (!Array.isArray(repos)) throw new GitHubDataError(`expected an array of repos, got ${JSON.stringify(repos)?.slice(0, 200)}`)
  return repos
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
      throw new GitHubDataError(
        `PORTFOLIO_REPOS_TOKEN listed ${JSON.stringify(repo?.html_url)}, which is not owned by ${user}; ` +
          `create the token on the ${user} account`,
      )
    }
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
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'portfolio-site-build',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
  const repos = []
  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = repoListUrl(apiUrl, user, includePrivate, page)
    let res
    try {
      res = await fetchImpl(url, { headers, signal: AbortSignal.timeout(timeoutMs) })
    } catch (err) {
      throw new GitHubDataError(`request to ${url} failed: ${err.message}`)
    }
    if (!res.ok) {
      const body = await res.text()
      const hint = includePrivate && res.status === 401 ? ' (PORTFOLIO_REPOS_TOKEN is expired, revoked or wrong; replace the secret)' : ''
      throw new GitHubDataError(`${url} returned HTTP ${res.status}${hint}: ${body.slice(0, 300)}`)
    }
    let data
    try {
      data = await res.json()
    } catch (err) {
      throw new GitHubDataError(`${url} did not return JSON: ${err.message}`)
    }
    if (!Array.isArray(data)) throw new GitHubDataError(`${url} returned ${JSON.stringify(data).slice(0, 200)} instead of a repo array`)
    if (includePrivate) checkOwnedBy(data, user)
    repos.push(...data)
    if (data.length < PER_PAGE) return repos
  }
  throw new GitHubDataError(`more than ${MAX_PAGES * PER_PAGE} repos; raise MAX_PAGES in build/github.js`)
}

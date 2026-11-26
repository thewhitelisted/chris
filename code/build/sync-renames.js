// Renames devlogs/<old> to devlogs/<new> for each repo renamed on GitHub, recording the old name in devlogs/.renames.json.
// Usage: node build/sync-renames.js [devlogs folder]. Uses PORTFOLIO_REPOS_TOKEN, else GITHUB_TOKEN (CI passes only the first).
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchOwnerRepos, selectPortfolioProjects, fetchRepoSlug } from './github.js'
import { validateHandKept, mergeProjects, allowNoGitHubProjects } from './projects.js'
import { syncRenames } from './renames.js'
import { GITHUB_USER, PORTFOLIO_TOPIC } from './site.js'
import { handKeptProjects } from '../src/projectsData.js'

const codeDir = fileURLToPath(new URL('..', import.meta.url))
const devlogsDir = path.resolve(process.argv[2] ?? path.join(codeDir, '..', 'devlogs'))
const env = process.env
const privateToken = Boolean(env.PORTFOLIO_REPOS_TOKEN)
const token = env.PORTFOLIO_REPOS_TOKEN || env.GITHUB_TOKEN
const apiUrl = env.GITHUB_API_URL

const repos = await fetchOwnerRepos({ user: GITHUB_USER, token, includePrivate: privateToken, apiUrl })
const projects = mergeProjects(
  selectPortfolioProjects(repos, PORTFOLIO_TOPIC),
  validateHandKept(handKeptProjects, path.join(codeDir, 'public')),
  { allowNoGitHubProjects: allowNoGitHubProjects(env) },
)
const renamed = await syncRenames({
  devlogsDir,
  projectSlugs: projects.map((project) => project.slug),
  lookupSlug: (name) => fetchRepoSlug({ user: GITHUB_USER, name, token, privateToken, apiUrl }),
})
for (const { from, to } of renamed) console.log(`renamed devlogs/${from} to devlogs/${to}`)
if (renamed.length === 0) console.log('no devlogs folders belong to renamed repos')

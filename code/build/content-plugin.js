import { existsSync } from 'node:fs'
import path from 'node:path'
import { loadPosts } from './posts.js'
import { loadDevlogs, devlogIndex, skippedDevlogsWarning, ignoredDotFoldersWarning } from './devlogs.js'
import { fetchOwnerRepos, selectPortfolioProjects, addRepoStats, fetchRepoStats } from './github.js'
import { validateHandKept, mergeProjects, allowNoGitHubProjects } from './projects.js'
import { renderRss, headTags, withHead, pageFiles } from './feeds.js'
import { RENAMES_FILE, readRenames, checkRenames, redirectRoutes, redirectHtml } from './renames.js'
import { SITE_URL, GITHUB_USER, PORTFOLIO_TOPIC } from './site.js'
import { SITE_NAME, SITE_DESCRIPTION, sitePages } from '../src/site.js'
import { handKeptProjects } from '../src/projectsData.js'

const POSTS_ID = 'virtual:posts'
const PROJECTS_ID = 'virtual:projects'
const DEVLOGS_ID = 'virtual:devlogs'
const resolved = (id) => `\0${id}`
const POST_URL = /^\/posts\/([^?#]*)/
const DEVLOG_URL = /^\/devlogs\/([^?#]*)/

export async function loadContent({ root, postsDir, devlogsDir, env, warn }) {
  const posts = await loadPosts(postsDir)
  const privateToken = env.PORTFOLIO_REPOS_TOKEN
  const token = privateToken || env.GITHUB_TOKEN
  const repos = await fetchOwnerRepos({
    user: GITHUB_USER,
    token,
    includePrivate: Boolean(privateToken),
    apiUrl: env.GITHUB_API_URL,
  })
  const fromGitHub = await addRepoStats(selectPortfolioProjects(repos, PORTFOLIO_TOPIC), (repo) =>
    fetchRepoStats({ user: GITHUB_USER, repo, token, privateToken: Boolean(privateToken), apiUrl: env.GITHUB_API_URL, warn }),
  )
  const projects = mergeProjects(
    fromGitHub,
    validateHandKept(handKeptProjects, path.join(root, 'public')),
    { allowNoGitHubProjects: allowNoGitHubProjects(env) },
  )
  const skipUnknownDevlogs = !privateToken
  const devlogs = await loadProjectDevlogs({ devlogsDir, projects, skipUnknownDevlogs, warn })
  const renames = await loadRenames(devlogsDir, projects)
  return { posts, projects, devlogs, renames, skipUnknownDevlogs }
}

export async function loadRenames(devlogsDir, projects) {
  const file = path.join(devlogsDir, RENAMES_FILE)
  const renames = await readRenames(file)
  checkRenames(file, renames, projects.map((project) => project.slug))
  return renames
}

export async function loadProjectDevlogs({ devlogsDir, projects, skipUnknownDevlogs, warn }) {
  const { entries, skipped, ignoredDotFolders } = await loadDevlogs(devlogsDir, projects.map((project) => project.slug), {
    skipUnknownProjects: skipUnknownDevlogs,
  })
  if (ignoredDotFolders.length) warn(ignoredDotFoldersWarning(ignoredDotFolders))
  if (skipped.length) warn(skippedDevlogsWarning(skipped))
  return entries
}

export function postResponse(url, posts, postsError) {
  const match = POST_URL.exec(url)
  if (!match) return null
  if (postsError) return { status: 500, body: postsError.message }
  const post = posts.find((p) => `${p.slug}.md` === match[1])
  return post ? { status: 200, body: post.body } : { status: 404, body: 'not found' }
}

export function devlogResponse(url, devlogs, devlogsError) {
  const match = DEVLOG_URL.exec(url)
  if (!match) return null
  if (devlogsError) return { status: 500, body: devlogsError.message }
  const entry = devlogs.find((e) => `${e.project}/${e.date}.md` === match[1])
  return entry ? { status: 200, body: entry.body } : { status: 404, body: 'not found' }
}

export function watchDevlogs(watcher, devlogsDir, onDevlogsChanged) {
  const onEvent = (file) => {
    if (file === devlogsDir || file.startsWith(devlogsDir + path.sep)) onDevlogsChanged()
  }
  watcher.add(devlogsDir)
  for (const event of ['add', 'change', 'unlink', 'addDir', 'unlinkDir']) watcher.on(event, onEvent)
}

export function watchPosts(watcher, postsDir, onPostsChanged) {
  const onFileEvent = (file) => {
    if (path.dirname(file) === postsDir) onPostsChanged()
  }
  watcher.add(postsDir)
  watcher.on('add', onFileEvent)
  watcher.on('change', onFileEvent)
  watcher.on('unlink', onFileEvent)
  watcher.on('addDir', onFileEvent)
  watcher.on('unlinkDir', onFileEvent)
}

export function hotMessage(contentError) {
  return contentError ? { type: 'error', err: { message: contentError.message, stack: '' } } : { type: 'full-reload' }
}

export default function contentPlugin({ postsDir, devlogsDir }) {
  let root
  let content
  let postsError = null
  let devlogsError = null
  let markLoaded
  const loaded = new Promise((resolve) => {
    markLoaded = resolve
  })

  return {
    name: 'site-content',
    configResolved(config) {
      root = config.root
    },
    async buildStart() {
      content = await loadContent({ root, postsDir, devlogsDir, env: process.env, warn: (message) => this.warn(message) })
      markLoaded()
    },
    resolveId(id) {
      if (id === POSTS_ID || id === PROJECTS_ID || id === DEVLOGS_ID) return resolved(id)
    },
    load(id) {
      if (id === resolved(POSTS_ID)) {
        if (postsError) throw postsError
        const index = content.posts.map(({ slug, title, date, description }) => ({ slug, title, date, description }))
        return `export const blogPosts = ${JSON.stringify(index)}`
      }
      if (id === resolved(PROJECTS_ID)) return `export const projects = ${JSON.stringify(content.projects)}`
      if (id === resolved(DEVLOGS_ID)) {
        if (devlogsError) throw devlogsError
        return `export const devlogs = ${JSON.stringify(devlogIndex(content.devlogs))}`
      }
    },
    configureServer(server) {
      let reloading = loaded

      const reported = (err) => {
        server.config.logger.error(`[site-content] ${err.message}`, { timestamp: true })
        return err
      }
      const reloaded = (id) => {
        const graph = server.environments.client.moduleGraph
        const mod = graph.getModuleById(resolved(id))
        if (mod) graph.invalidateModule(mod)
        server.ws.send(hotMessage(postsError ?? devlogsError))
      }

      const reloadPosts = async () => {
        try {
          content.posts = await loadPosts(postsDir)
          postsError = null
        } catch (err) {
          postsError = reported(err)
        }
        reloaded(POSTS_ID)
      }

      const reloadDevlogs = async () => {
        try {
          content.devlogs = await loadProjectDevlogs({
            devlogsDir,
            projects: content.projects,
            skipUnknownDevlogs: content.skipUnknownDevlogs,
            warn: (message) => server.config.logger.warn(`[site-content] ${message}`, { timestamp: true }),
          })
          content.renames = await loadRenames(devlogsDir, content.projects)
          devlogsError = null
        } catch (err) {
          devlogsError = reported(err)
        }
        reloaded(DEVLOGS_ID)
      }

      watchPosts(server.watcher, postsDir, () => {
        reloading = reloading.then(reloadPosts)
      })
      watchDevlogs(server.watcher, devlogsDir, () => {
        reloading = reloading.then(reloadDevlogs)
      })

      server.middlewares.use((req, res, next) => {
        const response = postResponse(req.url, content.posts, postsError) ?? devlogResponse(req.url, content.devlogs, devlogsError)
        if (!response) return next()
        res.statusCode = response.status
        res.setHeader('Content-Type', `${response.status === 200 ? 'text/markdown' : 'text/plain'}; charset=utf-8`)
        res.end(response.body)
      })
    },
    generateBundle: {
      order: 'post',
      handler(_options, bundle) {
        const emitted = new Set()
        const emit = (fileName, source) => {
          if (emitted.has(fileName) || fileName in bundle || existsSync(path.join(root, 'public', fileName))) {
            throw new Error(`site-content: two outputs would be written to ${fileName}`)
          }
          emitted.add(fileName)
          this.emitFile({ type: 'asset', fileName, source })
        }

        for (const post of content.posts) emit(`posts/${post.slug}.md`, post.body)
        for (const entry of content.devlogs) emit(`devlogs/${entry.project}/${entry.date}.md`, entry.body)
        emit('rss.xml', renderRss({
          siteUrl: SITE_URL,
          title: SITE_NAME,
          description: SITE_DESCRIPTION,
          posts: content.posts,
          devlogs: content.devlogs,
          projects: content.projects,
        }))

        const template = bundle['index.html']
        if (!template || template.type !== 'asset') throw new Error('site-content: index.html missing from the bundle')
        const html = String(template.source)
        for (const page of sitePages({ posts: content.posts, projects: content.projects, devlogs: content.devlogs })) {
          const pageHtml = withHead(html, headTags({ siteUrl: SITE_URL, siteName: SITE_NAME, ...page }))
          for (const fileName of pageFiles(page.path)) {
            if (fileName === 'index.html') template.source = pageHtml
            else emit(fileName, pageHtml)
          }
        }
        for (const { from, to } of redirectRoutes(content.renames, content.devlogs)) {
          for (const fileName of pageFiles(from)) emit(fileName, redirectHtml(SITE_URL, to))
        }
      },
    },
  }
}

import { existsSync } from 'node:fs'
import path from 'node:path'
import { loadPosts } from './posts.js'
import { fetchOwnerRepos, selectPortfolioProjects } from './github.js'
import { validateHandKept, mergeProjects, allowNoGitHubProjects } from './projects.js'
import { renderRss, headTags, withHead, pageFiles } from './feeds.js'
import { SITE_URL, GITHUB_USER, PORTFOLIO_TOPIC } from './site.js'
import { SITE_NAME, SITE_DESCRIPTION, sitePages } from '../src/site.js'
import { handKeptProjects } from '../src/projectsData.js'

const POSTS_ID = 'virtual:posts'
const PROJECTS_ID = 'virtual:projects'
const resolved = (id) => `\0${id}`
const POST_URL = /^\/posts\/([^?#]*)/

export async function loadContent({ root, postsDir, env }) {
  const posts = await loadPosts(postsDir)
  const repos = await fetchOwnerRepos({ user: GITHUB_USER, token: env.GITHUB_TOKEN, apiUrl: env.GITHUB_API_URL })
  const projects = mergeProjects(
    selectPortfolioProjects(repos, PORTFOLIO_TOPIC),
    validateHandKept(handKeptProjects, path.join(root, 'public')),
    { allowNoGitHubProjects: allowNoGitHubProjects(env) },
  )
  return { posts, projects }
}

export function postResponse(url, posts, postsError) {
  const match = POST_URL.exec(url)
  if (!match) return null
  if (postsError) return { status: 500, body: postsError.message }
  const post = posts.find((p) => `${p.slug}.md` === match[1])
  return post ? { status: 200, body: post.body } : { status: 404, body: 'not found' }
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

export function hotMessage(postsError) {
  return postsError ? { type: 'error', err: { message: postsError.message, stack: '' } } : { type: 'full-reload' }
}

export default function contentPlugin({ postsDir }) {
  let root
  let content
  let postsError = null
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
      content = await loadContent({ root, postsDir, env: process.env })
      markLoaded()
    },
    resolveId(id) {
      if (id === POSTS_ID || id === PROJECTS_ID) return resolved(id)
    },
    load(id) {
      if (id === resolved(POSTS_ID)) {
        if (postsError) throw postsError
        const index = content.posts.map(({ slug, title, date, description }) => ({ slug, title, date, description }))
        return `export const blogPosts = ${JSON.stringify(index)}`
      }
      if (id === resolved(PROJECTS_ID)) return `export const projects = ${JSON.stringify(content.projects)}`
    },
    configureServer(server) {
      let reloading = loaded

      const reloadPosts = async () => {
        try {
          content.posts = await loadPosts(postsDir)
          postsError = null
        } catch (err) {
          postsError = err
          server.config.logger.error(`[site-content] ${err.message}`, { timestamp: true })
        }
        const graph = server.environments.client.moduleGraph
        const mod = graph.getModuleById(resolved(POSTS_ID))
        if (mod) graph.invalidateModule(mod)
        server.ws.send(hotMessage(postsError))
      }

      watchPosts(server.watcher, postsDir, () => {
        reloading = reloading.then(reloadPosts)
      })

      server.middlewares.use((req, res, next) => {
        const response = postResponse(req.url, content.posts, postsError)
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
        emit('rss.xml', renderRss({ siteUrl: SITE_URL, title: SITE_NAME, description: SITE_DESCRIPTION, posts: content.posts }))

        const template = bundle['index.html']
        if (!template || template.type !== 'asset') throw new Error('site-content: index.html missing from the bundle')
        const html = String(template.source)
        for (const page of sitePages(content.posts)) {
          const pageHtml = withHead(html, headTags({ siteUrl: SITE_URL, siteName: SITE_NAME, ...page }))
          for (const fileName of pageFiles(page.path)) {
            if (fileName === 'index.html') template.source = pageHtml
            else emit(fileName, pageHtml)
          }
        }
      },
    },
  }
}

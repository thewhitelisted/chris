import path from 'node:path'
import { loadPosts } from './posts.js'
import { fetchOwnerRepos, selectPortfolioProjects } from './github.js'
import { validateHandKept, mergeProjects } from './projects.js'
import { renderRss, headTags, withHead, pageFiles } from './feeds.js'
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION, GITHUB_USER, PORTFOLIO_TOPIC, STATIC_PAGES } from './site.js'
import { handKeptProjects } from '../src/projectsData.js'

const POSTS_ID = 'virtual:posts'
const PROJECTS_ID = 'virtual:projects'
const resolved = (id) => `\0${id}`

export async function loadContent({ root, env }) {
  const posts = await loadPosts(path.join(root, 'posts'))
  const repos = await fetchOwnerRepos({ user: GITHUB_USER, token: env.GITHUB_TOKEN, apiUrl: env.GITHUB_API_URL })
  const projects = mergeProjects(
    selectPortfolioProjects(repos, PORTFOLIO_TOPIC),
    validateHandKept(handKeptProjects, path.join(root, 'public')),
    { allowNoGitHubProjects: env.ALLOW_NO_GITHUB_PROJECTS === '1' },
  )
  return { posts, projects }
}

export function sitePages(posts) {
  return [
    ...STATIC_PAGES,
    ...posts.map((post) => ({
      path: `/blog/${post.slug}`,
      title: post.title,
      description: post.description,
      type: 'article',
      published: post.date,
    })),
  ]
}

export default function contentPlugin() {
  let root
  let content

  return {
    name: 'site-content',
    configResolved(config) {
      root = config.root
    },
    async buildStart() {
      content = await loadContent({ root, env: process.env })
      for (const post of content.posts) this.addWatchFile(post.file)
    },
    resolveId(id) {
      if (id === POSTS_ID || id === PROJECTS_ID) return resolved(id)
    },
    load(id) {
      if (id === resolved(POSTS_ID)) {
        const index = content.posts.map(({ slug, title, date, description }) => ({ slug, title, date, description }))
        return `export const blogPosts = ${JSON.stringify(index)}`
      }
      if (id === resolved(PROJECTS_ID)) return `export const projects = ${JSON.stringify(content.projects)}`
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const match = /^\/posts\/([^/?#]+)\.md(?:[?#]|$)/.exec(req.url)
        const post = match && content?.posts.find((p) => p.slug === match[1])
        if (!post) return next()
        res.setHeader('Content-Type', 'text/markdown; charset=utf-8')
        res.end(post.body)
      })
    },
    generateBundle: {
      order: 'post',
      handler(_options, bundle) {
        for (const post of content.posts) {
          this.emitFile({ type: 'asset', fileName: `posts/${post.slug}.md`, source: post.body })
        }
        this.emitFile({
          type: 'asset',
          fileName: 'rss.xml',
          source: renderRss({ siteUrl: SITE_URL, title: SITE_NAME, description: SITE_DESCRIPTION, posts: content.posts }),
        })

        const template = bundle['index.html']
        if (!template || template.type !== 'asset') throw new Error('site-content: index.html missing from the bundle')
        const html = String(template.source)
        for (const page of sitePages(content.posts)) {
          const pageHtml = withHead(html, headTags({ siteUrl: SITE_URL, siteName: SITE_NAME, ...page }))
          for (const fileName of pageFiles(page.path)) {
            if (fileName === 'index.html') template.source = pageHtml
            else this.emitFile({ type: 'asset', fileName, source: pageHtml })
          }
        }
      },
    },
  }
}

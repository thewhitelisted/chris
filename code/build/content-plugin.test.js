import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createServer } from 'node:http'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, readdir } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { XMLParser, XMLValidator } from 'fast-xml-parser'

const root = path.join(import.meta.dirname, '..')
const vite = path.join(root, 'node_modules/vite/bin/vite.js')
const recorded = JSON.parse(readFileSync(path.join(import.meta.dirname, 'fixtures/users-repos-2026-11-24.json'), 'utf8'))
const FEATURED = ['crowdbook', 'Pathos', 'baskets']

let server
let apiUrl
let respond

beforeAll(async () => {
  server = createServer((req, res) => respond(req, res))
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  apiUrl = `http://127.0.0.1:${server.address().port}`
})

afterAll(() => new Promise((resolve) => server.close(resolve)))

function serveJson(body, status = 200) {
  respond = (_req, res) => {
    res.writeHead(status, { 'content-type': 'application/json' })
    res.end(JSON.stringify(body))
  }
}

async function build(env = {}) {
  const outDir = await mkdtemp(path.join(tmpdir(), 'site-build-'))
  const result = await new Promise((resolve) => {
    execFile(
      process.execPath,
      [vite, 'build', '--outDir', outDir, '--emptyOutDir', '--logLevel', 'error'],
      { cwd: root, env: { PATH: process.env.PATH, GITHUB_API_URL: apiUrl, ...env } },
      (error, stdout, stderr) => resolve({ code: error ? error.code : 0, output: stdout + stderr }),
    )
  })
  return { ...result, outDir, read: (file) => readFile(path.join(outDir, file), 'utf8') }
}

const head = (html) => new DOMParser().parseFromString(html.replace(/<link rel="stylesheet"[^>]*>/g, ''), 'text/html')
const meta = (doc, attr, key) => doc.head.querySelector(`meta[${attr}="${key}"]`)?.getAttribute('content')

describe('vite build with the content plugin', () => {
  let site

  beforeAll(async () => {
    serveJson(recorded.map((r) => (FEATURED.includes(r.name) ? { ...r, topics: ['portfolio'] } : r)))
    site = await build()
  }, 60000)

  it('succeeds', () => {
    expect(site.output).toBe('')
    expect(site.code).toBe(0)
  })

  it('writes each post body without frontmatter', async () => {
    const adhd = await site.read('posts/handling-adhd.md')
    expect(adhd.startsWith('# handling adhd as a second year double degree student\n')).toBe(true)
    expect(adhd).not.toContain('description: handing adhd')
    const work = await site.read('posts/first-work-experience.md')
    expect(work.startsWith('# my first work experience in finance\n')).toBe(true)
    expect(work).not.toContain('date: 2026-04-25')
  })

  it('writes a valid RSS feed with both posts, newest first', async () => {
    const xml = await site.read('rss.xml')
    expect(XMLValidator.validate(xml)).toBe(true)
    const items = new XMLParser().parse(xml).rss.channel.item
    expect(items).toMatchObject([
      {
        title: 'my first work experience in finance',
        link: 'https://www.christopherjlee.ca/blog/first-work-experience',
        pubDate: 'Sat, 25 Apr 2026 00:00:00 +0000',
        description: "I had the opportunity to work at one of Canada's biggest pension funds this winter, here's what I learnt",
      },
      {
        title: 'how i deal with having adhd',
        link: 'https://www.christopherjlee.ca/blog/handling-adhd',
        pubDate: 'Wed, 18 Jun 2025 00:00:00 +0000',
      },
    ])
  })

  it('writes a static page with the right meta for every route, in both file layouts', async () => {
    const expected = {
      'index.html': ['Christopher Lee', 'https://www.christopherjlee.ca/'],
      'about.html': ['About · Christopher Lee', 'https://www.christopherjlee.ca/about'],
      'about/index.html': ['About · Christopher Lee', 'https://www.christopherjlee.ca/about'],
      'music/index.html': ['Music · Christopher Lee', 'https://www.christopherjlee.ca/music'],
      'hobbies/index.html': ['Interests · Christopher Lee', 'https://www.christopherjlee.ca/hobbies'],
      'projects.html': ['Projects · Christopher Lee', 'https://www.christopherjlee.ca/projects'],
      'projects/index.html': ['Projects · Christopher Lee', 'https://www.christopherjlee.ca/projects'],
      'blog.html': ['Blog · Christopher Lee', 'https://www.christopherjlee.ca/blog'],
      'blog/index.html': ['Blog · Christopher Lee', 'https://www.christopherjlee.ca/blog'],
      'blog/handling-adhd.html': ['how i deal with having adhd', 'https://www.christopherjlee.ca/blog/handling-adhd'],
      'blog/handling-adhd/index.html': ['how i deal with having adhd', 'https://www.christopherjlee.ca/blog/handling-adhd'],
      'blog/first-work-experience.html': ['my first work experience in finance', 'https://www.christopherjlee.ca/blog/first-work-experience'],
      'blog/first-work-experience/index.html': ['my first work experience in finance', 'https://www.christopherjlee.ca/blog/first-work-experience'],
    }
    for (const [file, [title, url]] of Object.entries(expected)) {
      const doc = head(await site.read(file))
      expect(doc.title, file).toBe(title)
      expect(meta(doc, 'property', 'og:title'), file).toBe(title)
      expect(meta(doc, 'property', 'og:url'), file).toBe(url)
      expect(doc.head.querySelector('link[rel="alternate"]')?.getAttribute('href'), file).toBe('/rss.xml')
      expect(doc.querySelector('script[type="module"]')?.getAttribute('src'), file).toMatch(/^\/assets\/index-.*\.js$/)
    }
    const post = head(await site.read('blog/handling-adhd/index.html'))
    expect(meta(post, 'name', 'description')).toBe('handing adhd as a double degree student pursing finance')
    expect(meta(post, 'property', 'og:type')).toBe('article')
    const work = head(await site.read('blog/first-work-experience/index.html'))
    expect(meta(work, 'property', 'og:description')).toBe("I had the opportunity to work at one of Canada's biggest pension funds this winter, here's what I learnt")
    expect(meta(work, 'property', 'article:published_time')).toBe('2026-04-25')
  })

  it('keeps 404.html as the SPA redirect', async () => {
    expect(await site.read('404.html')).toContain("'/?/'")
  })

  it('bundles the GitHub projects ahead of the hand-kept ones, without dead links', async () => {
    const assets = await readdir(path.join(site.outDir, 'assets'))
    const js = (await Promise.all(assets.filter((f) => f.endsWith('.js')).map((f) => site.read(`assets/${f}`)))).join('\n')
    for (const name of FEATURED) expect(js).toContain(`https://github.com/thewhitelisted/${name}`)
    for (const dead of ['Agent-Based-Market-Simulator', 'Sentivest', '/hit', 'weather-model', 'cutie-bot']) {
      expect(js).not.toContain(`github.com/thewhitelisted${dead.startsWith('/') ? dead : `/${dead}`}`)
    }
    expect(js).toContain('/FIV.pdf')
  })
})

describe('vite build failure paths', () => {
  it('fails when the GitHub API errors', async () => {
    serveJson({ message: 'API rate limit exceeded' }, 403)
    const { code, output } = await build()
    expect(code).not.toBe(0)
    expect(output).toMatch(/GitHub projects: .* returned HTTP 403: .*rate limit/)
  }, 60000)

  it('fails when the GitHub API returns malformed data', async () => {
    serveJson([{ ...recorded[0], topics: 'portfolio' }])
    const { code, output } = await build()
    expect(code).not.toBe(0)
    expect(output).toMatch(/field "topics" should be an array of strings/)
  }, 60000)

  it('fails when no repo is tagged, and builds hand-kept projects only when that is explicitly allowed', async () => {
    serveJson(recorded)
    const refused = await build()
    expect(refused.code).not.toBe(0)
    expect(refused.output).toMatch(/no public GitHub repo has the portfolio topic/)

    const allowed = await build({ ALLOW_NO_GITHUB_PROJECTS: '1' })
    expect(allowed.code).toBe(0)
    expect(await allowed.read('projects/index.html')).toContain('Projects · Christopher Lee')
  }, 60000)
})

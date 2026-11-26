import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createServer, get as httpGet } from 'node:http'
import { execFile, spawn } from 'node:child_process'
import { mkdtemp, mkdir, readFile, readdir, realpath, rename, rm, writeFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { EventEmitter } from 'node:events'
import { XMLParser, XMLValidator } from 'fast-xml-parser'
import { watchPosts, postResponse, hotMessage, watchDevlogs, devlogResponse } from './content-plugin.js'

const root = path.join(import.meta.dirname, '..')
const vite = path.join(root, 'node_modules/vite/bin/vite.js')
const config = path.join(root, 'vite.config.js')
const pluginModule = path.join(import.meta.dirname, 'content-plugin.js')
const fixture = (name) => JSON.parse(readFileSync(path.join(import.meta.dirname, 'fixtures', name), 'utf8'))
const recorded = fixture('users-repos-2026-11-24.json')
const recordedTagged = fixture('users-repos-2026-11-24-tagged.json')
const recordedLanguages = fixture('repos-crowdbook-languages-2026-11-26.json')
const recordedActivity = fixture('repos-crowdbook-commit-activity-2026-11-26.json')
const pathosInProgress = recordedTagged.map((r) => (r.name === 'Pathos' ? { ...r, topics: [...r.topics, 'in-progress'] } : r))

let server
let apiUrl
let respond
let apiRequests = 0

beforeAll(async () => {
  server = createServer((req, res) => {
    apiRequests += 1
    respond(req, res)
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  apiUrl = `http://127.0.0.1:${server.address().port}`
})

afterAll(() => new Promise((resolve) => server.close(resolve)))

function serveGitHub({
  repos,
  userRepos = repos,
  status = 200,
  delayMs = 0,
  languages = () => [200, recordedLanguages],
  activity = () => [200, recordedActivity],
}) {
  const seen = []
  respond = (req, res) => {
    seen.push({ url: req.url, auth: req.headers.authorization })
    const [code, body] = req.url.endsWith('/languages')
      ? languages()
      : req.url.endsWith('/stats/commit_activity')
        ? activity()
        : [status, req.url.startsWith('/user/repos') ? userRepos : repos]
    setTimeout(() => {
      res.writeHead(code, { 'content-type': 'application/json' })
      res.end(code === 204 ? undefined : JSON.stringify(body))
    }, delayMs)
  }
  return seen
}

function serveJson(body, status = 200, delayMs = 0) {
  return serveGitHub({ repos: body, status, delayMs })
}

const post = (title, body = '# body\n') => `---\ntitle: ${title}\ndate: 2025-01-01\ndescription: d\n---\n\n${body}`

const entry = (date, title, body = '# body\n') => `---\ntitle: ${title}\ndate: ${date}\ndescription: d ${title}\n---\n\n${body}`

async function scratchProject({ posts = {}, devlogs = null, publicFiles = {}, script = false } = {}) {
  const dir = await realpath(await mkdtemp(path.join(tmpdir(), 'site-')))
  const site = path.join(dir, 'site')
  const postsDir = path.join(dir, 'posts')
  const devlogsDir = path.join(dir, 'devlogs')
  await mkdir(path.join(site, 'public'), { recursive: true })
  await mkdir(postsDir)
  const tag = script ? '<script type="module" src="/main.js"></script>' : ''
  await writeFile(path.join(site, 'index.html'), `<!doctype html><html><head><title>t</title></head><body>${tag}</body></html>`)
  await writeFile(
    path.join(site, 'main.js'),
    "import { devlogs } from 'virtual:devlogs'\nimport { projects } from 'virtual:projects'\nwindow.content = { devlogs, projects }\n",
  )
  await writeFile(
    path.join(site, 'vite.config.mjs'),
    `import contentPlugin from ${JSON.stringify(pluginModule)}\n` +
      `export default { plugins: [contentPlugin({ postsDir: ${JSON.stringify(postsDir)}, devlogsDir: ${JSON.stringify(devlogsDir)} })] }\n`,
  )
  for (const [name, text] of Object.entries({ 'FIV.pdf': '%PDF', ...publicFiles })) {
    await mkdir(path.dirname(path.join(site, 'public', name)), { recursive: true })
    await writeFile(path.join(site, 'public', name), text)
  }
  for (const [name, text] of Object.entries(posts)) await writeFile(path.join(postsDir, name), text)
  if (devlogs) {
    for (const [project, files] of Object.entries(devlogs)) {
      await mkdir(path.join(devlogsDir, project), { recursive: true })
      for (const [name, text] of Object.entries(files)) await writeFile(path.join(devlogsDir, project, name), text)
    }
  }
  return { dir, root: site, config: path.join(site, 'vite.config.mjs'), postsDir, devlogsDir }
}

async function build(env = {}, project = { root, config }, logLevel = 'error') {
  if (project.config === config && env.PORTFOLIO_REPOS_TOKEN) {
    throw new Error(
      'build(): a token build of the real site checks the real devlogs/ folder against the mocked repo list, ' +
        'so any real devlog for an unmocked repo fails it. Pass a scratchProject() instead.',
    )
  }
  const outDir = await mkdtemp(path.join(tmpdir(), 'site-build-'))
  const result = await new Promise((resolve) => {
    execFile(
      process.execPath,
      [vite, 'build', project.root, '--config', project.config, '--outDir', outDir, '--emptyOutDir', '--logLevel', logLevel],
      { cwd: root, env: { PATH: process.env.PATH, GITHUB_API_URL: apiUrl, ...env } },
      (error, stdout, stderr) => resolve({ code: error ? error.code : 0, output: stdout + stderr }),
    )
  })
  return { ...result, outDir, read: (file) => readFile(path.join(outDir, file), 'utf8') }
}

async function bundledJs(site) {
  const assets = await readdir(path.join(site.outDir, 'assets'))
  return (await Promise.all(assets.filter((f) => f.endsWith('.js')).map((f) => site.read(`assets/${f}`)))).join('\n')
}

const head = (html) => new DOMParser().parseFromString(html.replace(/<link rel="stylesheet"[^>]*>/g, ''), 'text/html')
const meta = (doc, attr, key) => doc.head.querySelector(`meta[${attr}="${key}"]`)?.getAttribute('content')

describe('vite build with the content plugin', () => {
  let site

  beforeAll(async () => {
    serveJson(recordedTagged)
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

  it('bundles exactly crowdbook, Pathos and the financial viscosity indicator', async () => {
    const assets = await readdir(path.join(site.outDir, 'assets'))
    const js = (await Promise.all(assets.filter((f) => f.endsWith('.js')).map((f) => site.read(`assets/${f}`)))).join('\n')
    const titles = [...js.matchAll(/title:"([^"]+)",date:"\d{4}-\d{2}"/g)].map((m) => m[1])
    expect(titles).toEqual(['crowdbook', 'Pathos', 'financial viscosity indicator'])
    expect(js).toContain('github:"https://github.com/thewhitelisted/crowdbook"')
    expect(js).toContain('github:"https://github.com/thewhitelisted/Pathos"')
    expect(js).toContain('report:"/FIV.pdf"')
    for (const gone of ['baskets', 'sentivest', 'discord js bot', 'git clone in rust', 'toronto weather', 'agent-based market']) {
      expect(js).not.toContain(gone)
    }
  })

  it('bundles the post index without the post bodies', async () => {
    const assets = await readdir(path.join(site.outDir, 'assets'))
    const js = (await Promise.all(assets.filter((f) => f.endsWith('.js')).map((f) => site.read(`assets/${f}`)))).join('\n')
    expect(js).toContain('handing adhd as a double degree student pursing finance')
    expect(js).not.toContain('handling adhd as a second year double degree student')
    expect(js).not.toContain('# my first work experience in finance')
  })
})

describe('vite build with private repos', () => {
  const privateRepo = {
    ...recordedTagged.find((r) => r.name === 'crowdbook'),
    name: 'stealth-alpha',
    private: true,
    html_url: 'https://github.com/thewhitelisted/stealth-alpha',
    description: 'A private strategy in progress',
    topics: ['portfolio', 'in-progress'],
    default_branch: 'secret-branch-name',
  }

  it('lists repos through /user/repos with PORTFOLIO_REPOS_TOKEN and bundles a tagged private repo without its code link', async () => {
    const seen = serveJson([...recordedTagged, privateRepo])
    const site = await build({ PORTFOLIO_REPOS_TOKEN: 'pat-value', GITHUB_TOKEN: 'actions-token' }, await scratchProject({ script: true }))
    expect(site.output).toBe('')
    expect(site.code).toBe(0)
    expect(seen).toEqual([
      { url: '/user/repos?affiliation=owner&visibility=all&per_page=100&page=1', auth: 'Bearer pat-value' },
      { url: '/repos/thewhitelisted/stealth-alpha/languages', auth: 'Bearer pat-value' },
      { url: '/repos/thewhitelisted/stealth-alpha/stats/commit_activity', auth: 'Bearer pat-value' },
    ])
    const js = await bundledJs(site)
    const stats = [...js.matchAll(/stats:(null|\{languages:.*?last30Days:\d+\}\})/g)].map((m) => m[1])
    expect(stats.filter((s) => s !== 'null')).toEqual([
      expect.stringMatching(/^\{languages:\[\{name:"C\+\+",percent:68\.2\},\{name:"Python",percent:30\.4\},\{name:"CMake",percent:1\.3\},\{name:"Dockerfile",percent:\.1\}\],activity:\{weekly:\[(\d+,){51}\d+\],last30Days:\d+\}\}$/),
    ])
    expect(stats.filter((s) => s === 'null')).toHaveLength(3)
    expect(js).toContain('title:"stealth-alpha"')
    expect(js).toMatch(/status:"in-progress",private:!0/)
    expect(js).not.toContain('github.com/thewhitelisted/stealth-alpha')
    expect(js).not.toContain('secret-branch-name')
    expect(js).not.toContain('pat-value')
    expect(js).toContain('github:"https://github.com/thewhitelisted/crowdbook"')
  }, 60000)

  it('uses the public endpoint with GITHUB_TOKEN when PORTFOLIO_REPOS_TOKEN is empty', async () => {
    const seen = serveJson(recordedTagged)
    const site = await build({ PORTFOLIO_REPOS_TOKEN: '', GITHUB_TOKEN: 'actions-token' })
    expect(site.code).toBe(0)
    expect(seen).toEqual([{ url: '/users/thewhitelisted/repos?type=owner&per_page=100&page=1', auth: 'Bearer actions-token' }])
  }, 60000)

  it('fails, naming the secret, when PORTFOLIO_REPOS_TOKEN is rejected', async () => {
    serveJson({ message: 'Bad credentials' }, 401)
    const { code, output } = await build({ PORTFOLIO_REPOS_TOKEN: 'expired' }, await scratchProject())
    expect(code).not.toBe(0)
    expect(output).toMatch(/HTTP 401 \(PORTFOLIO_REPOS_TOKEN is expired, revoked or wrong; replace the secret\)/)
  }, 60000)
})

describe('vite build with devlogs and stats', () => {
  let site
  let seen

  beforeAll(async () => {
    seen = serveGitHub({ repos: pathosInProgress })
    const project = await scratchProject({
      script: true,
      posts: { 'a.md': post('a post') },
      devlogs: {
        pathos: { '2026-11-20.md': entry('2026-11-20', 'fills & <slippage>', '# Pathos body\n'), '2026-10-05.md': entry('2026-10-05', 'first take') },
        'financial-viscosity-indicator': { '2026-11-02.md': entry('2026-11-02', 'revisiting') },
      },
    })
    site = await build({}, project)
  }, 60000)

  it('succeeds, fetching stats only for the in-progress repo', () => {
    expect(site.output).toBe('')
    expect(site.code).toBe(0)
    expect(seen.map((r) => r.url)).toEqual([
      '/users/thewhitelisted/repos?type=owner&per_page=100&page=1',
      '/repos/thewhitelisted/Pathos/languages',
      '/repos/thewhitelisted/Pathos/stats/commit_activity',
    ])
  })

  it('writes each devlog body without frontmatter at devlogs/<project>/<date>.md', async () => {
    expect(await site.read('devlogs/pathos/2026-11-20.md')).toBe('# Pathos body\n')
    expect(await site.read('devlogs/pathos/2026-10-05.md')).toBe('# body\n')
    expect(await site.read('devlogs/financial-viscosity-indicator/2026-11-02.md')).toBe('# body\n')
  })

  it('bundles the devlog index newest first, without bodies, and stats on each project', async () => {
    const js = await bundledJs(site)
    expect(js).toContain('[{project:"pathos",date:"2026-11-20",title:"fills & <slippage>",description:"d fills & <slippage>"},' +
      '{project:"financial-viscosity-indicator",date:"2026-11-02",title:"revisiting",description:"d revisiting"},' +
      '{project:"pathos",date:"2026-10-05",title:"first take",description:"d first take"}]')
    expect(js).not.toContain('Pathos body')
    expect(js).toMatch(/title:"Pathos",.*status:"in-progress",.*stats:\{languages:\[\{name:"C\+\+",percent:68\.2\}/)
    expect(js).toMatch(/title:"crowdbook",[^}]*status:"complete",[^}]*stats:null/)
    expect(js).toMatch(/title:"financial viscosity indicator",[^}]*stats:null/)
  })

  it('adds devlog entries to the RSS feed, titled with the project', async () => {
    const items = new XMLParser().parse(await site.read('rss.xml')).rss.channel.item
    expect(items.map((i) => [i.title, i.link])).toEqual([
      ['Pathos devlog: fills & <slippage>', 'https://www.christopherjlee.ca/projects/pathos/2026-11-20'],
      ['financial viscosity indicator devlog: revisiting', 'https://www.christopherjlee.ca/projects/financial-viscosity-indicator/2026-11-02'],
      ['Pathos devlog: first take', 'https://www.christopherjlee.ca/projects/pathos/2026-10-05'],
      ['a post', 'https://www.christopherjlee.ca/blog/a'],
    ])
  })

  it('writes static pages for /now, each project with entries, and each entry', async () => {
    const expected = {
      'now.html': ['Now · Christopher Lee', 'https://www.christopherjlee.ca/now'],
      'now/index.html': ['Now · Christopher Lee', 'https://www.christopherjlee.ca/now'],
      'projects/pathos.html': ['Pathos devlog · Christopher Lee', 'https://www.christopherjlee.ca/projects/pathos'],
      'projects/pathos/index.html': ['Pathos devlog · Christopher Lee', 'https://www.christopherjlee.ca/projects/pathos'],
      'projects/financial-viscosity-indicator/index.html': ['financial viscosity indicator devlog · Christopher Lee', 'https://www.christopherjlee.ca/projects/financial-viscosity-indicator'],
      'projects/pathos/2026-11-20.html': ['Pathos devlog: fills & <slippage>', 'https://www.christopherjlee.ca/projects/pathos/2026-11-20'],
      'projects/pathos/2026-11-20/index.html': ['Pathos devlog: fills & <slippage>', 'https://www.christopherjlee.ca/projects/pathos/2026-11-20'],
      'projects/financial-viscosity-indicator/2026-11-02/index.html': ['financial viscosity indicator devlog: revisiting', 'https://www.christopherjlee.ca/projects/financial-viscosity-indicator/2026-11-02'],
    }
    for (const [file, [title, url]] of Object.entries(expected)) {
      const doc = head(await site.read(file))
      expect(doc.title, file).toBe(title)
      expect(meta(doc, 'property', 'og:url'), file).toBe(url)
    }
    const entryPage = head(await site.read('projects/pathos/2026-11-20/index.html'))
    expect(meta(entryPage, 'property', 'og:type')).toBe('article')
    expect(meta(entryPage, 'property', 'article:published_time')).toBe('2026-11-20')
    expect(meta(entryPage, 'name', 'description')).toBe('d fills & <slippage>')
    await expect(site.read('projects/crowdbook.html')).rejects.toThrow(/ENOENT/)
  })
})

describe('vite build with stats that GitHub has not computed', () => {
  it('builds with activity null and a warning after retrying HTTP 202', async () => {
    let attempts = 0
    serveGitHub({ repos: pathosInProgress, activity: () => { attempts += 1; return [202, {}] } })
    const project = await scratchProject({ script: true })
    const site = await build({}, project, 'warn')
    expect(site.code).toBe(0)
    expect(attempts).toBe(5)
    expect(site.output).toMatch(/GitHub was still computing commit activity for Pathos after 5 attempts \(HTTP 202\); building without it/)
    expect(await bundledJs(site)).toMatch(/title:"Pathos",.*stats:\{languages:\[\{name:"C\+\+",percent:68\.2\}.*?\],activity:null\}/)
  }, 60000)
})

describe('vite build with a devlog for a private repo', () => {
  const secret = {
    ...recordedTagged.find((r) => r.name === 'crowdbook'),
    name: 'secret-proj',
    private: true,
    html_url: 'https://github.com/thewhitelisted/secret-proj',
    description: 'A private project',
    topics: ['portfolio', 'in-progress'],
  }
  const devlogs = {
    'secret-proj': { '2026-11-21.md': entry('2026-11-21', 'hidden take', '# Secret body\n') },
    pathos: { '2026-11-20.md': entry('2026-11-20', 'public take') },
  }

  it('includes it when PORTFOLIO_REPOS_TOKEN lists the repo', async () => {
    serveGitHub({ repos: recordedTagged, userRepos: [...recordedTagged, secret] })
    const site = await build({ PORTFOLIO_REPOS_TOKEN: 'pat' }, await scratchProject({ script: true, devlogs }), 'warn')
    expect(site.code).toBe(0)
    expect(site.output).not.toMatch(/skipped/)
    expect(await site.read('devlogs/secret-proj/2026-11-21.md')).toBe('# Secret body\n')
    expect(await site.read('rss.xml')).toContain('secret-proj devlog: hidden take')
    expect(await site.read('projects/secret-proj/2026-11-21/index.html')).toContain('secret-proj devlog: hidden take')
  }, 60000)

  it.each([
    ['unset', {}],
    ['empty', { PORTFOLIO_REPOS_TOKEN: '', GITHUB_TOKEN: 'actions-token' }],
  ])('skips it with a warning when PORTFOLIO_REPOS_TOKEN is %s, leaving it out of every output', async (_label, env) => {
    serveGitHub({ repos: recordedTagged, userRepos: [...recordedTagged, secret] })
    const site = await build(env, await scratchProject({ script: true, devlogs }), 'warn')
    expect(site.code).toBe(0)
    expect(site.output).toMatch(/devlogs: skipped devlogs\/secret-proj: no listed project has that slug\. PORTFOLIO_REPOS_TOKEN is not set/)
    await expect(site.read('devlogs/secret-proj/2026-11-21.md')).rejects.toThrow(/ENOENT/)
    await expect(site.read('projects/secret-proj/2026-11-21/index.html')).rejects.toThrow(/ENOENT/)
    await expect(site.read('projects/secret-proj/index.html')).rejects.toThrow(/ENOENT/)
    const rss = await site.read('rss.xml')
    expect(rss).not.toContain('hidden take')
    expect(rss).toContain('Pathos devlog: public take')
    const js = await bundledJs(site)
    expect(js).not.toContain('hidden take')
    expect(js).not.toContain('secret-proj')
    expect(js).toContain('public take')
    expect(await site.read('devlogs/pathos/2026-11-20.md')).toBe('# body\n')
  }, 60000)

  it('still fails on a broken entry inside a skipped folder', async () => {
    serveGitHub({ repos: recordedTagged })
    const project = await scratchProject({ devlogs: { 'secret-proj': { '2026-11-21.md': entry('2026-11-22', 'x') } } })
    const { code, output } = await build({}, project)
    expect(code).not.toBe(0)
    expect(output).toMatch(/secret-proj\/2026-11-21\.md: frontmatter date 2026-11-22 does not match the file name date 2026-11-21/)
  }, 60000)
})

describe('vite build failure paths', () => {
  it('fails when a devlog folder is not a project slug and PORTFOLIO_REPOS_TOKEN is set', async () => {
    serveJson(recordedTagged)
    const project = await scratchProject({ devlogs: { ghost: { '2026-11-20.md': entry('2026-11-20', 'x') } } })
    const { code, output } = await build({ PORTFOLIO_REPOS_TOKEN: 'pat' }, project)
    expect(code).not.toBe(0)
    expect(output).toMatch(/devlogs\/ghost: "ghost" is not a project slug; use one of: crowdbook, pathos, financial-viscosity-indicator/)
  }, 60000)

  it('fails when a devlog entry date differs from its file name', async () => {
    serveJson(recordedTagged)
    const project = await scratchProject({ devlogs: { pathos: { '2026-11-20.md': entry('2026-11-21', 'x') } } })
    const { code, output } = await build({}, project)
    expect(code).not.toBe(0)
    expect(output).toMatch(/2026-11-20\.md: frontmatter date 2026-11-21 does not match the file name date 2026-11-20/)
  }, 60000)

  it.each([
    ['languages', 403],
    ['commit activity', 500],
    ['commit activity', 401],
  ])('fails when %s returns HTTP %i', async (endpoint, status) => {
    const failing = () => [status, { message: 'nope' }]
    serveGitHub({ repos: pathosInProgress, ...(endpoint === 'languages' ? { languages: failing } : { activity: failing }) })
    const { code, output } = await build({}, await scratchProject())
    expect(code).not.toBe(0)
    expect(output).toMatch(new RegExp(`GitHub projects: .*/repos/thewhitelisted/Pathos/${endpoint === 'languages' ? 'languages' : 'stats/commit_activity'} returned HTTP ${status}`))
  }, 60000)

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

  it('fails when a generated file would overwrite another output', async () => {
    serveJson(recordedTagged)
    const project = await scratchProject({ posts: { 'a.md': post('a') }, publicFiles: { 'rss.xml': '<rss/>' } })
    const { code, output } = await build({}, project)
    expect(code).not.toBe(0)
    expect(output).toMatch(/two outputs would be written to rss\.xml/)
  }, 60000)

  it.each([
    ['the project page', 'projects/financial-viscosity-indicator.html'],
    ['the entry page', 'projects/financial-viscosity-indicator/2026-11-20/index.html'],
    ['the entry body', 'devlogs/financial-viscosity-indicator/2026-11-20.md'],
    ['the /now page', 'now.html'],
  ])('fails when %s of a devlog would overwrite a file in public/', async (_name, file) => {
    serveJson(recordedTagged)
    const project = await scratchProject({
      devlogs: { 'financial-viscosity-indicator': { '2026-11-20.md': entry('2026-11-20', 'x') } },
      publicFiles: { [file]: 'already here' },
    })
    const { code, output } = await build({}, project)
    expect(code).not.toBe(0)
    expect(output).toContain(`site-content: two outputs would be written to ${file}`)
  }, 60000)

  it('fails with a clear message on devlogs for a repo named "index"', async () => {
    const indexRepo = { ...recordedTagged.find((r) => r.name === 'crowdbook'), name: 'index', html_url: 'https://github.com/thewhitelisted/index' }
    serveJson([...recordedTagged, indexRepo])
    const project = await scratchProject({ devlogs: { index: { '2026-11-20.md': entry('2026-11-20', 'x') } } })
    const { code, output } = await build({}, project)
    expect(code).not.toBe(0)
    expect(output).toMatch(/devlogs\/index: a project with the slug "index" cannot have devlogs: its page \/projects\/index would replace the projects page/)
  }, 60000)

  it('warns about a dot-named folder in devlogs/ and builds without it', async () => {
    serveJson(recordedTagged)
    const project = await scratchProject({ devlogs: { '.github': { 'x.yml': 'y' }, pathos: { '2026-11-20.md': entry('2026-11-20', 'x') } } })
    const site = await build({}, project, 'warn')
    expect(site.code).toBe(0)
    expect(site.output).toContain('devlogs: ignored devlogs/.github: folders whose names start with a dot are not read')
    expect(await site.read('devlogs/pathos/2026-11-20.md')).toBe('# body\n')
  }, 60000)

  it('fails on a reserved post slug that would replace the blog listing page', async () => {
    serveJson(recordedTagged)
    const project = await scratchProject({ posts: { 'index.md': post('i') } })
    const { code, output } = await build({}, project)
    expect(code).not.toBe(0)
    expect(output).toMatch(/index\.md: "index" is reserved/)
  }, 60000)

  it('fails when no repo is tagged, and builds hand-kept projects only when that is explicitly allowed', async () => {
    serveJson(recorded)
    const refused = await build()
    expect(refused.code).not.toBe(0)
    expect(refused.output).toMatch(/no GitHub repo has the portfolio topic/)

    const allowed = await build({ ALLOW_NO_GITHUB_PROJECTS: '1' })
    expect(allowed.code).toBe(0)
    expect(await allowed.read('projects/index.html')).toContain('Projects · Christopher Lee')
  }, 60000)
})

function get(url) {
  return new Promise((resolve, reject) => {
    httpGet(url, (res) => {
      let text = ''
      res.setEncoding('utf8')
      res.on('data', (chunk) => { text += chunk })
      res.on('end', () => resolve({ status: res.statusCode, type: res.headers['content-type'], text }))
    }).on('error', reject)
  })
}

async function until(check, label, ms = 20000) {
  const end = Date.now() + ms
  let last
  while (Date.now() < end) {
    last = await check().catch((err) => err)
    if (last === true) return
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`timed out waiting for ${label} (last: ${last})`)
}

async function freePort() {
  const probe = createServer()
  await new Promise((resolve) => probe.listen(0, '127.0.0.1', resolve))
  const { port } = probe.address()
  await new Promise((resolve) => probe.close(resolve))
  return port
}

async function hmrSocket(base) {
  const client = (await get(`${base}/@vite/client`)).text
  const token = /const wsToken = "([^"]+)"/.exec(client)[1]
  const socket = new WebSocket(`${base.replace('http:', 'ws:')}/?token=${token}`, 'vite-hmr')
  const messages = []
  socket.addEventListener('message', (event) => messages.push(JSON.parse(event.data)))
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve)
    socket.addEventListener('error', reject)
  })
  return { messages, close: () => socket.close() }
}

async function startDev(project, env = {}) {
  const port = await freePort()
  const dev = { base: `http://127.0.0.1:${port}`, output: '' }
  dev.process = spawn(
    process.execPath,
    [vite, 'serve', project.root, '--config', project.config, '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
    { cwd: root, env: { PATH: process.env.PATH, GITHUB_API_URL: apiUrl, ...env } },
  )
  dev.process.stdout.on('data', (chunk) => { dev.output += chunk })
  dev.process.stderr.on('data', (chunk) => { dev.output += chunk })
  dev.exited = new Promise((resolve) => dev.process.on('exit', resolve))
  return dev
}

const ourMessages = (messages) => messages.filter((m) => m.type === 'full-reload' || m.type === 'error')

describe('dev server', () => {
  let project
  let dev
  let hmr

  beforeAll(async () => {
    serveJson(recordedTagged)
    project = await scratchProject({ posts: { 'a.md': post('a', '# A body\n') } })
    dev = await startDev(project)
    await until(async () => (await get(`${dev.base}/posts/a.md`)).status === 200, 'the dev server')
    hmr = await hmrSocket(dev.base)
  }, 60000)

  afterAll(async () => {
    hmr?.close()
    dev?.process.kill()
    if (project) await rm(project.dir, { recursive: true, force: true })
  })

  const postFile = (name) => path.join(project.postsDir, name)
  const index = async () => (await get(`${dev.base}/@id/__x00__virtual:posts`)).text
  const fresh = () => hmr.messages.splice(0)

  it('serves the post body without frontmatter', async () => {
    expect(await get(`${dev.base}/posts/a.md`)).toEqual({ status: 200, type: 'text/markdown; charset=utf-8', text: '# A body\n' })
  })

  it('keeps post bodies out of virtual:posts', async () => {
    expect(await index()).toContain('"slug":"a"')
    expect(await index()).not.toContain('A body')
  })

  it('never serves the raw post file, however the path is spelled', async () => {
    const raw = path.join(project.postsDir, 'a.md')
    for (const url of [
      '/posts/unknown.md', '/posts/a', '/posts/a.md/x',
      '/%70osts/a.md', '/Posts/a.md', '/POSTS/A.MD', '/./posts/a.md', '//posts/a.md', '/x/../posts/a.md',
      '/../posts/a.md', '/%2e%2e/posts/a.md', `/@fs${raw}`, `/@fs${raw}?raw`, `/@fs${raw}?import&raw`,
    ]) {
      const res = await get(`${dev.base}${url}`)
      expect(res.text, url).not.toContain('title: a')
      expect(res.text, url).not.toContain('description: d')
    }
  }, 30000)

  it('serves the new body after a post is edited and tells the browser to reload', async () => {
    fresh()
    await writeFile(postFile('a.md'), post('a', '# A edited\n'))
    await until(async () => (await get(`${dev.base}/posts/a.md`)).text === '# A edited\n', 'the edited body')
    await until(async () => ourMessages(hmr.messages).length > 0, 'a hot message')
    expect(ourMessages(fresh())).toEqual([{ type: 'full-reload' }])
  }, 30000)

  it('picks up a post added while running, without its frontmatter, and lists it', async () => {
    await new Promise((resolve) => setTimeout(resolve, 1500))
    expect(await index()).not.toContain('"slug":"b"')
    const staged = path.join(project.dir, 'b.md.staged')
    await writeFile(staged, post('b title', '# B body\n'))
    await rename(staged, postFile('b.md'))
    await until(async () => (await get(`${dev.base}/posts/b.md`)).text === '# B body\n', 'the new post')
    await until(async () => (await index()).includes('"slug":"b"'), 'the new post in virtual:posts')
    expect(await index()).toContain('"title":"b title"')
  }, 30000)

  it('reports a post broken while running, and recovers when it is fixed', async () => {
    fresh()
    await writeFile(postFile('c.md'), '---\ntitle: c\ndate: 2025-01-01\n---\n\nbody\n')
    await until(async () => dev.output.includes('c.md: missing frontmatter field "description"'), 'the error in the terminal')
    await until(async () => ourMessages(hmr.messages).some((m) => m.type === 'error'), 'the error overlay message')
    const errors = ourMessages(fresh())
    expect(errors.every((m) => m.type === 'error')).toBe(true)
    expect(errors.at(-1).err.message).toMatch(/c\.md: missing frontmatter field "description"/)
    const broken = await get(`${dev.base}/posts/a.md`)
    expect(broken.status).toBe(500)
    expect(broken.text).toMatch(/c\.md: missing frontmatter field "description"/)
    expect((await get(`${dev.base}/@id/__x00__virtual:posts`)).status).toBe(500)

    await writeFile(postFile('c.md'), post('c', '# C body\n'))
    await until(async () => (await get(`${dev.base}/posts/c.md`)).text === '# C body\n', 'the fixed post')
    expect((await get(`${dev.base}/posts/a.md`)).status).toBe(200)
    await until(async () => ourMessages(hmr.messages).some((m) => m.type === 'full-reload'), 'the reload after the fix')
    expect(ourMessages(fresh()).at(-1)).toEqual({ type: 'full-reload' })
  }, 30000)

  it('reports a folder inside posts/ like the build does, and recovers when it is removed', async () => {
    fresh()
    await mkdir(postFile('drafts'))
    await until(async () => (await get(`${dev.base}/posts/a.md`)).status === 500, 'the folder error')
    expect((await get(`${dev.base}/posts/a.md`)).text).toMatch(/drafts: only \.md files belong in the posts folder/)
    await until(async () => ourMessages(hmr.messages).some((m) => m.type === 'error'), 'the folder error message')

    await rm(postFile('drafts'), { recursive: true })
    await until(async () => (await get(`${dev.base}/posts/a.md`)).status === 200, 'recovery after removing the folder')
  }, 30000)

  it('drops a post deleted while running', async () => {
    await rm(postFile('b.md'))
    await until(async () => (await get(`${dev.base}/posts/b.md`)).status === 404, 'the deleted post to 404')
    await until(async () => !(await index()).includes('"slug":"b"'), 'the deleted post to leave virtual:posts')
  }, 30000)
})

describe('dev server devlogs', () => {
  const FVI = 'financial-viscosity-indicator'
  let project
  let dev
  let hmr

  beforeAll(async () => {
    serveJson(recordedTagged)
    project = await scratchProject({ posts: { 'a.md': post('a', '# A body\n') } })
    dev = await startDev(project)
    await until(async () => (await get(`${dev.base}/posts/a.md`)).status === 200, 'the dev server')
    hmr = await hmrSocket(dev.base)
  }, 60000)

  afterAll(async () => {
    hmr?.close()
    dev?.process.kill()
    if (project) await rm(project.dir, { recursive: true, force: true })
  })

  const entryFile = (folder, name) => path.join(project.devlogsDir, folder, name)
  const index = async () => (await get(`${dev.base}/@id/__x00__virtual:devlogs`)).text
  const fresh = () => hmr.messages.splice(0)

  it('starts with no entries when devlogs/ does not exist', async () => {
    expect(await index()).toContain('export const devlogs = []')
    expect((await get(`${dev.base}/devlogs/${FVI}/2026-11-20.md`)).status).toBe(404)
  })

  it('picks up devlogs/ created while running, serving the body without frontmatter and listing the entry', async () => {
    fresh()
    const staged = path.join(project.dir, 'staged')
    await mkdir(path.join(staged, FVI), { recursive: true })
    await writeFile(path.join(staged, FVI, '2026-11-20.md'), entry('2026-11-20', 'first take', '# FVI body\n'))
    await rename(staged, project.devlogsDir)
    await until(async () => (await get(`${dev.base}/devlogs/${FVI}/2026-11-20.md`)).text === '# FVI body\n', 'the new entry')
    expect((await get(`${dev.base}/devlogs/${FVI}/2026-11-20.md`)).type).toBe('text/markdown; charset=utf-8')
    await until(async () => (await index()).includes('"date":"2026-11-20"'), 'the entry in virtual:devlogs')
    expect(await index()).toContain(`{"project":"${FVI}","date":"2026-11-20","title":"first take","description":"d first take"}`)
    expect(await index()).not.toContain('FVI body')
    await until(async () => ourMessages(hmr.messages).some((m) => m.type === 'full-reload'), 'a reload')
  }, 30000)

  it('never serves the raw entry file, however the path is spelled', async () => {
    const raw = entryFile(FVI, '2026-11-20.md')
    for (const url of [
      `/devlogs/${FVI}/2026-11-20`, `/devlogs/${FVI}/2026-11-20.md/x`, `/devlogs/${FVI}/2026-11-21.md`, '/devlogs/',
      `/%64evlogs/${FVI}/2026-11-20.md`, `/Devlogs/${FVI}/2026-11-20.md`, `/./devlogs/${FVI}/2026-11-20.md`,
      `//devlogs/${FVI}/2026-11-20.md`, `/../devlogs/${FVI}/2026-11-20.md`, `/@fs${raw}`, `/@fs${raw}?raw`, `/@fs${raw}?import&raw`,
    ]) {
      const res = await get(`${dev.base}${url}`)
      expect(res.text, url).not.toContain('title: first take')
      expect(res.text, url).not.toContain('description: d first take')
    }
  }, 30000)

  it('serves the new body after an entry is edited and tells the browser to reload', async () => {
    fresh()
    await writeFile(entryFile(FVI, '2026-11-20.md'), entry('2026-11-20', 'first take', '# edited\n'))
    await until(async () => (await get(`${dev.base}/devlogs/${FVI}/2026-11-20.md`)).text === '# edited\n', 'the edited body')
    await until(async () => ourMessages(hmr.messages).length > 0, 'a hot message')
    expect(ourMessages(fresh()).at(-1)).toEqual({ type: 'full-reload' })
  }, 30000)

  it('skips a folder that is not a project, with a warning, when PORTFOLIO_REPOS_TOKEN is not set', async () => {
    fresh()
    await mkdir(path.join(project.devlogsDir, 'ghost'))
    await writeFile(entryFile('ghost', '2026-11-22.md'), entry('2026-11-22', 'ghost take'))
    await until(async () => dev.output.includes('skipped devlogs/ghost: no listed project has that slug'), 'the warning in the terminal')
    await until(async () => ourMessages(hmr.messages).some((m) => m.type === 'full-reload'), 'a reload')
    expect(ourMessages(fresh()).every((m) => m.type === 'full-reload')).toBe(true)
    expect(await index()).not.toContain('ghost')
    expect((await get(`${dev.base}/devlogs/ghost/2026-11-22.md`)).status).toBe(404)
    expect((await get(`${dev.base}/devlogs/${FVI}/2026-11-20.md`)).status).toBe(200)

    await writeFile(entryFile('ghost', '2026-11-23.md'), entry('2026-11-24', 'x'))
    await until(async () => (await get(`${dev.base}/devlogs/${FVI}/2026-11-20.md`)).status === 500, 'the error inside the skipped folder')
    expect((await get(`${dev.base}/devlogs/${FVI}/2026-11-20.md`)).text).toMatch(/2026-11-23\.md: frontmatter date 2026-11-24 does not match/)
    await rm(path.join(project.devlogsDir, 'ghost'), { recursive: true })
    await until(async () => (await get(`${dev.base}/devlogs/${FVI}/2026-11-20.md`)).status === 200, 'recovery')
  }, 30000)

  it('reports a stray file, shows the post error first while both are broken, and recovers', async () => {
    fresh()
    await writeFile(path.join(project.devlogsDir, 'notes.md'), 'x')
    await until(async () => dev.output.includes('notes.md: only project folders belong'), 'the error in the terminal')
    await until(async () => ourMessages(hmr.messages).some((m) => m.type === 'error'), 'the error overlay message')
    expect(ourMessages(fresh()).at(-1).err.message).toMatch(/notes\.md: only project folders belong/)
    const broken = await get(`${dev.base}/devlogs/${FVI}/2026-11-20.md`)
    expect(broken.status).toBe(500)
    expect(broken.text).toMatch(/notes\.md: only project folders belong/)
    expect((await get(`${dev.base}/@id/__x00__virtual:devlogs`)).status).toBe(500)
    expect((await get(`${dev.base}/posts/a.md`)).status).toBe(200)

    await writeFile(path.join(project.postsDir, 'a.md'), post('a', '# A again\n'))
    await until(async () => (await get(`${dev.base}/posts/a.md`)).text === '# A again\n', 'the post edit')
    await until(async () => ourMessages(hmr.messages).length > 0, 'the hot message after the post edit')
    expect(ourMessages(fresh()).at(-1).err.message).toMatch(/notes\.md: only project folders belong/)

    await writeFile(path.join(project.postsDir, 'z.md'), '---\ntitle: z\ndate: 2025-01-01\n---\n\nbody\n')
    await until(async () => (await get(`${dev.base}/posts/a.md`)).status === 500, 'the post error')
    await until(async () => ourMessages(hmr.messages).length > 0, 'the hot message for the post error')
    expect(ourMessages(fresh()).at(-1).err.message).toMatch(/z\.md: missing frontmatter field "description"/)

    await rm(path.join(project.postsDir, 'z.md'))
    await until(async () => (await get(`${dev.base}/posts/a.md`)).status === 200, 'the post recovery')
    await until(async () => ourMessages(hmr.messages).length > 0, 'the hot message after the post fix')
    expect(ourMessages(fresh()).at(-1).err.message).toMatch(/notes\.md: only project folders belong/)

    await rm(path.join(project.devlogsDir, 'notes.md'))
    await until(async () => (await get(`${dev.base}/devlogs/${FVI}/2026-11-20.md`)).status === 200, 'recovery')
    await until(async () => ourMessages(hmr.messages).some((m) => m.type === 'full-reload'), 'the reload after the fix')
  }, 30000)

  it('reports a nested folder inside a project folder', async () => {
    await mkdir(entryFile(FVI, 'drafts'))
    await until(async () => (await get(`${dev.base}/devlogs/${FVI}/2026-11-20.md`)).status === 500, 'the nested folder error')
    expect((await get(`${dev.base}/devlogs/${FVI}/2026-11-20.md`)).text).toMatch(/drafts: only YYYY-MM-DD\.md files belong/)
    await rm(entryFile(FVI, 'drafts'), { recursive: true })
    await until(async () => (await get(`${dev.base}/devlogs/${FVI}/2026-11-20.md`)).status === 200, 'recovery')
  }, 30000)

  it('drops an entry deleted while running, and everything when devlogs/ is removed', async () => {
    await writeFile(entryFile(FVI, '2026-11-21.md'), entry('2026-11-21', 'second'))
    await until(async () => (await get(`${dev.base}/devlogs/${FVI}/2026-11-21.md`)).status === 200, 'the second entry')
    await rm(entryFile(FVI, '2026-11-21.md'))
    await until(async () => (await get(`${dev.base}/devlogs/${FVI}/2026-11-21.md`)).status === 404, 'the deleted entry to 404')
    await until(async () => !(await index()).includes('"date":"2026-11-21"'), 'the deleted entry to leave virtual:devlogs')
    await rm(project.devlogsDir, { recursive: true })
    await until(async () => (await index()).includes('export const devlogs = []'), 'no entries after removing devlogs/')
  }, 30000)
})

describe('dev server devlogs with PORTFOLIO_REPOS_TOKEN', () => {
  it('reports a folder that is not a project as an error, because the listing is complete', async () => {
    serveJson(recordedTagged)
    const project = await scratchProject({ posts: { 'a.md': post('a') } })
    const dev = await startDev(project, { PORTFOLIO_REPOS_TOKEN: 'pat' })
    try {
      await until(async () => (await get(`${dev.base}/posts/a.md`)).status === 200, 'the dev server')
      await mkdir(path.join(project.devlogsDir, 'ghost'), { recursive: true })
      await until(async () => (await get(`${dev.base}/devlogs/ghost/2026-11-20.md`)).status === 500, 'the error')
      expect((await get(`${dev.base}/devlogs/ghost/2026-11-20.md`)).text).toMatch(/ghost: "ghost" is not a project slug/)
      expect(dev.output).not.toMatch(/skipped devlogs/)
    } finally {
      dev.process.kill()
      await rm(project.dir, { recursive: true, force: true })
    }
  }, 60000)
})

describe('dev server startup', () => {
  it('applies a post edit made while the initial GitHub fetch is still running', async () => {
    serveJson(recordedTagged, 200, 2000)
    const project = await scratchProject({ posts: { 'a.md': post('a', '# before\n') } })
    const requestsBefore = apiRequests
    const dev = await startDev(project)
    try {
      await until(async () => apiRequests > requestsBefore, 'the GitHub request')
      await new Promise((resolve) => setTimeout(resolve, 300))
      await writeFile(path.join(project.postsDir, 'a.md'), post('a', '# after\n'))
      await until(async () => (await get(`${dev.base}/posts/a.md`).catch(() => ({}))).status !== undefined, 'the dev server')
      await until(async () => (await get(`${dev.base}/posts/a.md`)).text === '# after\n', 'the edit made during startup')
      expect((await get(`${dev.base}/posts/a.md`)).status).toBe(200)
      expect(dev.output).not.toMatch(/Cannot set properties/)
    } finally {
      dev.process.kill()
      await rm(project.dir, { recursive: true, force: true })
    }
  }, 60000)

  it('exits when the posts are invalid at startup', async () => {
    serveJson(recordedTagged)
    const project = await scratchProject({ posts: { 'a.md': '# no frontmatter\n' } })
    const dev = await startDev(project)
    try {
      const code = await Promise.race([dev.exited, new Promise((resolve) => setTimeout(() => resolve('still running'), 20000))])
      expect(code).not.toBe('still running')
      expect(code).not.toBe(0)
      expect(dev.output).toMatch(/a\.md: must start with a "---" frontmatter block/)
    } finally {
      dev.process.kill()
      await rm(project.dir, { recursive: true, force: true })
    }
  }, 60000)
})

describe('hotMessage', () => {
  it('asks for a full reload when posts load, and an error overlay naming the file when they do not', () => {
    expect(hotMessage(null)).toEqual({ type: 'full-reload' })
    expect(hotMessage(new Error('posts/c.md: missing'))).toEqual({ type: 'error', err: { message: 'posts/c.md: missing', stack: '' } })
  })
})

describe('watchPosts', () => {
  function fakeWatcher() {
    const watcher = new EventEmitter()
    watcher.added = []
    watcher.add = (dir) => watcher.added.push(dir)
    return watcher
  }

  it.each(['add', 'change', 'unlink', 'addDir', 'unlinkDir'])('reloads on %s directly in the posts folder', (event) => {
    const watcher = fakeWatcher()
    let calls = 0
    watchPosts(watcher, '/site/posts', () => { calls += 1 })
    expect(watcher.added).toEqual(['/site/posts'])
    watcher.emit(event, '/site/posts/new.md')
    expect(calls).toBe(1)
  })

  it.each([
    ['change', '/site/src/App.jsx'],
    ['add', '/site/posts/drafts/x.md'],
    ['add', '/site/postsx/x.md'],
    ['addDir', '/site/posts/drafts/deeper'],
    ['unlink', '/site/posts'],
  ])('ignores %s of %s', (event, file) => {
    const watcher = fakeWatcher()
    let calls = 0
    watchPosts(watcher, '/site/posts', () => { calls += 1 })
    watcher.emit(event, file)
    expect(calls).toBe(0)
  })
})

describe('postResponse', () => {
  const posts = [{ slug: 'a', body: '# A\n' }]

  it.each([
    ['/posts/a.md', { status: 200, body: '# A\n' }],
    ['/posts/a.md?import', { status: 200, body: '# A\n' }],
    ['/posts/b.md', { status: 404, body: 'not found' }],
    ['/posts/a', { status: 404, body: 'not found' }],
    ['/posts/', { status: 404, body: 'not found' }],
    ['/posts/x/a.md', { status: 404, body: 'not found' }],
    ['/postsa.md', null],
    ['/src/posts/a.md', null],
  ])('%s -> %j', (url, expected) => {
    expect(postResponse(url, posts, null)).toEqual(expected)
  })

  it('answers every /posts/ request with the load error while posts are broken', () => {
    const error = new Error('posts/c.md: missing frontmatter field "description"')
    expect(postResponse('/posts/a.md', posts, error)).toEqual({ status: 500, body: error.message })
    expect(postResponse('/src/main.jsx', posts, error)).toBeNull()
  })
})

describe('watchDevlogs', () => {
  function fakeWatcher() {
    const watcher = new EventEmitter()
    watcher.added = []
    watcher.add = (dir) => watcher.added.push(dir)
    return watcher
  }

  it.each([
    ['add', '/site/devlogs/pathos/2026-11-20.md'],
    ['change', '/site/devlogs/pathos/2026-11-20.md'],
    ['unlink', '/site/devlogs/pathos/2026-11-20.md'],
    ['addDir', '/site/devlogs/pathos'],
    ['unlinkDir', '/site/devlogs/pathos'],
    ['addDir', '/site/devlogs'],
    ['unlinkDir', '/site/devlogs'],
    ['add', '/site/devlogs/stray.md'],
    ['addDir', '/site/devlogs/pathos/drafts'],
    ['add', '/site/devlogs/pathos/drafts/x.md'],
  ])('reloads on %s of %s', (event, file) => {
    const watcher = fakeWatcher()
    let calls = 0
    watchDevlogs(watcher, '/site/devlogs', () => { calls += 1 })
    expect(watcher.added).toEqual(['/site/devlogs'])
    watcher.emit(event, file)
    expect(calls).toBe(1)
  })

  it.each([
    ['change', '/site/src/App.jsx'],
    ['add', '/site/devlogsx/pathos/2026-11-20.md'],
    ['add', '/site/posts/a.md'],
    ['unlinkDir', '/site'],
  ])('ignores %s of %s', (event, file) => {
    const watcher = fakeWatcher()
    let calls = 0
    watchDevlogs(watcher, '/site/devlogs', () => { calls += 1 })
    watcher.emit(event, file)
    expect(calls).toBe(0)
  })
})

describe('devlogResponse', () => {
  const devlogs = [{ project: 'pathos', date: '2026-11-20', body: '# P\n' }]

  it.each([
    ['/devlogs/pathos/2026-11-20.md', { status: 200, body: '# P\n' }],
    ['/devlogs/pathos/2026-11-20.md?import', { status: 200, body: '# P\n' }],
    ['/devlogs/pathos/2026-11-21.md', { status: 404, body: 'not found' }],
    ['/devlogs/pathos/2026-11-20', { status: 404, body: 'not found' }],
    ['/devlogs/Pathos/2026-11-20.md', { status: 404, body: 'not found' }],
    ['/devlogs/pathos.md', { status: 404, body: 'not found' }],
    ['/devlogs/', { status: 404, body: 'not found' }],
    ['/devlogs/x/pathos/2026-11-20.md', { status: 404, body: 'not found' }],
    ['/devlogsx/pathos/2026-11-20.md', null],
    ['/posts/a.md', null],
  ])('%s -> %j', (url, expected) => {
    expect(devlogResponse(url, devlogs, null)).toEqual(expected)
  })

  it('answers every /devlogs/ request with the load error while devlogs are broken', () => {
    const error = new Error('devlogs/ghost: "ghost" is not a project slug')
    expect(devlogResponse('/devlogs/pathos/2026-11-20.md', devlogs, error)).toEqual({ status: 500, body: error.message })
    expect(devlogResponse('/src/main.jsx', devlogs, error)).toBeNull()
  })
})

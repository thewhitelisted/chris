import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createServer, get as httpGet } from 'node:http'
import { execFile, spawn } from 'node:child_process'
import { mkdtemp, mkdir, readFile, readdir, realpath, rename, rm, writeFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { EventEmitter } from 'node:events'
import { XMLParser, XMLValidator } from 'fast-xml-parser'
import { watchPosts, postResponse, hotMessage } from './content-plugin.js'

const root = path.join(import.meta.dirname, '..')
const vite = path.join(root, 'node_modules/vite/bin/vite.js')
const config = path.join(root, 'vite.config.js')
const pluginModule = path.join(import.meta.dirname, 'content-plugin.js')
const fixture = (name) => JSON.parse(readFileSync(path.join(import.meta.dirname, 'fixtures', name), 'utf8'))
const recorded = fixture('users-repos-2026-11-24.json')
const recordedTagged = fixture('users-repos-2026-11-24-tagged.json')

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

function serveJson(body, status = 200, delayMs = 0) {
  respond = (_req, res) => {
    setTimeout(() => {
      res.writeHead(status, { 'content-type': 'application/json' })
      res.end(JSON.stringify(body))
    }, delayMs)
  }
}

const post = (title, body = '# body\n') => `---\ntitle: ${title}\ndate: 2025-01-01\ndescription: d\n---\n\n${body}`

async function scratchProject({ posts = {}, publicFiles = {} } = {}) {
  const dir = await realpath(await mkdtemp(path.join(tmpdir(), 'site-')))
  const site = path.join(dir, 'site')
  const postsDir = path.join(dir, 'posts')
  await mkdir(path.join(site, 'public'), { recursive: true })
  await mkdir(postsDir)
  await writeFile(path.join(site, 'index.html'), '<!doctype html><html><head><title>t</title></head><body></body></html>')
  await writeFile(
    path.join(site, 'vite.config.mjs'),
    `import contentPlugin from ${JSON.stringify(pluginModule)}\nexport default { plugins: [contentPlugin({ postsDir: ${JSON.stringify(postsDir)} })] }\n`,
  )
  for (const [name, text] of Object.entries({ 'FIV.pdf': '%PDF', ...publicFiles })) await writeFile(path.join(site, 'public', name), text)
  for (const [name, text] of Object.entries(posts)) await writeFile(path.join(postsDir, name), text)
  return { dir, root: site, config: path.join(site, 'vite.config.mjs'), postsDir }
}

async function build(env = {}, project = { root, config }) {
  const outDir = await mkdtemp(path.join(tmpdir(), 'site-build-'))
  const result = await new Promise((resolve) => {
    execFile(
      process.execPath,
      [vite, 'build', project.root, '--config', project.config, '--outDir', outDir, '--emptyOutDir', '--logLevel', 'error'],
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

  function recordRequests(body, status = 200) {
    const seen = []
    respond = (req, res) => {
      seen.push({ url: req.url, auth: req.headers.authorization })
      res.writeHead(status, { 'content-type': 'application/json' })
      res.end(JSON.stringify(body))
    }
    return seen
  }

  async function bundledJs(site) {
    const assets = await readdir(path.join(site.outDir, 'assets'))
    return (await Promise.all(assets.filter((f) => f.endsWith('.js')).map((f) => site.read(`assets/${f}`)))).join('\n')
  }

  it('lists repos through /user/repos with PORTFOLIO_REPOS_TOKEN and bundles a tagged private repo without its code link', async () => {
    const seen = recordRequests([...recordedTagged, privateRepo])
    const site = await build({ PORTFOLIO_REPOS_TOKEN: 'pat-value', GITHUB_TOKEN: 'actions-token' })
    expect(site.output).toBe('')
    expect(site.code).toBe(0)
    expect(seen).toEqual([{ url: '/user/repos?affiliation=owner&visibility=all&per_page=100&page=1', auth: 'Bearer pat-value' }])
    const js = await bundledJs(site)
    expect(js).toContain('title:"stealth-alpha"')
    expect(js).toMatch(/status:"in-progress",private:!0/)
    expect(js).not.toContain('github.com/thewhitelisted/stealth-alpha')
    expect(js).not.toContain('secret-branch-name')
    expect(js).not.toContain('pat-value')
    expect(js).toContain('github:"https://github.com/thewhitelisted/crowdbook"')
  }, 60000)

  it('uses the public endpoint with GITHUB_TOKEN when PORTFOLIO_REPOS_TOKEN is empty', async () => {
    const seen = recordRequests(recordedTagged)
    const site = await build({ PORTFOLIO_REPOS_TOKEN: '', GITHUB_TOKEN: 'actions-token' })
    expect(site.code).toBe(0)
    expect(seen).toEqual([{ url: '/users/thewhitelisted/repos?type=owner&per_page=100&page=1', auth: 'Bearer actions-token' }])
  }, 60000)

  it('fails, naming the secret, when PORTFOLIO_REPOS_TOKEN is rejected', async () => {
    recordRequests({ message: 'Bad credentials' }, 401)
    const { code, output } = await build({ PORTFOLIO_REPOS_TOKEN: 'expired' })
    expect(code).not.toBe(0)
    expect(output).toMatch(/HTTP 401 \(PORTFOLIO_REPOS_TOKEN is expired, revoked or wrong; replace the secret\)/)
  }, 60000)
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

  it('fails when a generated file would overwrite another output', async () => {
    serveJson(recordedTagged)
    const project = await scratchProject({ posts: { 'a.md': post('a') }, publicFiles: { 'rss.xml': '<rss/>' } })
    const { code, output } = await build({}, project)
    expect(code).not.toBe(0)
    expect(output).toMatch(/two outputs would be written to rss\.xml/)
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

async function startDev(project) {
  const port = await freePort()
  const dev = { base: `http://127.0.0.1:${port}`, output: '' }
  dev.process = spawn(
    process.execPath,
    [vite, 'serve', project.root, '--config', project.config, '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
    { cwd: root, env: { PATH: process.env.PATH, GITHUB_API_URL: apiUrl } },
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

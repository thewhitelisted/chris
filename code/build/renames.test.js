// @vitest-environment node
// Input space for repo renames:
// - .renames.json: missing, valid, invalid JSON, not an object (array, null, string), a key or value that is not a
//   lowercase repo name (uppercase, slash, empty, number), a self map, a chain (value is also a key)
// - recorded old slug that is a project slug again (fails the build) or is not (fine)
// - folders: a project slug (never looked up), unknown and GitHub has no repo, unknown and the same name (not renamed),
//   renamed to a portfolio project, renamed to a repo that is not a portfolio project, renamed to a slug whose folder
//   already exists, two folders renamed to one repo, dot folders, loose files, no devlogs folder
// - recording: first rename, renaming a renamed project again (chain collapses), renaming back to an old name
// - redirects: a rename whose project has entries, none, several entries; markup in the site URL is escaped
// - GitHub: a real 301 from the API followed by fetch with the token kept; the script end to end against a fake API
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtemp, mkdir, writeFile, readdir, readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { execFile } from 'node:child_process'
import { tmpdir } from 'node:os'
import path from 'node:path'
import {
  RENAMES_FILE,
  parseRenames,
  readRenames,
  checkRenames,
  redirectRoutes,
  redirectHtml,
  recordRename,
  serializeRenames,
  planFolderRenames,
  syncRenames,
} from './renames.js'
import { fetchRepoSlug } from './github.js'
import { ContentError } from './frontmatter.js'

const FILE = '/d/devlogs/.renames.json'
const map = (object) => new Map(Object.entries(object))

async function tree(node) {
  const dir = await mkdtemp(path.join(tmpdir(), 'renames-'))
  async function write(base, value) {
    for (const [name, child] of Object.entries(value)) {
      const target = path.join(base, name)
      if (typeof child === 'string') await writeFile(target, child)
      else {
        await mkdir(target)
        await write(target, child)
      }
    }
  }
  await write(dir, node)
  return dir
}

describe('parseRenames', () => {
  it('reads an object of old slug to current slug', () => {
    expect(parseRenames(FILE, '{"old-name": "new.name_2", "a": "b"}')).toEqual(map({ 'old-name': 'new.name_2', a: 'b' }))
    expect(parseRenames(FILE, '{}')).toEqual(new Map())
  })

  it.each([
    ['invalid JSON', '{', /is not valid JSON/],
    ['an array', '[]', /must be a JSON object/],
    ['null', 'null', /must be a JSON object/],
    ['a string', '"x"', /must be a JSON object/],
    ['an uppercase key', '{"Old": "new"}', /"Old": "new" must map one lowercase repo name to another/],
    ['an uppercase value', '{"old": "New"}', /must map one lowercase repo name/],
    ['a slash', '{"a/b": "c"}', /must map one lowercase repo name/],
    ['an empty value', '{"a": ""}', /must map one lowercase repo name/],
    ['a number value', '{"a": 1}', /"a": 1 must map/],
    ['a self map', '{"a": "a"}', /"a" maps to itself/],
    ['a chain', '{"a": "b", "b": "c"}', /"a" maps to "b", which is itself renamed; map "a" to "c"/],
  ])('rejects %s', (_label, source, message) => {
    expect(() => parseRenames(FILE, source)).toThrow(ContentError)
    expect(() => parseRenames(FILE, source)).toThrow(message)
  })
})

describe('readRenames', () => {
  it('is empty when the file is missing', async () => {
    expect(await readRenames(path.join(await tree({}), RENAMES_FILE))).toEqual(new Map())
  })

  it('parses the file', async () => {
    const dir = await tree({ [RENAMES_FILE]: '{"a": "b"}' })
    expect(await readRenames(path.join(dir, RENAMES_FILE))).toEqual(map({ a: 'b' }))
  })
})

describe('checkRenames', () => {
  it('passes when no old slug is a project slug', () => {
    expect(() => checkRenames(FILE, map({ old: 'pathos' }), ['pathos', 'crowdbook'])).not.toThrow()
  })

  it('fails when an old slug is a project slug again', () => {
    expect(() => checkRenames(FILE, map({ crowdbook: 'pathos' }), ['pathos', 'crowdbook']))
      .toThrow(/"crowdbook" is a project slug again, so its old links cannot redirect; remove it from \.renames\.json/)
  })
})

describe('redirectRoutes', () => {
  const devlogs = [
    { project: 'pathos', date: '2026-11-20' },
    { project: 'crowdbook', date: '2026-11-19' },
    { project: 'pathos', date: '2026-10-05' },
  ]

  it('maps the old timeline and every entry of the renamed project to the current pages', () => {
    expect(redirectRoutes(map({ 'old-pathos': 'pathos' }), devlogs)).toEqual([
      { from: '/projects/old-pathos', to: '/projects/pathos' },
      { from: '/projects/old-pathos/2026-11-20', to: '/projects/pathos/2026-11-20' },
      { from: '/projects/old-pathos/2026-10-05', to: '/projects/pathos/2026-10-05' },
    ])
  })

  it('writes nothing for a renamed project without entries', () => {
    expect(redirectRoutes(map({ old: 'gone' }), devlogs)).toEqual([])
    expect(redirectRoutes(new Map(), devlogs)).toEqual([])
  })
})

describe('redirectHtml', () => {
  it('refreshes to the absolute new URL with a canonical link and noindex', () => {
    const html = redirectHtml('https://example.com', '/projects/pathos/2026-11-20')
    expect(html).toContain('<meta http-equiv="refresh" content="0; url=https://example.com/projects/pathos/2026-11-20" />')
    expect(html).toContain('<link rel="canonical" href="https://example.com/projects/pathos/2026-11-20" />')
    expect(html).toContain('<meta name="robots" content="noindex" />')
    expect(html).toContain('<a href="https://example.com/projects/pathos/2026-11-20">')
  })

  it('escapes markup', () => {
    expect(redirectHtml('https://e.com/"<x>', '/p')).not.toMatch(/"<x>/)
  })
})

describe('recordRename', () => {
  it('adds a first rename', () => {
    expect(recordRename(new Map(), 'a', 'b')).toEqual(map({ a: 'b' }))
  })

  it('collapses chains when a renamed project is renamed again', () => {
    expect(recordRename(map({ a: 'b' }), 'b', 'c')).toEqual(map({ a: 'c', b: 'c' }))
  })

  it('drops the record of a name that is current again', () => {
    expect(recordRename(map({ a: 'b' }), 'b', 'a')).toEqual(map({ b: 'a' }))
  })

  it('leaves the input map unchanged', () => {
    const renames = map({ a: 'b' })
    recordRename(renames, 'b', 'c')
    expect(renames).toEqual(map({ a: 'b' }))
  })

  it('always gives a map parseRenames accepts', () => {
    let renames = new Map()
    for (const [from, to] of [['a', 'b'], ['b', 'c'], ['c', 'a'], ['a', 'd'], ['x', 'd'], ['d', 'b']]) {
      renames = recordRename(renames, from, to)
      expect(parseRenames(FILE, serializeRenames(renames))).toEqual(renames)
    }
  })
})

describe('serializeRenames', () => {
  it('writes sorted, indented JSON ending in a newline', () => {
    expect(serializeRenames(map({ b: 'x', a: 'y' }))).toBe('{\n  "a": "y",\n  "b": "x"\n}\n')
  })
})

describe('planFolderRenames', () => {
  const slugs = ['pathos', 'crowdbook', 'hexlab']
  const github = { 'old-pathos': 'pathos', 'old-crowdbook': 'crowdbook', 'other-crowdbook': 'crowdbook', plain: 'plain', untagged: 'untagged-new' }
  function lookup() {
    const asked = []
    return { asked, lookupSlug: async (name) => { asked.push(name); return github[name] ?? null } }
  }

  it('plans a rename for each folder GitHub resolves to a different project slug, never looking up known slugs', async () => {
    const { asked, lookupSlug } = lookup()
    const plan = await planFolderRenames('/d', ['pathos', 'old-crowdbook', 'ghost', 'plain', 'untagged'], slugs, lookupSlug)
    expect(plan).toEqual([{ from: 'old-crowdbook', to: 'crowdbook' }])
    expect(asked).toEqual(['old-crowdbook', 'ghost', 'plain', 'untagged'])
  })

  it('fails when the new folder already exists', async () => {
    await expect(planFolderRenames('/d', ['crowdbook', 'old-crowdbook'], slugs, lookup().lookupSlug))
      .rejects.toThrow(/old-crowdbook: the repo was renamed to crowdbook, but devlogs\/crowdbook is also that project/)
  })

  it('fails when two folders resolve to one repo', async () => {
    await expect(planFolderRenames('/d', ['old-crowdbook', 'other-crowdbook'], slugs, lookup().lookupSlug))
      .rejects.toThrow(/other-crowdbook: the repo was renamed to crowdbook, but devlogs\/old-crowdbook is also that project/)
  })
})

describe('syncRenames', () => {
  const lookupSlug = async (name) => ({ 'old-pathos': 'pathos', 'old-crowdbook': 'crowdbook' })[name] ?? null
  const slugs = ['pathos', 'crowdbook']

  it('moves renamed folders with their entries and records the old names', async () => {
    const dir = await tree({
      'old-pathos': { '2026-11-20.md': 'p' },
      'old-crowdbook': { '2026-11-19.md': 'c' },
      ghost: {},
      '.hidden': {},
      [RENAMES_FILE]: '{"older-pathos": "old-pathos", "z": "crowdbook"}',
    })
    expect(await syncRenames({ devlogsDir: dir, projectSlugs: slugs, lookupSlug })).toEqual([
      { from: 'old-crowdbook', to: 'crowdbook' },
      { from: 'old-pathos', to: 'pathos' },
    ])
    expect((await readdir(dir)).sort()).toEqual(['.hidden', RENAMES_FILE, 'crowdbook', 'ghost', 'pathos'])
    expect(await readFile(path.join(dir, 'pathos', '2026-11-20.md'), 'utf8')).toBe('p')
    expect(await readFile(path.join(dir, 'crowdbook', '2026-11-19.md'), 'utf8')).toBe('c')
    expect(JSON.parse(await readFile(path.join(dir, RENAMES_FILE), 'utf8')))
      .toEqual({ 'old-crowdbook': 'crowdbook', 'old-pathos': 'pathos', 'older-pathos': 'pathos', z: 'crowdbook' })
  })

  it('changes nothing, and writes no file, when no folder was renamed', async () => {
    const dir = await tree({ pathos: { '2026-11-20.md': 'p' }, ghost: {} })
    expect(await syncRenames({ devlogsDir: dir, projectSlugs: slugs, lookupSlug })).toEqual([])
    expect((await readdir(dir)).sort()).toEqual(['ghost', 'pathos'])
  })

  it('does nothing without a devlogs folder', async () => {
    expect(await syncRenames({ devlogsDir: path.join(await tree({}), 'missing'), projectSlugs: slugs, lookupSlug })).toEqual([])
  })

  it('moves nothing when the plan fails', async () => {
    const dir = await tree({ 'old-pathos': {}, pathos: {}, 'old-crowdbook': {} })
    await expect(syncRenames({ devlogsDir: dir, projectSlugs: slugs, lookupSlug })).rejects.toThrow(/devlogs\/pathos is also that project/)
    expect((await readdir(dir)).sort()).toEqual(['old-crowdbook', 'old-pathos', 'pathos'])
  })
})

describe('GitHub renames over HTTP', () => {
  let server
  let apiUrl
  let seen
  const repo = (name, extra = {}) => ({
    name,
    owner: { login: 'thewhitelisted' },
    private: false,
    archived: false,
    html_url: `https://github.com/thewhitelisted/${name}`,
    description: `${name} description`,
    language: 'JavaScript',
    homepage: null,
    topics: ['portfolio'],
    created_at: '2025-01-01T00:00:00Z',
    pushed_at: '2026-11-01T00:00:00Z',
    ...extra,
  })

  beforeAll(async () => {
    server = createServer((req, res) => {
      seen.push({ url: req.url, auth: req.headers.authorization })
      const send = (status, body) => {
        res.writeHead(status, { 'content-type': 'application/json' })
        res.end(JSON.stringify(body))
      }
      if (req.url.startsWith('/users/thewhitelisted/repos')) return send(200, [repo('New-Name'), repo('Pathos')])
      if (req.url === '/repos/thewhitelisted/old-name') {
        res.writeHead(301, { location: '/repositories/42' })
        return res.end()
      }
      if (req.url === '/repositories/42') return send(200, repo('New-Name'))
      send(404, { message: 'Not Found' })
    })
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    apiUrl = `http://127.0.0.1:${server.address().port}`
  })

  afterAll(() => new Promise((resolve) => server.close(resolve)))

  it('fetchRepoSlug follows the 301 with real fetch, keeping the token', async () => {
    seen = []
    expect(await fetchRepoSlug({ user: 'thewhitelisted', name: 'old-name', token: 'tkn', apiUrl })).toBe('new-name')
    expect(seen).toEqual([
      { url: '/repos/thewhitelisted/old-name', auth: 'Bearer tkn' },
      { url: '/repositories/42', auth: 'Bearer tkn' },
    ])
  })

  it('npm run sync-renames moves the folder and prints what it did', async () => {
    seen = []
    const dir = await tree({ 'old-name': { '2026-11-20.md': 'x' }, ghost: {} })
    const script = path.join(import.meta.dirname, 'sync-renames.js')
    const { code, stdout } = await new Promise((resolve) => {
      execFile(process.execPath, [script, dir], { env: { PATH: process.env.PATH, GITHUB_API_URL: apiUrl, GITHUB_TOKEN: 'actions' } },
        (error, out, err) => resolve({ code: error ? error.code : 0, stdout: out + err }))
    })
    expect(stdout).toBe('renamed devlogs/old-name to devlogs/new-name\n')
    expect(code).toBe(0)
    expect((await readdir(dir)).sort()).toEqual([RENAMES_FILE, 'ghost', 'new-name'])
    expect(await readFile(path.join(dir, RENAMES_FILE), 'utf8')).toBe('{\n  "old-name": "new-name"\n}\n')
    expect(seen.map((r) => r.url).filter((u) => !u.startsWith('/users/')).sort())
      .toEqual(['/repos/thewhitelisted/ghost', '/repos/thewhitelisted/old-name', '/repositories/42'])
    expect(seen.every((r) => r.auth === 'Bearer actions')).toBe(true)
  })

  it('the script fails loudly when GitHub errors', async () => {
    const dir = await tree({})
    const { code, stdout } = await new Promise((resolve) => {
      execFile(process.execPath, [path.join(import.meta.dirname, 'sync-renames.js'), dir], { env: { PATH: process.env.PATH, GITHUB_API_URL: `${apiUrl}/nope` } },
        (error, out, err) => resolve({ code: error ? error.code : 0, stdout: out + err }))
    })
    expect(code).not.toBe(0)
    expect(stdout).toMatch(/returned HTTP 404/)
  })
})

import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { checkLink, validateHandKept, mergeProjects } from './projects.js'
import { handKeptProjects } from '../src/projectsData.js'

const publicDir = path.join(import.meta.dirname, '../public')

const project = (overrides = {}) => ({
  slug: 's',
  title: 't',
  date: '2025-04',
  description: 'd',
  technologies: ['x'],
  type: 'Tool',
  color: '#000000',
  ...overrides,
})

describe('checkLink', () => {
  it.each(['/FIV.pdf', '/2025-christopher_lee.pdf', '/papers/about.md', '/FIV.pdf#page=2', 'https://example.com/x'])('accepts %s', (link) => {
    expect(checkLink(link, publicDir)).toBeNull()
  })

  it.each([
    ['/missing.pdf', /missing from public/],
    ['/papers', /missing from public/],
    ['/', /escapes the public folder|missing from public/],
    ['/../package.json', /escapes the public folder/],
    ['/%2e%2e/package.json', /escapes the public folder/],
    ['//evil.example/x', /neither a site-relative file nor an absolute https URL/],
    ['http://example.com', /is not https/],
    ['ftp://example.com/x', /is not https/],
    ['FIV.pdf', /neither a site-relative file nor an absolute https URL/],
    ['', /neither a site-relative file nor an absolute https URL/],
    [null, /is not a string/],
  ])('rejects %j', (link, message) => {
    expect(checkLink(link, publicDir)).toMatch(message)
  })
})

describe('validateHandKept', () => {
  it('accepts the real hand-kept list', () => {
    expect(validateHandKept(handKeptProjects, publicDir)).toBe(handKeptProjects)
  })

  it('every real hand-kept link is a public file or an https URL', () => {
    const links = handKeptProjects.flatMap((p) => ['github', 'live', 'report'].filter((f) => f in p).map((f) => p[f]))
    expect(links).toEqual(['/FIV.pdf'])
    for (const link of links) expect(checkLink(link, publicDir)).toBeNull()
  })

  it.each([
    [{ report: '/nope.pdf' }, /project s: "report" points to a file missing from public\/: \/nope\.pdf/],
    [{ github: 'http://github.com/a/b' }, /project s: "github" is not https/],
    [{ live: 'example.com' }, /project s: "live" is neither/],
    [{ github: undefined }, /project s: "github" is not a string/],
    [{ date: 'April 2025' }, /project s: Expected YYYY-MM/],
    [{ title: '' }, /project s: "title" must be a non-empty string/],
    [{ color: undefined }, /"color" must be a non-empty string/],
    [{ technologies: 'Rust' }, /"technologies" must be an array of strings/],
  ])('rejects %j', (overrides, message) => {
    expect(() => validateHandKept([project(overrides)], publicDir)).toThrow(message)
  })

  it('rejects a non-array', () => {
    expect(() => validateHandKept({}, publicDir)).toThrow('hand-kept list must be an array')
  })
})

describe('mergeProjects', () => {
  const gh = [project({ slug: 'crowdbook' })]
  const kept = [project({ slug: 'sentivest' })]

  it('puts GitHub projects first, then hand-kept ones', () => {
    expect(mergeProjects(gh, kept, { allowNoGitHubProjects: false }).map((p) => p.slug)).toEqual(['crowdbook', 'sentivest'])
  })

  it('fails when no repo is tagged, unless explicitly allowed', () => {
    expect(() => mergeProjects([], kept, { allowNoGitHubProjects: false })).toThrow(/no public GitHub repo has the portfolio topic.*ALLOW_NO_GITHUB_PROJECTS=1/)
    expect(mergeProjects([], kept, { allowNoGitHubProjects: true })).toEqual(kept)
  })

  it('fails on a slug used twice', () => {
    expect(() => mergeProjects(gh, [project({ slug: 'crowdbook' })], { allowNoGitHubProjects: false })).toThrow('two projects share the slug "crowdbook"')
  })
})

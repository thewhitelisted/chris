import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { checkLink, validateHandKept, mergeProjects, allowNoGitHubProjects } from './projects.js'
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
    ['/../public2/FIV.pdf', /escapes the public folder/],
    ['/../publicity.pdf', /escapes the public folder/],
    ['//evil.example/x', /neither a site-relative file nor an absolute https URL/],
    ['http://example.com', /is not https/],
    ['ftp://example.com/x', /is not https/],
    ['FIV.pdf', /neither a site-relative file nor an absolute https URL/],
    ['', /neither a site-relative file nor an absolute https URL/],
    ['/FIV%.pdf', /has malformed %-encoding: \/FIV%\.pdf/],
    ['/%E0%A4%A.pdf', /has malformed %-encoding/],
    [null, /is not a string/],
  ])('rejects %j', (link, message) => {
    expect(checkLink(link, publicDir)).toMatch(message)
  })
})

describe('validateHandKept', () => {
  it('accepts the real hand-kept list, which is only the financial viscosity indicator', () => {
    expect(validateHandKept(handKeptProjects, publicDir)).toEqual(handKeptProjects.map((p) => ({ ...p, status: 'complete', private: false })))
    expect(handKeptProjects).toEqual([{
      title: 'financial viscosity indicator',
      date: '2025-04',
      description: 'A physics-inspired market stability indicator combining price displacement and velocity; tested on SPY 2020–2025. My post on it got 25,000+ views.',
      technologies: ['Mathematics', 'Differential Equations', 'Financial Modeling', 'Research'],
      type: 'Research',
      report: '/FIV.pdf',
      color: '#3b82f6',
      slug: 'financial-viscosity-indicator',
    }])
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
    [{ report: '/FIV%.pdf' }, /hand-kept project s: "report" has malformed %-encoding/],
    [{ title: 'a\u0000b' }, /hand-kept project s: contains the control character U\+0000/],
    [{ description: 'a\u001Bb' }, /hand-kept project s: contains the control character U\+001B/],
    [{ technologies: ['ok', 'b\uFFFE'] }, /hand-kept project s: contains the control character U\+FFFE/],
    [{ status: 'done' }, /hand-kept project s: "status" must be one of in-progress, complete, archived, got "done"/],
    [{ status: undefined }, /"status" must be one of/],
    [{ private: true }, /hand-kept project s: "private" is only set for GitHub repos/],
  ])('rejects %j', (overrides, message) => {
    expect(() => validateHandKept([project(overrides)], publicDir)).toThrow(message)
  })

  it.each(['in-progress', 'complete', 'archived'])('keeps status %s', (status) => {
    expect(validateHandKept([project({ status })], publicDir)[0].status).toBe(status)
  })

  it('defaults status to complete and marks the project public', () => {
    expect(validateHandKept([project()], publicDir)[0]).toMatchObject({ status: 'complete', private: false })
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
    expect(() => mergeProjects([], kept, { allowNoGitHubProjects: false })).toThrow(/no GitHub repo has the portfolio topic.*ALLOW_NO_GITHUB_PROJECTS=1/)
    expect(mergeProjects([], kept, { allowNoGitHubProjects: true })).toEqual(kept)
  })

  it.each([
    [{ ALLOW_NO_GITHUB_PROJECTS: '1' }, true],
    [{ ALLOW_NO_GITHUB_PROJECTS: '0' }, false],
    [{ ALLOW_NO_GITHUB_PROJECTS: 'true' }, false],
    [{ ALLOW_NO_GITHUB_PROJECTS: '' }, false],
    [{ ALLOW_NO_GITHUB_PROJECTS: ' 1' }, false],
    [{}, false],
  ])('allowNoGitHubProjects(%j) is %s', (env, expected) => {
    expect(allowNoGitHubProjects(env)).toBe(expected)
  })

  it('fails on a slug used twice', () => {
    expect(() => mergeProjects(gh, [project({ slug: 'crowdbook' })], { allowNoGitHubProjects: false })).toThrow('two projects share the slug "crowdbook"')
  })
})

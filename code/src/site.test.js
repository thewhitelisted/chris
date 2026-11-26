// Input space: no posts / projects / devlogs; posts only; a project with entries, a project without; several entries
// for one project; an entry whose project is missing; trailing slashes, unknown paths and case for titleFor.
import { describe, it, expect } from 'vitest'
import { sitePages, titleFor, devlogTitle, SITE_NAME } from './site.js'

const posts = [
  { slug: 'handling-adhd', title: 'how i deal with having adhd', date: '2025-06-18', description: 'd1' },
  { slug: 'first-work-experience', title: 'my first work experience in finance', date: '2026-04-25', description: 'd2' },
]
const projects = [
  { slug: 'pathos', title: 'Pathos', description: 'A sentiment optimizer' },
  { slug: 'crowdbook', title: 'crowdbook', description: 'An order book simulator' },
  { slug: 'financial-viscosity-indicator', title: 'financial viscosity indicator', description: 'An indicator' },
]
const devlogs = [
  { project: 'financial-viscosity-indicator', date: '2026-11-20', title: 'revisiting', description: 'e3' },
  { project: 'pathos', date: '2026-11-02', title: 'fills & <slippage>', description: 'e2' },
  { project: 'pathos', date: '2026-10-05', title: 'first take', description: 'e1' },
]
const content = { posts, projects, devlogs }
const STATIC_PATHS = ['/', '/about', '/projects', '/blog', '/now', '/music', '/hobbies']

describe('sitePages', () => {
  it('lists the static routes, the posts, then each project with entries and each entry', () => {
    expect(sitePages(content).map((p) => p.path)).toEqual([
      ...STATIC_PATHS,
      '/blog/handling-adhd',
      '/blog/first-work-experience',
      '/projects/pathos',
      '/projects/financial-viscosity-indicator',
      '/projects/financial-viscosity-indicator/2026-11-20',
      '/projects/pathos/2026-11-02',
      '/projects/pathos/2026-10-05',
    ])
  })

  it('gives posts and devlog entries article meta, and names the project in devlog titles', () => {
    const pages = sitePages(content)
    expect(pages.find((p) => p.path === '/blog/first-work-experience')).toEqual({
      path: '/blog/first-work-experience',
      title: 'my first work experience in finance',
      description: 'd2',
      type: 'article',
      published: '2026-04-25',
    })
    expect(pages.find((p) => p.path === '/projects/pathos')).toEqual({
      path: '/projects/pathos',
      title: 'Pathos devlog · Christopher Lee',
      description: 'A sentiment optimizer',
    })
    expect(pages.find((p) => p.path === '/projects/pathos/2026-11-02')).toEqual({
      path: '/projects/pathos/2026-11-02',
      title: 'Pathos devlog: fills & <slippage>',
      description: 'e2',
      type: 'article',
      published: '2026-11-02',
    })
    expect(pages.find((p) => p.path === '/now')).toEqual({ path: '/now', title: 'Now · Christopher Lee', description: 'What Christopher Lee is working on now.' })
  })

  it('has no page for a project without entries', () => {
    expect(sitePages(content).some((p) => p.path === '/projects/crowdbook')).toBe(false)
  })

  it('has only the static pages, /now included, when there is no content', () => {
    expect(sitePages({ posts: [], projects: [], devlogs: [] }).map((p) => p.path)).toEqual(STATIC_PATHS)
  })

  it('fails on an entry whose project is missing', () => {
    expect(() => sitePages({ posts, projects: projects.slice(1), devlogs })).toThrow('devlog pathos/2026-11-02 belongs to no project')
  })
})

describe('devlogTitle', () => {
  it('puts the project first', () => {
    expect(devlogTitle('Pathos', 'first take')).toBe('Pathos devlog: first take')
  })
})

describe('titleFor', () => {
  it.each([
    ['/', SITE_NAME],
    ['/about', 'About · Christopher Lee'],
    ['/about/', 'About · Christopher Lee'],
    ['/about///', 'About · Christopher Lee'],
    ['/blog/handling-adhd//', 'how i deal with having adhd'],
    ['/hobbies', 'Interests · Christopher Lee'],
    ['/blog', 'Blog · Christopher Lee'],
    ['/blog/', 'Blog · Christopher Lee'],
    ['/blog/handling-adhd', 'how i deal with having adhd'],
    ['/blog/first-work-experience/', 'my first work experience in finance'],
    ['/now', 'Now · Christopher Lee'],
    ['/projects/pathos', 'Pathos devlog · Christopher Lee'],
    ['/projects/pathos/', 'Pathos devlog · Christopher Lee'],
    ['/projects/pathos/2026-10-05', 'Pathos devlog: first take'],
    ['/projects/crowdbook', SITE_NAME],
    ['/projects/pathos/2026-10-06', SITE_NAME],
    ['/blog/unknown', SITE_NAME],
    ['/nowhere', SITE_NAME],
    ['/About', SITE_NAME],
  ])('%s -> %s', (pathname, title) => {
    expect(titleFor(pathname, content)).toBe(title)
  })
})

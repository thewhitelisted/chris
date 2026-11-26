import { describe, it, expect } from 'vitest'
import { projects } from 'virtual:projects'
import { devlogs } from 'virtual:devlogs'
import { blogPosts } from 'virtual:posts'
import { blogListItems, entriesOf, entryBodyUrl, entryPath, findEntry, findTimeline, nowProjects, plural, timelinePath } from './devlogs.js'

// Input classes: project with several entries, one entry, none (complete and in-progress), unknown slug,
// a date of another project, an entry whose project is missing, no in-progress projects.

const slugs = (list) => list.map((p) => p.slug)

describe('paths', () => {
  it('builds the timeline, entry and body paths', () => {
    expect(timelinePath('stealth-alpha')).toBe('/projects/stealth-alpha')
    expect(entryPath(devlogs[0])).toBe('/projects/stealth-alpha/2026-11-20')
    expect(entryBodyUrl(devlogs[0])).toBe('/devlogs/stealth-alpha/2026-11-20.md')
  })

  it('percent-encodes the project and date in the body URL, like BlogPost does for slugs', () => {
    expect(entryBodyUrl({ project: 'a b#c/d', date: '2026-11-20?x' })).toBe('/devlogs/a%20b%23c%2Fd/2026-11-20%3Fx.md')
  })

  it('pluralises by count', () => {
    expect([0, 1, 2].map((n) => plural(n, 'update'))).toEqual(['0 updates', '1 update', '2 updates'])
  })
})

describe('entriesOf', () => {
  it('keeps the newest-first order of virtual:devlogs', () => {
    expect(entriesOf(devlogs, 'stealth-alpha').map((e) => e.date)).toEqual(['2026-11-20', '2026-10-05'])
    expect(entriesOf(devlogs, 'shipped')).toEqual([])
  })
})

describe('findTimeline', () => {
  it('returns the project and its entries', () => {
    const { project, entries } = findTimeline(projects, devlogs, 'stealth-alpha')
    expect(project.slug).toBe('stealth-alpha')
    expect(entries.map((e) => e.title)).toEqual(['fills & <slippage>', 'first take'])
  })

  it('is null for an unknown slug and for a project with no entries', () => {
    expect(findTimeline(projects, devlogs, 'nope')).toBeNull()
    expect(findTimeline(projects, devlogs, 'shipped')).toBeNull()
    expect(findTimeline(projects, devlogs, 'quiet')).toBeNull()
    expect(findTimeline(projects, devlogs, 'Stealth-Alpha')).toBeNull()
  })
})

describe('findEntry', () => {
  it('returns the entry and its project', () => {
    const { project, entry } = findEntry(projects, devlogs, 'notes', '2026-11-02')
    expect([project.slug, entry.title]).toEqual(['notes', 'vol of vol'])
  })

  it("is null for an unknown slug, an unknown date, or another project's date", () => {
    expect(findEntry(projects, devlogs, 'nope', '2026-11-20')).toBeNull()
    expect(findEntry(projects, devlogs, 'stealth-alpha', '2026-11-21')).toBeNull()
    expect(findEntry(projects, devlogs, 'notes', '2026-11-20')).toBeNull()
  })

  it('fails loudly when an entry has no project', () => {
    expect(() => findEntry([], devlogs, 'notes', '2026-11-02')).toThrow('devlog notes/2026-11-02 belongs to no project')
  })
})

describe('blogListItems', () => {
  it('lists posts then entries, entries tagged with the project title and linking to the entry page', () => {
    expect(blogListItems(blogPosts, devlogs, projects).map(({ key, title, date, path, project }) => [key, title, date, path, project])).toEqual([
      ['post:handling-adhd', 'how i deal with having adhd', '2025-06-18', '/blog/handling-adhd', null],
      ['post:r-and-d', 'R&D <notes>', '2026-01-01', '/blog/r-and-d', null],
      ['devlog:stealth-alpha/2026-11-20', 'fills & <slippage>', '2026-11-20', '/projects/stealth-alpha/2026-11-20', 'stealth-alpha'],
      ['devlog:notes/2026-11-02', 'vol of vol', '2026-11-02', '/projects/notes/2026-11-02', 'notes'],
      ['devlog:stealth-alpha/2026-10-05', 'first take', '2026-10-05', '/projects/stealth-alpha/2026-10-05', 'stealth-alpha'],
      ['devlog:shelved/2026-02-10', 'shelving it', '2026-02-10', '/projects/shelved/2026-02-10', 'shelved'],
    ])
  })

  it('searches posts by title and slug, entries by title, project and "devlog"', () => {
    const items = blogListItems(blogPosts, devlogs, projects)
    expect(items[0].searchText).toEqual(['how i deal with having adhd', 'handling-adhd'])
    expect(items[2].searchText).toEqual(['fills & <slippage>', 'stealth-alpha', 'devlog'])
  })

  it('fails loudly when an entry has no project', () => {
    expect(() => blogListItems(blogPosts, devlogs, projects.filter((p) => p.slug !== 'shelved'))).toThrow('devlog shelved/2026-02-10 belongs to no project')
  })
})

describe('nowProjects', () => {
  it('lists in-progress projects newest first, each with its latest entry or null', () => {
    expect(nowProjects(projects, devlogs).map(({ project, latest }) => [project.slug, latest?.date ?? null])).toEqual([
      ['stealth-alpha', '2026-11-20'],
      ['quiet', null],
      ['fresh', null],
      ['notes', '2026-11-02'],
    ])
  })

  it('breaks date ties by title and leaves the input untouched', () => {
    const tied = [
      { ...projects[1], slug: 'b', title: 'b', date: '2026-09' },
      { ...projects[1], slug: 'a', title: 'a', date: '2026-09' },
    ]
    expect(slugs(nowProjects(tied, []).map((n) => n.project))).toEqual(['a', 'b'])
    expect(slugs(tied)).toEqual(['b', 'a'])
  })

  it('is empty when nothing is in progress', () => {
    expect(nowProjects(projects.filter((p) => p.status !== 'in-progress'), devlogs)).toEqual([])
  })
})

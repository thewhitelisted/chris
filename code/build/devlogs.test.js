// Input space for devlog loading:
// - devlogs folder: missing, empty, a file instead of a folder, dotfiles at the top level
// - project folder: matching slug, unknown slug, wrong case, a stray file beside the folders, empty folder
// - entries: zero, one, many across projects, dotfiles, nested folder, wrong extension, bad file name
//   (prose, short, timestamp), impossible calendar date, frontmatter date equal / not equal to the name
// - ordering: different dates, same date in two projects
// - unknown-slug mode: fail (token set, listing complete) or skip (no token); in skip mode every other check still
//   fails, inside skipped folders too (nested folder, bad name, date mismatch, frontmatter), and stray files still fail
// - duplicates: same project and date (only reachable through checkUniqueDates; the file system keeps names unique)
// Frontmatter rules themselves are shared with posts and covered in posts.test.js.
import { describe, it, expect } from 'vitest'
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { parseDevlogEntry, checkUniqueDates, sortDevlogsNewestFirst, loadDevlogs, devlogIndex, skippedDevlogsWarning } from './devlogs.js'
import { ContentError } from './frontmatter.js'

const entry = (date, title = 't', body = '# Body\n') => `---\ntitle: ${title}\ndate: ${date}\ndescription: d\n---\n\n${body}`

async function devlogsDir(tree) {
  const dir = await mkdtemp(path.join(tmpdir(), 'devlogs-'))
  async function write(base, node) {
    for (const [name, value] of Object.entries(node)) {
      const target = path.join(base, name)
      if (typeof value === 'string') await writeFile(target, value)
      else {
        await mkdir(target)
        await write(target, value)
      }
    }
  }
  await write(dir, tree)
  return dir
}

describe('parseDevlogEntry', () => {
  it('reads the project from the folder and the fields from the frontmatter', () => {
    expect(parseDevlogEntry('devlogs/pathos/2026-11-26.md', entry('2026-11-26', 'first take', '# Hi\n'))).toEqual({
      file: 'devlogs/pathos/2026-11-26.md',
      project: 'pathos',
      date: '2026-11-26',
      title: 'first take',
      description: 'd',
      body: '# Hi\n',
    })
  })

  it('fails when the frontmatter date differs from the file name', () => {
    expect(() => parseDevlogEntry('devlogs/p/2026-11-26.md', entry('2026-11-25')))
      .toThrow('devlogs/p/2026-11-26.md: frontmatter date 2026-11-25 does not match the file name date 2026-11-26')
  })

  it.each(['notes.md', '2026-1-26.md', '2026-11-26.markdown', '2026-11-26.MD', '2026-11-26T10:00.md', '2026-11-26-extra.md', 'x2026-11-26.md'])(
    'rejects the file name %s',
    (name) => {
      expect(() => parseDevlogEntry(`devlogs/p/${name}`, entry('2026-11-26'))).toThrow(/must be named YYYY-MM-DD\.md/)
    },
  )

  it('rejects an impossible date even when name and frontmatter agree', () => {
    expect(() => parseDevlogEntry('devlogs/p/2025-02-29.md', entry('2025-02-29'))).toThrow(/not a real calendar date/)
  })

  it('applies the post frontmatter rules, naming the file', () => {
    expect(() => parseDevlogEntry('devlogs/p/2026-11-26.md', '---\ntitle: t\ndate: 2026-11-26\n---\n\nbody\n'))
      .toThrow('devlogs/p/2026-11-26.md: missing frontmatter field "description"')
    expect(() => parseDevlogEntry('devlogs/p/2026-11-26.md', entry('2026-11-26', 't', '\n')))
      .toThrow(/body after the frontmatter is empty/)
  })
})

describe('checkUniqueDates', () => {
  it('allows the same date in two projects', () => {
    expect(() => checkUniqueDates([{ project: 'a', date: '2026-01-01', file: 'a' }, { project: 'b', date: '2026-01-01', file: 'b' }])).not.toThrow()
  })

  it('names both files when a project repeats a date', () => {
    expect(() => checkUniqueDates([
      { project: 'a', date: '2026-01-01', file: 'x/a' },
      { project: 'a', date: '2026-01-02', file: 'y' },
      { project: 'a', date: '2026-01-01', file: 'z/a' },
    ])).toThrow('z/a: duplicate devlog date 2026-01-01 for project "a" (also used by x/a)')
  })
})

describe('sortDevlogsNewestFirst', () => {
  it('orders by date descending, then project, without mutating', () => {
    const entries = [
      { project: 'b', date: '2026-01-01' },
      { project: 'c', date: '2026-03-04' },
      { project: 'a', date: '2026-01-01' },
    ]
    expect(sortDevlogsNewestFirst(entries).map((e) => e.project)).toEqual(['c', 'a', 'b'])
    expect(entries.map((e) => e.project)).toEqual(['b', 'c', 'a'])
  })
})

describe('loadDevlogs', () => {
  const slugs = ['pathos', 'crowdbook', 'financial-viscosity-indicator']
  const strict = async (dir) => {
    const { entries, skipped } = await loadDevlogs(dir, slugs, { skipUnknownProjects: false })
    expect(skipped).toEqual([])
    return entries
  }

  it('returns no entries when the devlogs folder does not exist', async () => {
    expect(await strict(path.join(await devlogsDir({}), 'devlogs'))).toEqual([])
  })

  it('returns no entries for an empty folder or an empty project folder', async () => {
    expect(await strict(await devlogsDir({}))).toEqual([])
    expect(await strict(await devlogsDir({ pathos: {} }))).toEqual([])
  })

  it('loads entries across projects, newest first, ignoring dotfiles at both levels', async () => {
    const dir = await devlogsDir({
      '.DS_Store': 'junk',
      pathos: { '2026-10-01.md': entry('2026-10-01', 'old'), '2026-11-20.md': entry('2026-11-20', 'new'), '.DS_Store': 'junk' },
      'financial-viscosity-indicator': { '2026-11-20.md': entry('2026-11-20', 'fvi') },
    })
    const loaded = await strict(dir)
    expect(loaded.map((e) => [e.project, e.date, e.title])).toEqual([
      ['financial-viscosity-indicator', '2026-11-20', 'fvi'],
      ['pathos', '2026-11-20', 'new'],
      ['pathos', '2026-10-01', 'old'],
    ])
    expect(loaded[0].file).toBe(path.join(dir, 'financial-viscosity-indicator', '2026-11-20.md'))
    expect(loaded[0].body).toBe('# Body\n')
    expect(devlogIndex(loaded)[0]).toEqual({ project: 'financial-viscosity-indicator', date: '2026-11-20', title: 'fvi', description: 'd' })
  })

  it('fails on a folder that is not a project slug, listing the slugs', async () => {
    const dir = await devlogsDir({ ghost: { '2026-11-20.md': entry('2026-11-20') } })
    await expect(strict(dir)).rejects.toThrow(`${path.join(dir, 'ghost')}: "ghost" is not a project slug; use one of: pathos, crowdbook, financial-viscosity-indicator`)
  })

  it('matches the slug case-sensitively', async () => {
    const dir = await devlogsDir({ Pathos: { '2026-11-20.md': entry('2026-11-20') } })
    await expect(strict(dir)).rejects.toThrow(/"Pathos" is not a project slug/)
  })

  it('fails on a stray file beside the project folders', async () => {
    const dir = await devlogsDir({ 'README.md': 'x', pathos: {} })
    await expect(strict(dir)).rejects.toThrow(/README\.md: only project folders belong in the devlogs folder/)
  })

  it('fails on a nested folder inside a project folder', async () => {
    const dir = await devlogsDir({ pathos: { drafts: { '2026-11-20.md': entry('2026-11-20') } } })
    await expect(strict(dir)).rejects.toThrow(/drafts: only YYYY-MM-DD\.md files belong in a project devlog folder/)
  })

  it('fails on a stray file inside a project folder', async () => {
    const dir = await devlogsDir({ pathos: { 'notes.txt': 'x' } })
    await expect(strict(dir)).rejects.toThrow(/notes\.txt: devlog entries must be named YYYY-MM-DD\.md/)
  })

  it('fails when the devlogs path is a file', async () => {
    const dir = await devlogsDir({ devlogs: 'not a folder' })
    await expect(strict(path.join(dir, 'devlogs'))).rejects.toThrow(ContentError)
  })

  it('fails on one invalid entry among valid ones, naming it', async () => {
    const dir = await devlogsDir({ pathos: { '2026-11-20.md': entry('2026-11-20'), '2026-11-21.md': entry('2026-11-20') } })
    await expect(strict(dir)).rejects.toThrow(/2026-11-21\.md: frontmatter date 2026-11-20 does not match/)
  })
})

describe('loadDevlogs skipping unknown projects (no PORTFOLIO_REPOS_TOKEN)', () => {
  const slugs = ['pathos']
  const skipping = (dir) => loadDevlogs(dir, slugs, { skipUnknownProjects: true })

  it('skips folders that match no listed project, keeps the rest, and names what it skipped', async () => {
    const dir = await devlogsDir({
      pathos: { '2026-11-20.md': entry('2026-11-20', 'kept') },
      'secret-proj': { '2026-11-21.md': entry('2026-11-21', 'hidden') },
      ghost: { '2026-11-22.md': entry('2026-11-22', 'also hidden') },
    })
    const { entries, skipped } = await skipping(dir)
    expect(entries.map((e) => [e.project, e.title])).toEqual([['pathos', 'kept']])
    expect(skipped.slice().sort()).toEqual(['ghost', 'secret-proj'])
  })

  it('skips an empty unknown folder too', async () => {
    expect(await skipping(await devlogsDir({ ghost: {} }))).toEqual({ entries: [], skipped: ['ghost'] })
  })

  it('returns nothing skipped when every folder is known', async () => {
    expect((await skipping(await devlogsDir({ pathos: { '2026-11-20.md': entry('2026-11-20') } }))).skipped).toEqual([])
  })

  it.each([
    ['a nested folder', { drafts: {} }, /drafts: only YYYY-MM-DD\.md files belong/],
    ['a bad file name', { 'notes.md': entry('2026-11-20') }, /notes\.md: devlog entries must be named YYYY-MM-DD\.md/],
    ['a date mismatch', { '2026-11-20.md': entry('2026-11-21') }, /frontmatter date 2026-11-21 does not match the file name date 2026-11-20/],
    ['broken frontmatter', { '2026-11-20.md': '---\ntitle: t\ndate: 2026-11-20\n---\n\nbody\n' }, /missing frontmatter field "description"/],
    ['an empty body', { '2026-11-20.md': entry('2026-11-20', 't', '\n') }, /body after the frontmatter is empty/],
  ])('still fails on %s inside a skipped folder', async (_name, files, message) => {
    const dir = await devlogsDir({ 'secret-proj': files })
    await expect(skipping(dir)).rejects.toThrow(message)
  })

  it('still fails on a stray file beside the project folders', async () => {
    await expect(skipping(await devlogsDir({ 'notes.md': 'x' }))).rejects.toThrow(/only project folders belong/)
  })

  it('returns nothing for a missing folder', async () => {
    expect(await skipping(path.join(await devlogsDir({}), 'devlogs'))).toEqual({ entries: [], skipped: [] })
  })
})

describe('skippedDevlogsWarning', () => {
  it('names each skipped folder and the missing token', () => {
    expect(skippedDevlogsWarning(['a', 'b'])).toBe(
      'devlogs: skipped devlogs/a, devlogs/b: no listed project has that slug. ' +
        'PORTFOLIO_REPOS_TOKEN is not set, so private repos are not listed; set it to build their devlogs',
    )
  })
})

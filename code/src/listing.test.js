import { describe, it, expect } from 'vitest'
import { INITIAL_SORT, PROJECTS_INITIAL_SORT, nextSort, sortItems, filterItems } from './listing.js'

const items = [
  { title: 'beta', date: '2025-03', type: 'Tool', tags: ['Rust'] },
  { title: 'alpha', date: '2025-06', type: 'Bot', tags: ['Python'] },
  { title: 'gamma', date: '2021-07', type: 'Tool', tags: ['JavaScript'] },
  { title: 'delta', date: '2025-03', type: 'Model', tags: [] },
]
const titles = (list) => list.map((item) => item.title)

describe('nextSort', () => {
  it('starts on date, newest first', () => {
    expect(INITIAL_SORT).toEqual({ key: 'date', dir: 'desc' })
  })

  it('flips direction when the active column is clicked again', () => {
    expect(nextSort({ key: 'date', dir: 'desc' }, 'date')).toEqual({ key: 'date', dir: 'asc' })
    expect(nextSort({ key: 'date', dir: 'asc' }, 'date')).toEqual({ key: 'date', dir: 'desc' })
    expect(nextSort({ key: 'name', dir: 'asc' }, 'name')).toEqual({ key: 'name', dir: 'desc' })
  })

  it('opens date newest-first and other columns ascending', () => {
    expect(nextSort({ key: 'name', dir: 'desc' }, 'date')).toEqual({ key: 'date', dir: 'desc' })
    expect(nextSort({ key: 'date', dir: 'asc' }, 'name')).toEqual({ key: 'name', dir: 'asc' })
    expect(nextSort({ key: 'date', dir: 'desc' }, 'type')).toEqual({ key: 'type', dir: 'asc' })
  })
})

describe('sortItems', () => {
  it('sorts by date descending, keeping ties in source order', () => {
    expect(titles(sortItems(items, { key: 'date', dir: 'desc' }))).toEqual(['alpha', 'beta', 'delta', 'gamma'])
  })

  it('sorts by date ascending, keeping ties in source order', () => {
    expect(titles(sortItems(items, { key: 'date', dir: 'asc' }))).toEqual(['gamma', 'beta', 'delta', 'alpha'])
  })

  it('sorts by name in both directions', () => {
    expect(titles(sortItems(items, { key: 'name', dir: 'asc' }))).toEqual(['alpha', 'beta', 'delta', 'gamma'])
    expect(titles(sortItems(items, { key: 'name', dir: 'desc' }))).toEqual(['gamma', 'delta', 'beta', 'alpha'])
  })

  it('sorts by type in both directions', () => {
    expect(titles(sortItems(items, { key: 'type', dir: 'asc' }))).toEqual(['alpha', 'delta', 'beta', 'gamma'])
    expect(titles(sortItems(items, { key: 'type', dir: 'desc' }))).toEqual(['beta', 'gamma', 'delta', 'alpha'])
  })

  it('sorts projects by status, in-progress first, newest first within a status', () => {
    const projects = [
      { title: 'old-done', date: '2024-01', status: 'complete' },
      { title: 'shelved', date: '2025-09', status: 'archived' },
      { title: 'wip-old', date: '2025-01', status: 'in-progress' },
      { title: 'new-done', date: '2026-02', status: 'complete' },
      { title: 'wip-new', date: '2026-10', status: 'in-progress' },
    ]
    expect(PROJECTS_INITIAL_SORT).toEqual({ key: 'status', dir: 'asc' })
    expect(titles(sortItems(projects, PROJECTS_INITIAL_SORT))).toEqual(['wip-new', 'wip-old', 'new-done', 'old-done', 'shelved'])
    expect(titles(sortItems(projects, { key: 'status', dir: 'desc' }))).toEqual(['shelved', 'old-done', 'new-done', 'wip-old', 'wip-new'])
    expect(nextSort(INITIAL_SORT, 'status')).toEqual({ key: 'status', dir: 'asc' })
  })

  it('rejects an unknown project status when sorting by status', () => {
    expect(() => sortItems([{ title: 'a', date: '2025-01', status: 'done' }, { title: 'b', date: '2025-02', status: 'complete' }], PROJECTS_INITIAL_SORT)).toThrow('Unknown project status: "done"')
  })

  it('does not mutate its input', () => {
    const before = titles(items)
    sortItems(items, { key: 'name', dir: 'desc' })
    expect(titles(items)).toEqual(before)
  })

  it('handles empty and single-item lists', () => {
    expect(sortItems([], INITIAL_SORT)).toEqual([])
    expect(titles(sortItems([items[0]], INITIAL_SORT))).toEqual(['beta'])
  })

  it('rejects an unknown sort key', () => {
    expect(() => sortItems(items, { key: 'size', dir: 'asc' })).toThrow('Unknown sort key')
  })
})

describe('filterItems', () => {
  const text = (item) => [item.title, ...item.tags]

  it('returns everything for an empty query', () => {
    expect(titles(filterItems(items, '', text))).toEqual(titles(items))
  })

  it('matches any searchable field, case-insensitively', () => {
    expect(titles(filterItems(items, 'ALP', text))).toEqual(['alpha'])
    expect(titles(filterItems(items, 'rust', text))).toEqual(['beta'])
    expect(titles(filterItems(items, 'a', text))).toEqual(['beta', 'alpha', 'gamma', 'delta'])
  })

  it('returns nothing when no field matches', () => {
    expect(filterItems(items, 'zzz', text)).toEqual([])
  })

  it('does not match fields outside searchableText', () => {
    expect(filterItems(items, 'Tool', text)).toEqual([])
  })
})

import { describe, it, expect } from 'vitest'
import { formatDate, compareIsoDates } from './dates.js'
import { blogPosts } from './blogData.js'
import { projects } from './projectsData.js'

describe('formatDate', () => {
  it.each([
    ['2025-06-18', '18 June, 2025'],
    ['2025-06-05', '5 June, 2025'],
    ['2025-01-01', '1 January, 2025'],
    ['2025-12-31', '31 December, 2025'],
    ['2024-02-29', '29 February, 2024'],
    ['2025-04', 'April 2025'],
    ['2021-07', 'July 2021'],
    ['2025-01', 'January 2025'],
    ['2025-12', 'December 2025'],
  ])('formats %s as %s', (iso, expected) => {
    expect(formatDate(iso)).toBe(expected)
  })

  it.each([
    '',
    'June 2025',
    '18 June, 2025',
    '2025-6',
    '2025-06-1',
    '25-06-18',
    '2025-06-18T00:00:00Z',
    '2025/06/18',
    '2025-00',
    '2025-13',
    '2025-06-00',
    '2025-06-31',
    '2025-02-29',
    undefined,
  ])('rejects %j', (bad) => {
    expect(() => formatDate(bad)).toThrow()
  })

  it('keeps the display text the site showed before the ISO migration', () => {
    expect(blogPosts.map((p) => formatDate(p.date))).toEqual(['18 June, 2025'])
    expect(projects.map((p) => formatDate(p.date))).toEqual([
      'April 2025', 'March 2025', 'March 2025', 'June 2025', 'July 2025', 'July 2021',
    ])
  })
})

describe('compareIsoDates', () => {
  it('orders by year, then month, then day', () => {
    expect(compareIsoDates('2021-07', '2025-03')).toBeLessThan(0)
    expect(compareIsoDates('2025-03', '2025-04')).toBeLessThan(0)
    expect(compareIsoDates('2025-06-09', '2025-06-18')).toBeLessThan(0)
    expect(compareIsoDates('2025-12-31', '2026-01-01')).toBeLessThan(0)
    expect(compareIsoDates('2025-04', '2025-03')).toBeGreaterThan(0)
  })

  it('treats identical dates as equal', () => {
    expect(compareIsoDates('2025-03', '2025-03')).toBe(0)
    expect(compareIsoDates('2025-06-18', '2025-06-18')).toBe(0)
  })

  it('places a month-only date before any day in that month', () => {
    expect(compareIsoDates('2025-04', '2025-04-01')).toBeLessThan(0)
    expect(compareIsoDates('2025-04', '2025-03-31')).toBeGreaterThan(0)
  })

  it('rejects malformed input instead of guessing', () => {
    expect(() => compareIsoDates('April 2025', '2025-04')).toThrow()
    expect(() => compareIsoDates('2025-04', 'April 2025')).toThrow()
  })
})

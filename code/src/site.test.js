import { describe, it, expect } from 'vitest'
import { sitePages, titleFor, SITE_NAME } from './site.js'

const posts = [
  { slug: 'handling-adhd', title: 'how i deal with having adhd', date: '2025-06-18', description: 'd1' },
  { slug: 'first-work-experience', title: 'my first work experience in finance', date: '2026-04-25', description: 'd2' },
]

describe('sitePages', () => {
  it('lists the static routes then one article page per post', () => {
    expect(sitePages(posts).map((p) => p.path)).toEqual([
      '/', '/about', '/projects', '/blog', '/music', '/hobbies', '/blog/handling-adhd', '/blog/first-work-experience',
    ])
    expect(sitePages(posts).at(-1)).toEqual({
      path: '/blog/first-work-experience',
      title: 'my first work experience in finance',
      description: 'd2',
      type: 'article',
      published: '2026-04-25',
    })
  })
})

describe('titleFor', () => {
  it.each([
    ['/', SITE_NAME],
    ['/about', 'About · Christopher Lee'],
    ['/about/', 'About · Christopher Lee'],
    ['/hobbies', 'Interests · Christopher Lee'],
    ['/blog', 'Blog · Christopher Lee'],
    ['/blog/', 'Blog · Christopher Lee'],
    ['/blog/handling-adhd', 'how i deal with having adhd'],
    ['/blog/first-work-experience/', 'my first work experience in finance'],
    ['/blog/unknown', SITE_NAME],
    ['/nowhere', SITE_NAME],
    ['/About', SITE_NAME],
  ])('%s -> %s', (pathname, title) => {
    expect(titleFor(pathname, posts)).toBe(title)
  })
})

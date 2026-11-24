import { describe, it, expect } from 'vitest'
import { XMLParser, XMLValidator } from 'fast-xml-parser'
import { escapeMarkup, rfc822, renderRss, headTags, withHead, pageFiles } from './feeds.js'

const SITE = 'https://www.christopherjlee.ca'
const nasty = `Tom & Jerry <script>alert("x")</script> 'q' ]]> &amp;`

function parseRss(xml) {
  expect(XMLValidator.validate(xml)).toBe(true)
  return new XMLParser({ ignoreAttributes: false, isArray: (name) => name === 'item' }).parse(xml)
}

function parseHead(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const meta = (attr, key) => doc.head.querySelector(`meta[${attr}="${key}"]`)?.getAttribute('content')
  return {
    title: doc.title,
    titles: doc.head.querySelectorAll('title').length,
    description: meta('name', 'description'),
    canonical: doc.head.querySelector('link[rel="canonical"]')?.getAttribute('href'),
    ogTitle: meta('property', 'og:title'),
    ogDescription: meta('property', 'og:description'),
    ogUrl: meta('property', 'og:url'),
    ogType: meta('property', 'og:type'),
    published: meta('property', 'article:published_time'),
    twitterCard: meta('name', 'twitter:card'),
    twitterTitle: meta('name', 'twitter:title'),
    twitterDescription: meta('name', 'twitter:description'),
    scripts: doc.querySelectorAll('script').length,
  }
}

describe('escapeMarkup', () => {
  it('escapes the five markup characters, ampersand first', () => {
    expect(escapeMarkup(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&apos;')
    expect(escapeMarkup('&amp;')).toBe('&amp;amp;')
    expect(escapeMarkup('plain — ünï')).toBe('plain — ünï')
  })

  it('refuses non-strings instead of printing "undefined"', () => {
    expect(() => escapeMarkup(undefined)).toThrow(TypeError)
  })
})

describe('rfc822', () => {
  it.each([
    ['2025-06-18', 'Wed, 18 Jun 2025 00:00:00 +0000'],
    ['2024-02-29', 'Thu, 29 Feb 2024 00:00:00 +0000'],
    ['2026-01-01', 'Thu, 01 Jan 2026 00:00:00 +0000'],
  ])('%s -> %s', (iso, expected) => {
    expect(rfc822(iso)).toBe(expected)
  })

  it('rejects an invalid date', () => {
    expect(() => rfc822('2025-13-01')).toThrow(RangeError)
  })
})

describe('renderRss', () => {
  const posts = [
    { slug: 'older', title: 'old one', date: '2024-01-02', description: 'first' },
    { slug: 'nasty', title: nasty, date: '2025-06-18', description: nasty },
    { slug: 'newest', title: 'new', date: '2026-03-04', description: 'latest' },
  ]

  it('is valid RSS 2.0 with absolute links, newest first', () => {
    const rss = parseRss(renderRss({ siteUrl: SITE, title: 'Christopher Lee', description: 'd', posts })).rss
    expect(rss['@_version']).toBe('2.0')
    expect(rss.channel.link).toBe(`${SITE}/blog`)
    expect(rss.channel['atom:link']['@_href']).toBe(`${SITE}/rss.xml`)
    expect(rss.channel.lastBuildDate).toBe('Wed, 04 Mar 2026 00:00:00 +0000')
    expect(rss.channel.item.map((i) => i.link)).toEqual([`${SITE}/blog/newest`, `${SITE}/blog/nasty`, `${SITE}/blog/older`])
    expect(rss.channel.item.map((i) => i.pubDate)).toEqual([
      'Wed, 04 Mar 2026 00:00:00 +0000',
      'Wed, 18 Jun 2025 00:00:00 +0000',
      'Tue, 02 Jan 2024 00:00:00 +0000',
    ])
    expect(rss.channel.item[0].guid['#text']).toBe(`${SITE}/blog/newest`)
    expect(rss.channel.item[0].guid['@_isPermaLink']).toBe('true')
  })

  it('round-trips &, <, quotes and a CDATA terminator in titles and descriptions', () => {
    const xml = renderRss({ siteUrl: SITE, title: nasty, description: nasty, posts })
    expect(xml).not.toContain('<script>')
    const parser = new XMLParser({ ignoreAttributes: false, isArray: (name) => name === 'item', processEntities: true, htmlEntities: false })
    const rss = parser.parse(xml).rss
    expect(rss.channel.title).toBe(nasty)
    expect(rss.channel.item[1].title).toBe(nasty)
    expect(rss.channel.item[1].description).toBe(nasty)
  })

  it('is valid with no posts', () => {
    const rss = parseRss(renderRss({ siteUrl: SITE, title: 't', description: 'd', posts: [] })).rss
    expect(rss.channel.item).toBeUndefined()
    expect(rss.channel.lastBuildDate).toBeUndefined()
  })
})

describe('headTags + withHead', () => {
  const template = '<!doctype html><html><head><meta charset="UTF-8" /><title>Christopher Lee</title><script>var a=1</script></head><body><div id="root"></div></body></html>'

  it('replaces the title and adds description, canonical, Open Graph and Twitter tags', () => {
    const html = withHead(template, headTags({
      siteUrl: SITE, siteName: 'Christopher Lee', path: '/blog/handling-adhd',
      title: 'how i deal with having adhd', description: 'handing adhd', type: 'article', published: '2025-06-18',
    }))
    expect(parseHead(html)).toEqual({
      title: 'how i deal with having adhd',
      titles: 1,
      description: 'handing adhd',
      canonical: `${SITE}/blog/handling-adhd`,
      ogTitle: 'how i deal with having adhd',
      ogDescription: 'handing adhd',
      ogUrl: `${SITE}/blog/handling-adhd`,
      ogType: 'article',
      published: '2025-06-18',
      twitterCard: 'summary',
      twitterTitle: 'how i deal with having adhd',
      twitterDescription: 'handing adhd',
      scripts: 1,
    })
  })

  it('escapes interpolated text so it cannot break out of tags or attributes', () => {
    const html = withHead(template, headTags({ siteUrl: SITE, siteName: nasty, path: '/x"y', title: nasty, description: nasty }))
    const head = parseHead(html)
    expect(head.title).toBe(nasty)
    expect(head.titles).toBe(1)
    expect(head.ogTitle).toBe(nasty)
    expect(head.description).toBe(nasty)
    expect(head.twitterDescription).toBe(nasty)
    expect(head.canonical).toBe(`${SITE}/x"y`)
    expect(head.scripts).toBe(1)
    expect(head.ogType).toBe('website')
    expect(head.published).toBeUndefined()
  })

  it('treats $ patterns in the title literally', () => {
    const html = withHead(template, headTags({ siteUrl: SITE, siteName: 's', path: '/', title: "$& $' $1", description: 'd' }))
    expect(parseHead(html).title).toBe("$& $' $1")
  })

  it.each([
    ['no title', '<html><head></head></html>', 0],
    ['two titles', '<html><head><title>a</title><title>b</title></head></html>', 2],
  ])('refuses a template with %s', (_name, html, count) => {
    expect(() => withHead(html, '<title>x</title>')).toThrow(`exactly one <title>, found ${count}`)
  })
})

describe('pageFiles', () => {
  it.each([
    ['/', ['index.html']],
    ['/projects', ['projects.html', 'projects/index.html']],
    ['/blog/handling-adhd', ['blog/handling-adhd.html', 'blog/handling-adhd/index.html']],
  ])('%s -> %j', (route, files) => {
    expect(pageFiles(route)).toEqual(files)
  })
})

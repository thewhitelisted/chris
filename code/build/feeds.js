import { sortNewestFirst } from './posts.js'

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }

export function escapeMarkup(text) {
  if (typeof text !== 'string') throw new TypeError(`escapeMarkup expects a string, got ${typeof text}`)
  return text.replace(/[&<>"']/g, (char) => ESCAPES[char])
}

export function rfc822(isoDate) {
  const date = new Date(`${isoDate}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) throw new RangeError(`Invalid date ${isoDate}`)
  return date.toUTCString().replace('GMT', '+0000')
}

export function postUrl(siteUrl, slug) {
  return `${siteUrl}/blog/${encodeURIComponent(slug)}`
}

export function renderRss({ siteUrl, title, description, posts }) {
  const newestFirst = sortNewestFirst(posts)
  const items = newestFirst.map((post) => {
    const link = escapeMarkup(postUrl(siteUrl, post.slug))
    return [
      '    <item>',
      `      <title>${escapeMarkup(post.title)}</title>`,
      `      <link>${link}</link>`,
      `      <guid isPermaLink="true">${link}</guid>`,
      `      <pubDate>${rfc822(post.date)}</pubDate>`,
      `      <description>${escapeMarkup(post.description)}</description>`,
      '    </item>',
    ].join('\n')
  })
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '  <channel>',
    `    <title>${escapeMarkup(title)}</title>`,
    `    <link>${escapeMarkup(`${siteUrl}/blog`)}</link>`,
    `    <description>${escapeMarkup(description)}</description>`,
    '    <language>en</language>',
    `    <atom:link href="${escapeMarkup(`${siteUrl}/rss.xml`)}" rel="self" type="application/rss+xml"/>`,
    ...(newestFirst.length ? [`    <lastBuildDate>${rfc822(newestFirst[0].date)}</lastBuildDate>`] : []),
    ...items,
    '  </channel>',
    '</rss>',
    '',
  ].join('\n')
}

export function headTags({ siteUrl, siteName, path, title, description, type = 'website', published }) {
  const url = escapeMarkup(`${siteUrl}${path}`)
  const t = escapeMarkup(title)
  const d = escapeMarkup(description)
  return [
    `<title>${t}</title>`,
    `<meta name="description" content="${d}" />`,
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:site_name" content="${escapeMarkup(siteName)}" />`,
    `<meta property="og:type" content="${escapeMarkup(type)}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:title" content="${t}" />`,
    `<meta property="og:description" content="${d}" />`,
    ...(published ? [`<meta property="article:published_time" content="${escapeMarkup(published)}" />`] : []),
    '<meta name="twitter:card" content="summary" />',
    `<meta name="twitter:title" content="${t}" />`,
    `<meta name="twitter:description" content="${d}" />`,
  ].join('\n    ')
}

const TITLE_TAG = /<title>[^<]*<\/title>/g

export function withHead(templateHtml, tags) {
  const matches = templateHtml.match(TITLE_TAG) ?? []
  if (matches.length !== 1) throw new Error(`index.html must contain exactly one <title>, found ${matches.length}`)
  return templateHtml.replace(TITLE_TAG, () => tags)
}

export function pageFiles(routePath) {
  if (routePath === '/') return ['index.html']
  const trimmed = routePath.replace(/^\//, '')
  return [`${trimmed}.html`, `${trimmed}/index.html`]
}

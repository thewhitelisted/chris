import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { parse as parseYaml } from 'yaml'
import { formatDate } from '../src/dates.js'

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const FULL_DATE = /^\d{4}-\d{2}-\d{2}$/
const FIELDS = ['title', 'date', 'description']
const FRONTMATTER = /^---\n([\s\S]*?)\n---(?:\n|$)/

export class ContentError extends Error {
  constructor(file, message) {
    super(`${file}: ${message}`)
    this.name = 'ContentError'
    this.file = file
  }
}

export function parsePost(file, source) {
  const slug = path.basename(file, '.md')
  if (path.extname(file) !== '.md') throw new ContentError(file, 'posts must be .md files')
  if (!SLUG.test(slug)) throw new ContentError(file, `file name must be a lowercase-hyphenated slug like "my-post.md"`)

  const text = source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
  const match = FRONTMATTER.exec(text)
  if (!match) throw new ContentError(file, 'must start with a "---" frontmatter block closed by "---"')

  let data
  try {
    data = parseYaml(match[1])
  } catch (err) {
    throw new ContentError(file, `frontmatter is not valid YAML: ${err.message}`)
  }
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    throw new ContentError(file, `frontmatter must be key: value pairs (${FIELDS.join(', ')})`)
  }

  const unknown = Object.keys(data).filter((key) => !FIELDS.includes(key))
  if (unknown.length) throw new ContentError(file, `unknown frontmatter field(s): ${unknown.join(', ')}`)
  for (const field of FIELDS) {
    if (!(field in data)) throw new ContentError(file, `missing frontmatter field "${field}"`)
    if (typeof data[field] !== 'string' || data[field].trim() === '') {
      throw new ContentError(file, `frontmatter field "${field}" must be a non-empty string (quote it if it looks like a number)`)
    }
  }
  if (!FULL_DATE.test(data.date)) throw new ContentError(file, `date must be YYYY-MM-DD, got ${JSON.stringify(data.date)}`)
  try {
    formatDate(data.date)
  } catch (err) {
    throw new ContentError(file, `date is not a real calendar date: ${err.message}`)
  }

  const body = text.slice(match[0].length).replace(/^\n+/, '')
  if (body.trim() === '') throw new ContentError(file, 'post body is empty')

  return { file, slug, title: data.title, date: data.date, description: data.description, body }
}

export function checkUniqueSlugs(posts) {
  const seen = new Map()
  for (const post of posts) {
    const previous = seen.get(post.slug)
    if (previous) throw new ContentError(post.file, `duplicate slug "${post.slug}" (also used by ${previous})`)
    seen.set(post.slug, post.file)
  }
}

export function sortNewestFirst(posts) {
  return posts.slice().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.slug.localeCompare(b.slug)))
}

export async function loadPosts(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const posts = []
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    const file = path.join(dir, entry.name)
    if (!entry.isFile()) throw new ContentError(file, 'only .md files belong in the posts folder')
    posts.push(parsePost(file, await readFile(file, 'utf8')))
  }
  checkUniqueSlugs(posts)
  return sortNewestFirst(posts)
}

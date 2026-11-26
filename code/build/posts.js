import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { ContentError, parseFrontmatter } from './frontmatter.js'

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const RESERVED_SLUGS = ['index']

export function parsePost(file, source) {
  const slug = path.basename(file, '.md')
  if (path.extname(file) !== '.md') throw new ContentError(file, 'posts must be .md files')
  if (!SLUG.test(slug)) throw new ContentError(file, `file name must be a lowercase-hyphenated slug like "my-post.md"`)
  if (RESERVED_SLUGS.includes(slug)) throw new ContentError(file, `"${slug}" is reserved; rename the file`)
  return { file, slug, ...parseFrontmatter(file, source) }
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

import { readdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { ContentError } from './frontmatter.js'
import { escapeMarkup } from './feeds.js'

// Old project slug -> current slug, for repos renamed on GitHub after they had devlogs. Kept inside devlogs/ so the
// folder rename and its record land in one commit; the leading dot keeps loadDevlogs from reading it as a project.
export const RENAMES_FILE = '.renames.json'
// A GitHub repo name lowercased: letters, digits, '.', '_' and '-'.
const SLUG = /^[a-z0-9._-]+$/

export function parseRenames(file, source) {
  let data
  try {
    data = JSON.parse(source)
  } catch (err) {
    throw new ContentError(file, `is not valid JSON: ${err.message}`)
  }
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    throw new ContentError(file, 'must be a JSON object of old slug to current slug')
  }
  const renames = new Map(Object.entries(data))
  for (const [from, to] of renames) {
    if (!SLUG.test(from) || typeof to !== 'string' || !SLUG.test(to)) {
      throw new ContentError(file, `"${from}": ${JSON.stringify(to)} must map one lowercase repo name to another`)
    }
    if (from === to) throw new ContentError(file, `"${from}" maps to itself`)
    if (renames.has(to)) throw new ContentError(file, `"${from}" maps to "${to}", which is itself renamed; map "${from}" to "${renames.get(to)}"`)
  }
  return renames
}

export async function readRenames(file) {
  let source
  try {
    source = await readFile(file, 'utf8')
  } catch (err) {
    if (err.code === 'ENOENT') return new Map()
    throw err
  }
  return parseRenames(file, source)
}

export function checkRenames(file, renames, projectSlugs) {
  for (const from of renames.keys()) {
    if (projectSlugs.includes(from)) {
      throw new ContentError(file, `"${from}" is a project slug again, so its old links cannot redirect; remove it from ${RENAMES_FILE}`)
    }
  }
}

// Old page path -> new page path for every page a renamed project has now.
export function redirectRoutes(renames, devlogs) {
  const routes = []
  for (const [from, to] of renames) {
    const entries = devlogs.filter((entry) => entry.project === to)
    if (entries.length === 0) continue
    routes.push({ from: `/projects/${from}`, to: `/projects/${to}` })
    for (const entry of entries) routes.push({ from: `/projects/${from}/${entry.date}`, to: `/projects/${to}/${entry.date}` })
  }
  return routes
}

export function redirectHtml(siteUrl, to) {
  const url = escapeMarkup(`${siteUrl}${to}`)
  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8" />',
    '<title>Moved</title>',
    `<link rel="canonical" href="${url}" />`,
    '<meta name="robots" content="noindex" />',
    `<meta http-equiv="refresh" content="0; url=${url}" />`,
    '</head>',
    `<body><p>This page moved to <a href="${url}">${url}</a>.</p></body>`,
    '</html>',
    '',
  ].join('\n')
}

export function recordRename(renames, from, to) {
  const next = new Map()
  for (const [oldSlug, slug] of renames) next.set(oldSlug, slug === from ? to : slug)
  next.set(from, to)
  next.delete(to)
  return next
}

export function serializeRenames(renames) {
  const sorted = Object.fromEntries([...renames].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
  return `${JSON.stringify(sorted, null, 2)}\n`
}

// lookupSlug(folder) gives the slug of the repo GitHub serves under that name (following a rename), or null.
export async function planFolderRenames(dir, folders, projectSlugs, lookupSlug) {
  const plan = []
  for (const folder of folders) {
    if (projectSlugs.includes(folder)) continue
    const slug = await lookupSlug(folder)
    if (slug === null || slug === folder || !projectSlugs.includes(slug)) continue
    const other = folders.includes(slug) ? slug : plan.find((step) => step.to === slug)?.from
    if (other) {
      throw new ContentError(path.join(dir, folder), `the repo was renamed to ${slug}, but devlogs/${other} is also that project; move the entries into one folder by hand`)
    }
    plan.push({ from: folder, to: slug })
  }
  return plan
}

export async function syncRenames({ devlogsDir, projectSlugs, lookupSlug }) {
  let topLevel
  try {
    topLevel = await readdir(devlogsDir, { withFileTypes: true })
  } catch (err) {
    if (err.code === 'ENOENT') return []
    throw err
  }
  const folders = topLevel.filter((entry) => entry.isDirectory() && !entry.name.startsWith('.')).map((entry) => entry.name)
  const plan = await planFolderRenames(devlogsDir, folders, projectSlugs, lookupSlug)
  if (plan.length === 0) return plan
  const file = path.join(devlogsDir, RENAMES_FILE)
  let renames = await readRenames(file)
  for (const { from, to } of plan) {
    await rename(path.join(devlogsDir, from), path.join(devlogsDir, to))
    renames = recordRename(renames, from, to)
  }
  await writeFile(file, serializeRenames(renames))
  return plan
}

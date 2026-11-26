import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { ContentError, parseFrontmatter } from './frontmatter.js'

const ENTRY_NAME = /^(\d{4}-\d{2}-\d{2})\.md$/
const RESERVED_PROJECT_SLUGS = ['index']

export function parseDevlogEntry(file, source) {
  const match = ENTRY_NAME.exec(path.basename(file))
  if (!match) throw new ContentError(file, 'devlog entries must be named YYYY-MM-DD.md, e.g. "2026-11-26.md"')
  const entry = parseFrontmatter(file, source)
  if (entry.date !== match[1]) {
    throw new ContentError(file, `frontmatter date ${entry.date} does not match the file name date ${match[1]}`)
  }
  return { file, project: path.basename(path.dirname(file)), ...entry }
}

export function checkUniqueDates(entries) {
  const seen = new Map()
  for (const entry of entries) {
    const key = `${entry.project}/${entry.date}`
    const previous = seen.get(key)
    if (previous) throw new ContentError(entry.file, `duplicate devlog date ${entry.date} for project "${entry.project}" (also used by ${previous})`)
    seen.set(key, entry.file)
  }
}

export function sortDevlogsNewestFirst(entries) {
  return entries.slice().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.project.localeCompare(b.project)))
}

const isDotted = (entry) => entry.name.startsWith('.')

async function listFolder(dir) {
  return (await readdir(dir, { withFileTypes: true })).filter((entry) => !isDotted(entry))
}

export async function loadDevlogs(dir, projectSlugs, { skipUnknownProjects }) {
  let topLevel
  try {
    topLevel = await readdir(dir, { withFileTypes: true })
  } catch (err) {
    if (err.code === 'ENOENT') return { entries: [], skipped: [], ignoredDotFolders: [] }
    if (err.code === 'ENOTDIR') throw new ContentError(dir, 'must be a folder of project folders')
    throw err
  }
  const ignoredDotFolders = topLevel.filter((entry) => isDotted(entry) && entry.isDirectory()).map((entry) => entry.name)
  const entries = []
  const skipped = []
  for (const folder of topLevel.filter((entry) => !isDotted(entry))) {
    const folderPath = path.join(dir, folder.name)
    if (!folder.isDirectory()) throw new ContentError(folderPath, 'only project folders belong in the devlogs folder')
    const known = projectSlugs.includes(folder.name)
    if (!known && !skipUnknownProjects) {
      throw new ContentError(folderPath, `"${folder.name}" is not a project slug; use one of: ${projectSlugs.join(', ')}`)
    }
    if (known && RESERVED_PROJECT_SLUGS.includes(folder.name)) {
      throw new ContentError(folderPath, `a project with the slug "${folder.name}" cannot have devlogs: its page /projects/${folder.name} would replace the projects page`)
    }
    const folderEntries = []
    for (const item of await listFolder(folderPath)) {
      const file = path.join(folderPath, item.name)
      if (!item.isFile()) throw new ContentError(file, 'only YYYY-MM-DD.md files belong in a project devlog folder')
      folderEntries.push(parseDevlogEntry(file, await readFile(file, 'utf8')))
    }
    checkUniqueDates(folderEntries)
    if (known) entries.push(...folderEntries)
    else skipped.push(folder.name)
  }
  return { entries: sortDevlogsNewestFirst(entries), skipped, ignoredDotFolders }
}

export function ignoredDotFoldersWarning(names) {
  return `devlogs: ignored ${names.map((name) => `devlogs/${name}`).join(', ')}: folders whose names start with a dot are not read`
}

export function skippedDevlogsWarning(skipped) {
  return (
    `devlogs: skipped ${skipped.map((name) => `devlogs/${name}`).join(', ')}: no listed project has that slug. ` +
    'PORTFOLIO_REPOS_TOKEN is not set, so private repos are not listed; set it to build their devlogs'
  )
}

export function devlogIndex(entries) {
  return entries.map(({ project, date, title, description }) => ({ project, date, title, description }))
}

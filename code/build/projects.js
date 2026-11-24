import { existsSync, statSync } from 'node:fs'
import path from 'node:path'
import { formatDate } from '../src/dates.js'
import { invalidXmlChar } from './text.js'

const LINK_FIELDS = ['github', 'live', 'report']
const REQUIRED_STRINGS = ['slug', 'title', 'date', 'description', 'type', 'color']

export class ProjectsError extends Error {
  constructor(message) {
    super(`Projects: ${message}`)
    this.name = 'ProjectsError'
  }
}

export function checkLink(link, publicDir) {
  if (typeof link !== 'string') return `is not a string: ${JSON.stringify(link)}`
  if (link.startsWith('/') && !link.startsWith('//')) {
    let relative
    try {
      relative = decodeURIComponent(link.split(/[?#]/)[0]).slice(1)
    } catch {
      return `has malformed %-encoding: ${link}`
    }
    const file = path.resolve(publicDir, relative)
    if (!file.startsWith(path.resolve(publicDir) + path.sep)) return `escapes the public folder: ${link}`
    if (!existsSync(file) || !statSync(file).isFile()) return `points to a file missing from public/: ${link}`
    return null
  }
  try {
    if (new URL(link).protocol === 'https:') return null
  } catch {
    return `is neither a site-relative file nor an absolute https URL: ${link}`
  }
  return `is not https: ${link}`
}

export function validateHandKept(projects, publicDir) {
  if (!Array.isArray(projects)) throw new ProjectsError('hand-kept list must be an array')
  for (const project of projects) {
    const label = project?.slug ?? JSON.stringify(project)
    for (const field of REQUIRED_STRINGS) {
      if (typeof project[field] !== 'string' || project[field] === '') {
        throw new ProjectsError(`hand-kept project ${label}: "${field}" must be a non-empty string`)
      }
    }
    try {
      formatDate(project.date)
    } catch (err) {
      throw new ProjectsError(`hand-kept project ${label}: ${err.message}`)
    }
    if (!Array.isArray(project.technologies) || !project.technologies.every((t) => typeof t === 'string')) {
      throw new ProjectsError(`hand-kept project ${label}: "technologies" must be an array of strings`)
    }
    for (const text of [project.title, project.description, project.type, ...project.technologies]) {
      const bad = invalidXmlChar(text)
      if (bad) throw new ProjectsError(`hand-kept project ${label}: contains the control character ${bad}`)
    }
    for (const field of LINK_FIELDS) {
      if (!(field in project)) continue
      const problem = checkLink(project[field], publicDir)
      if (problem) throw new ProjectsError(`hand-kept project ${label}: "${field}" ${problem}`)
    }
  }
  return projects
}

export function allowNoGitHubProjects(env) {
  return env.ALLOW_NO_GITHUB_PROJECTS === '1'
}

export function mergeProjects(fromGitHub, handKept, { allowNoGitHubProjects }) {
  if (fromGitHub.length === 0 && !allowNoGitHubProjects) {
    throw new ProjectsError(
      'no public GitHub repo has the portfolio topic, so the featured projects would disappear. ' +
        'Add the topic to the repos to feature, or set ALLOW_NO_GITHUB_PROJECTS=1 to build without them.',
    )
  }
  const merged = [...fromGitHub, ...handKept]
  const seen = new Set()
  for (const project of merged) {
    if (seen.has(project.slug)) throw new ProjectsError(`two projects share the slug "${project.slug}"`)
    seen.add(project.slug)
  }
  return merged
}

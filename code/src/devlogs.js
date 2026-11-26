import { compareIsoDates } from './dates.js'

export const entryPath = (entry) => `/projects/${entry.project}/${entry.date}`
export const timelinePath = (slug) => `/projects/${slug}`
export const entryBodyUrl = (entry) => `/devlogs/${encodeURIComponent(entry.project)}/${encodeURIComponent(entry.date)}.md`

export function plural(count, word) {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}

// Entries of one project, newest first (virtual:devlogs is already newest first).
export function entriesOf(devlogs, slug) {
  return devlogs.filter((entry) => entry.project === slug)
}

function projectOf(projects, entry) {
  const project = projects.find((p) => p.slug === entry.project)
  if (!project) throw new Error(`devlog ${entry.project}/${entry.date} belongs to no project`)
  return project
}

// The project and its entries for /projects/:slug, or null when the page does not exist.
export function findTimeline(projects, devlogs, slug) {
  const project = projects.find((p) => p.slug === slug)
  const entries = entriesOf(devlogs, slug)
  return project && entries.length > 0 ? { project, entries } : null
}

// The project and entry for /projects/:slug/:date, or null when the page does not exist.
export function findEntry(projects, devlogs, slug, date) {
  const entry = devlogs.find((e) => e.project === slug && e.date === date)
  return entry ? { project: projectOf(projects, entry), entry } : null
}

// Posts and devlog entries as rows of the blog list. project is the entry's project title, null for a post.
export function blogListItems(posts, devlogs, projects) {
  return [
    ...posts.map((post) => ({
      key: `post:${post.slug}`,
      title: post.title,
      date: post.date,
      path: `/blog/${post.slug}`,
      project: null,
      searchText: [post.title, post.slug],
    })),
    ...devlogs.map((entry) => {
      const project = projectOf(projects, entry).title
      return {
        key: `devlog:${entry.project}/${entry.date}`,
        title: entry.title,
        date: entry.date,
        path: entryPath(entry),
        project,
        searchText: [entry.title, project, 'devlog'],
      }
    }),
  ]
}

// In-progress projects for /now, newest first, each with its latest entry or null.
export function nowProjects(projects, devlogs) {
  return projects
    .filter((project) => project.status === 'in-progress')
    .sort((a, b) => compareIsoDates(b.date, a.date) || a.title.localeCompare(b.title))
    .map((project) => ({ project, latest: entriesOf(devlogs, project.slug)[0] ?? null }))
}

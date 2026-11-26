export const SITE_NAME = 'Christopher Lee'
export const SITE_DESCRIPTION = 'Christopher Lee: University of Waterloo × Wilfrid Laurier, Mathematics & Business.'

const STATIC_PAGES = [
  { path: '/', title: SITE_NAME, description: SITE_DESCRIPTION },
  { path: '/about', title: `About · ${SITE_NAME}`, description: `About ${SITE_NAME}.` },
  { path: '/projects', title: `Projects · ${SITE_NAME}`, description: `Projects by ${SITE_NAME}.` },
  { path: '/blog', title: `Blog · ${SITE_NAME}`, description: `Posts by ${SITE_NAME}.` },
  { path: '/now', title: `Now · ${SITE_NAME}`, description: `What ${SITE_NAME} is working on now.` },
  { path: '/music', title: `Music · ${SITE_NAME}`, description: `Music ${SITE_NAME} listens to.` },
  { path: '/hobbies', title: `Interests · ${SITE_NAME}`, description: `Interests of ${SITE_NAME}.` },
]

export function devlogTitle(projectTitle, entryTitle) {
  return `${projectTitle} devlog: ${entryTitle}`
}

export function sitePages({ posts, projects, devlogs }) {
  const projectsBySlug = new Map(projects.map((project) => [project.slug, project]))
  const projectOf = (entry) => {
    const project = projectsBySlug.get(entry.project)
    if (!project) throw new Error(`devlog ${entry.project}/${entry.date} belongs to no project`)
    return project
  }
  const entryPages = devlogs.map((entry) => ({
    path: `/projects/${entry.project}/${entry.date}`,
    title: devlogTitle(projectOf(entry).title, entry.title),
    description: entry.description,
    type: 'article',
    published: entry.date,
  }))
  return [
    ...STATIC_PAGES,
    ...posts.map((post) => ({
      path: `/blog/${post.slug}`,
      title: post.title,
      description: post.description,
      type: 'article',
      published: post.date,
    })),
    ...projects
      .filter((project) => devlogs.some((entry) => entry.project === project.slug))
      .map((project) => ({
        path: `/projects/${project.slug}`,
        title: `${project.title} devlog · ${SITE_NAME}`,
        description: project.description,
      })),
    ...entryPages,
  ]
}

export function titleFor(pathname, content) {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  return sitePages(content).find((page) => page.path === normalized)?.title ?? SITE_NAME
}

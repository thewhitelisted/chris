export const SITE_NAME = 'Christopher Lee'
export const SITE_DESCRIPTION = 'Christopher Lee: University of Waterloo × Wilfrid Laurier, Mathematics & Business.'

const STATIC_PAGES = [
  { path: '/', title: SITE_NAME, description: SITE_DESCRIPTION },
  { path: '/about', title: `About · ${SITE_NAME}`, description: `About ${SITE_NAME}.` },
  { path: '/projects', title: `Projects · ${SITE_NAME}`, description: `Projects by ${SITE_NAME}.` },
  { path: '/blog', title: `Blog · ${SITE_NAME}`, description: `Posts by ${SITE_NAME}.` },
  { path: '/music', title: `Music · ${SITE_NAME}`, description: `Music ${SITE_NAME} listens to.` },
  { path: '/hobbies', title: `Interests · ${SITE_NAME}`, description: `Interests of ${SITE_NAME}.` },
]

export function sitePages(posts) {
  return [
    ...STATIC_PAGES,
    ...posts.map((post) => ({
      path: `/blog/${post.slug}`,
      title: post.title,
      description: post.description,
      type: 'article',
      published: post.date,
    })),
  ]
}

export function titleFor(pathname, posts) {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  return sitePages(posts).find((page) => page.path === normalized)?.title ?? SITE_NAME
}

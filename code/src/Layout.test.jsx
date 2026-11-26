import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { StrictMode, lazy } from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from './Layout.jsx'
import SiteRouter from './SiteRouter.jsx'
import { deferred, mount, settle } from './testUtils.js'

const page = (text) => ({ default: () => <p className="test-page">{text}</p> })

let view
let chunks

function lazyRoute(name) {
  chunks[name] = deferred()
  return lazy(() => chunks[name].promise)
}

function renderApp() {
  const Home = lazyRoute('home')
  const Projects = lazyRoute('projects')
  const Blog = lazyRoute('blog')
  return view.render(
    <StrictMode>
      <SiteRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/blog" element={<Blog />} />
            <Route path="/blog/:slug" element={<p className="test-page">post</p>} />
            <Route path="/projects/:slug/:date" element={<p className="test-page">devlog entry</p>} />
            <Route path="/about" element={<p className="test-page">about</p>} />
          </Route>
        </Routes>
      </SiteRouter>
    </StrictMode>,
  )
}

const pane = () => view.container.querySelector('.content-pane')
const paneText = () => pane().textContent
const visiblePaneText = () => [...pane().querySelectorAll('p')]
  .filter((el) => !el.closest('[style*="display: none"]'))
  .map((el) => el.textContent)
  .join('')
const isLoading = () => pane().querySelector('.content-loading') !== null
const alertText = () => pane().querySelector('[role="alert"]')?.textContent
const activeNav = () => view.container.querySelector('a.nav-item.active')?.textContent
const navLinks = () => view.container.querySelectorAll('a.nav-item').length
const clickNav = (path) => settle(() => view.container.querySelector(`a.nav-item[href="${path}"]`).click())

beforeEach(() => {
  window.history.replaceState(null, '', '/')
  view = mount()
  chunks = {}
})

afterEach(() => {
  view.unmount()
})

describe('Layout route loading', () => {
  it('shows the Suspense fallback on first load, then the route', async () => {
    await renderApp()
    expect(isLoading()).toBe(true)
    expect(navLinks()).toBe(7)

    await settle(() => chunks.home.resolve(page('home page')))
    expect(paneText()).toBe('home page')
    expect(activeNav()).toBe('home')
  })

  it('marks the new route active and shows Loading right away while its chunk loads', async () => {
    await renderApp()
    await settle(() => chunks.home.resolve(page('home page')))

    await clickNav('/projects')
    expect(window.location.pathname).toBe('/projects')
    expect(activeNav()).toBe('projects')
    expect(isLoading()).toBe(true)
    expect(visiblePaneText()).toBe('Loading...')

    await settle(() => chunks.projects.resolve(page('projects page')))
    expect(paneText()).toBe('projects page')
    expect(activeNav()).toBe('projects')
  })

  it('switches straight to an already-loaded route', async () => {
    await renderApp()
    await settle(() => chunks.home.resolve(page('home page')))
    await clickNav('/projects')
    await settle(() => chunks.projects.resolve(page('projects page')))

    await clickNav('/')
    expect(isLoading()).toBe(false)
    expect(paneText()).toBe('home page')
    expect(activeNav()).toBe('home')
  })

  it('goes from Loading to the error view when the chunk fails, sidebar intact', async () => {
    await renderApp()
    await settle(() => chunks.home.resolve(page('home page')))

    await clickNav('/projects')
    expect(isLoading()).toBe(true)
    await settle(() => chunks.projects.reject(new TypeError('Failed to fetch dynamically imported module')))

    expect(alertText()).toBe('This page failed to load. Reload to try again.')
    expect(paneText()).not.toContain('home page')
    expect(navLinks()).toBe(7)
    expect(activeNav()).toBe('projects')
    expect(view.caught).toHaveLength(1)
  })

  it('recovers from the error view on navigation, showing the fallback while the next chunk loads', async () => {
    await renderApp()
    await settle(() => chunks.home.resolve(page('home page')))
    await clickNav('/projects')
    await settle(() => chunks.projects.reject(new TypeError('Failed to fetch dynamically imported module')))

    await clickNav('/blog')
    expect(window.location.pathname).toBe('/blog')
    expect(alertText()).toBeUndefined()
    expect(isLoading()).toBe(true)
    expect(activeNav()).toBe('blog')

    await settle(() => chunks.blog.resolve(page('blog page')))
    expect(paneText()).toBe('blog page')
  })

  it('recovers from the error view to an already-loaded route', async () => {
    await renderApp()
    await settle(() => chunks.home.resolve(page('home page')))
    await clickNav('/projects')
    await settle(() => chunks.projects.reject(new TypeError('Failed to fetch dynamically imported module')))

    await clickNav('/')
    expect(alertText()).toBeUndefined()
    expect(paneText()).toBe('home page')
    expect(activeNav()).toBe('home')
  })

  it('shows the error again when returning to the failed route, since lazy caches the rejection', async () => {
    await renderApp()
    await settle(() => chunks.home.resolve(page('home page')))
    await clickNav('/projects')
    await settle(() => chunks.projects.reject(new TypeError('Failed to fetch dynamically imported module')))
    await clickNav('/')
    await clickNav('/projects')

    expect(alertText()).toBe('This page failed to load. Reload to try again.')
  })
})

describe('Layout document title', () => {
  it('follows in-app navigation using the same titles as the static pages', async () => {
    window.history.replaceState(null, '', '/blog/handling-adhd')
    await renderApp()
    expect(document.title).toBe('how i deal with having adhd')

    await clickNav('/projects')
    expect(document.title).toBe('Projects · Christopher Lee')

    await clickNav('/about')
    expect(document.title).toBe('About · Christopher Lee')

    await clickNav('/')
    expect(document.title).toBe('Christopher Lee')
  })

  it('keeps special characters in post titles literal', async () => {
    window.history.replaceState(null, '', '/blog/r-and-d')
    await renderApp()
    expect(document.title).toBe('R&D <notes>')
  })

  it('titles devlog routes from virtual:devlogs and virtual:projects', async () => {
    window.history.replaceState(null, '', '/projects/stealth-alpha/2026-11-20')
    await renderApp()
    expect(document.title).toBe('stealth-alpha devlog: fills & <slippage>')
  })

  it('falls back to the site name for an unknown post', async () => {
    document.title = 'stale'
    window.history.replaceState(null, '', '/blog/no-such-post')
    await renderApp()
    expect(document.title).toBe('Christopher Lee')
  })
})

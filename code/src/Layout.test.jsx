import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { StrictMode, lazy } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './Layout.jsx'
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
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/blog" element={<Blog />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </StrictMode>,
  )
}

const pane = () => view.container.querySelector('.content-pane')
const paneText = () => pane().textContent
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

  it('keeps the previous page, without a fallback, while the next route chunk loads', async () => {
    await renderApp()
    await settle(() => chunks.home.resolve(page('home page')))

    await clickNav('/projects')
    expect(window.location.pathname).toBe('/projects')
    expect(paneText()).toBe('home page')
    expect(isLoading()).toBe(false)
    expect(activeNav()).toBe('home')

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

  it('goes from the previous page straight to the error view when the chunk fails, sidebar intact', async () => {
    await renderApp()
    await settle(() => chunks.home.resolve(page('home page')))

    await clickNav('/projects')
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

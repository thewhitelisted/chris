import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act } from 'react'
import AppRoutes from './AppRoutes.jsx'
import SiteRouter from './SiteRouter.jsx'
import { markdownResponse, mount, settle, stubFetch } from './testUtils.js'

// The real route table with the real lazy pages, as main.jsx renders it.

let view
let net

beforeEach(() => {
  view = mount()
  net = stubFetch(vi.stubGlobal)
})

afterEach(() => {
  view.unmount()
  vi.unstubAllGlobals()
})

const pane = () => view.container.querySelector('.content-pane')

async function open(path, selector) {
  window.history.replaceState(null, '', path)
  await view.render(<SiteRouter><AppRoutes /></SiteRouter>)
  await vi.waitFor(async () => {
    await act(async () => {})
    if (!pane().querySelector(selector)) throw new Error(`no ${selector} at ${path}`)
  })
}

describe('AppRoutes devlog routes', () => {
  it('serves the timeline at /projects/:slug', async () => {
    await open('/projects/stealth-alpha', '.devlog-timeline')
    expect(pane().querySelector('h1').textContent).toBe('stealth-alpha')
    expect(document.title).toBe('stealth-alpha devlog · Christopher Lee')
    expect(view.container.querySelector('a.nav-item.active').textContent).toBe('projects')
  })

  it('serves an entry at /projects/:slug/:date and renders its body', async () => {
    await open('/projects/notes/2026-11-02', '.devlog-entry-page')
    await settle(() => net.responseFor('/devlogs/notes/2026-11-02.md').resolve(markdownResponse('Vol is **sticky**.')))
    expect(pane().querySelector('strong.post-bold').textContent).toBe('sticky')
    expect(document.title).toBe('notes devlog: vol of vol')
  })

  it('serves /now, reached from its nav link', async () => {
    await open('/projects', '.projects-window')
    await settle(() => view.container.querySelector('a.nav-item[href="/now"]').click())
    await vi.waitFor(async () => {
      await act(async () => {})
      if (!pane().querySelector('.now-page')) throw new Error('no /now page')
    })
    expect(view.container.querySelector('a.nav-item.active').textContent).toBe('now')
    expect(document.title).toBe('Now · Christopher Lee')
  })

  it('shows not found for an unknown project and an unknown entry', async () => {
    await open('/projects/nope', '[role="alert"]')
    expect(pane().querySelector('[role="alert"]').textContent).toBe('Could not load /projects/nope (not found).')
    view.unmount()
    view = mount()
    await open('/projects/stealth-alpha/2020-01-01', '[role="alert"]')
    expect(pane().querySelector('[role="alert"]').textContent).toBe('Could not load /projects/stealth-alpha/2020-01-01 (not found).')
    expect(net.urls()).toEqual([])
  })

  it('lists devlog entries in the blog', async () => {
    await open('/blog', '.blog-window')
    expect(pane().querySelectorAll('.devlog-tag')).toHaveLength(4)
  })
})

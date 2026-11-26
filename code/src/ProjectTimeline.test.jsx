import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { StrictMode } from 'react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import ProjectTimeline from './ProjectTimeline.jsx'
import { htmlResponse, markdownResponse, mount, settle, statusResponse, stubFetch } from './testUtils.js'

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

const renderAt = (path) => view.render(
  <StrictMode>
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/projects/:slug" element={<ProjectTimeline />} />
      </Routes>
    </MemoryRouter>
  </StrictMode>,
)

const NEW = '/devlogs/stealth-alpha/2026-11-20.md'
const OLD = '/devlogs/stealth-alpha/2026-10-05.md'
const page = () => view.container.querySelector('.content-page')
const entries = () => [...view.container.querySelectorAll('.devlog-entry')]
const entry = (i) => entries()[i]
const alertText = (el) => el.querySelector('[role="alert"]')?.textContent

describe('ProjectTimeline', () => {
  it('shows the project header, stats and links, then entries newest first with links to their pages', async () => {
    await renderAt('/projects/stealth-alpha')
    const header = view.container.querySelector('.project-card')
    expect(header.querySelector('h1').textContent).toBe('stealth-alpha')
    expect(header.querySelector('.sticky-note-date').textContent).toBe('Started September 2026 · Last updated 20 November, 2026')
    expect(header.querySelector('.sticky-note-status').textContent).toBe('In progress')
    expect(header.querySelector('.sticky-note-description').textContent).toBe('A strategy backtester')
    expect([...header.querySelectorAll('.stats-language')].map((li) => li.textContent)).toEqual(['Python91.4%', 'Shell8.6%'])
    expect(header.querySelector('.stats-activity-text').textContent).toBe('17 commits in the last 30 days')
    expect([...header.querySelectorAll('.sticky-note-link')].map((a) => [a.textContent, a.getAttribute('href')])).toEqual([['Live', 'https://stealth.example']])
    expect(header.querySelector('.sticky-note-private').textContent).toBe('Source private')
    expect(page().querySelector('.post-heading').textContent).toBe('Devlog · 2 updates')

    expect(entries().map((e) => [
      e.querySelector('.devlog-entry-title').textContent,
      e.querySelector('.devlog-entry-title a').getAttribute('href'),
      e.querySelector('time').textContent,
      e.querySelector('time').getAttribute('datetime'),
    ])).toEqual([
      ['fills & <slippage>', '/projects/stealth-alpha/2026-11-20', '20 November, 2026', '2026-11-20'],
      ['first take', '/projects/stealth-alpha/2026-10-05', '5 October, 2026', '2026-10-05'],
    ])
    expect(new Set(net.urls())).toEqual(new Set([NEW, OLD]))
  })

  it('loads each body on its own: loading, then rendered markdown or an error', async () => {
    await renderAt('/projects/stealth-alpha')
    expect(entries().map((e) => e.querySelector('.content-loading')?.textContent)).toEqual(['Loading...', 'Loading...'])

    await settle(() => net.responseFor(OLD).resolve(markdownResponse('Started with **fills**.\n\n## Why')))
    expect(entry(0).querySelector('.content-loading')).not.toBeNull()
    expect(entry(1).querySelector('.content-loading')).toBeNull()
    expect(entry(1).querySelector('p.post-paragraph').textContent).toBe('Started with fills.')
    expect(entry(1).querySelector('strong.post-bold').textContent).toBe('fills')
    expect(entry(1).querySelector('h2.post-heading').textContent).toBe('Why')

    await settle(() => net.responseFor(NEW).resolve(statusResponse(404)))
    expect(alertText(entry(0))).toBe(`Could not load ${NEW} (HTTP 404).`)
    expect(alertText(entry(1))).toBeUndefined()
  })

  it('shows not found for an HTML (SPA fallback) response, the network error, and an empty body', async () => {
    await renderAt('/projects/stealth-alpha')
    await settle(() => net.responseFor(NEW).resolve(htmlResponse()))
    await settle(() => net.responseFor(OLD).reject(new TypeError('Failed to fetch')))
    expect(alertText(entry(0))).toBe(`Could not load ${NEW} (not found).`)
    expect(alertText(entry(1))).toBe(`Could not load ${OLD} (Failed to fetch).`)
  })

  it('shows an empty state for a blank body', async () => {
    await renderAt('/projects/stealth-alpha')
    await settle(() => net.responseFor(NEW).resolve(markdownResponse(' \n\n ')))
    expect(entry(0).querySelector('.devlog-empty').textContent).toBe('This entry has no text.')
    expect(alertText(entry(0))).toBeUndefined()
  })

  it('shows a single entry and no stats block for a project with stats null', async () => {
    await renderAt('/projects/notes')
    expect(view.container.querySelector('.project-stats')).toBeNull()
    expect(page().querySelector('.post-heading').textContent).toBe('Devlog · 1 update')
    expect(entries().map((e) => e.querySelector('.devlog-entry-title').textContent)).toEqual(['vol of vol'])
    expect(net.urls()).toEqual(['/devlogs/notes/2026-11-02.md'])
  })

  it.each([
    ['an unknown slug', '/projects/nope'],
    ['a complete project with no entries', '/projects/shipped'],
    ['an in-progress project with no entries', '/projects/quiet'],
    ['a slug in the wrong case', '/projects/Stealth-Alpha'],
  ])('shows not found for %s, without fetching', async (_, path) => {
    await renderAt(path)
    expect(alertText(page())).toBe(`Could not load ${path} (not found).`)
    expect(entries()).toEqual([])
    expect(net.urls()).toEqual([])
  })
})

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { StrictMode } from 'react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import DevlogEntry from './DevlogEntry.jsx'
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
        <Route path="/projects/:slug" element={<p className="probe">timeline</p>} />
        <Route path="/projects/:slug/:date" element={<DevlogEntry />} />
      </Routes>
    </MemoryRouter>
  </StrictMode>,
)

const URL = '/devlogs/stealth-alpha/2026-11-20.md'
const page = () => view.container.querySelector('.content-page')
const alertText = () => page().querySelector('[role="alert"]')?.textContent
const isLoading = () => page().querySelector('.content-loading') !== null

describe('DevlogEntry', () => {
  it('shows the title literally, project tag, date and a back link, then the body once loaded', async () => {
    await renderAt('/projects/stealth-alpha/2026-11-20')
    expect(page().querySelector('h1.post-title').textContent).toBe('fills & <slippage>')
    expect(page().querySelector('.devlog-tag').textContent).toBe('stealth-alpha')
    expect(page().querySelector('time').textContent).toBe('20 November, 2026')
    expect(page().querySelector('a.devlog-back').getAttribute('href')).toBe('/projects/stealth-alpha')
    expect(page().querySelector('a.devlog-back').textContent).toBe('← stealth-alpha devlog')
    expect(net.urls()).toEqual([URL])
    expect(isLoading()).toBe(true)

    await settle(() => net.responseFor(URL).resolve(markdownResponse('Partial fills are **hard**.\n\n- one\n- two')))
    expect(isLoading()).toBe(false)
    expect(page().querySelector('p.post-paragraph').textContent).toBe('Partial fills are hard.')
    expect([...page().querySelectorAll('li.post-list-item')].map((li) => li.textContent)).toEqual(['one', 'two'])
    expect(alertText()).toBeUndefined()
  })

  it('goes back to the timeline', async () => {
    await renderAt('/projects/stealth-alpha/2026-11-20')
    await settle(() => page().querySelector('a.devlog-back').click())
    expect(view.container.querySelector('.probe').textContent).toBe('timeline')
  })

  it.each([
    ['HTTP status', statusResponse(500), `Could not load ${URL} (HTTP 500).`],
    ['SPA fallback', htmlResponse(), `Could not load ${URL} (not found).`],
  ])('shows the error for a failed body (%s)', async (_, response, message) => {
    await renderAt('/projects/stealth-alpha/2026-11-20')
    await settle(() => net.responseFor(URL).resolve(response))
    expect(alertText()).toBe(message)
    expect(page().querySelector('h1.post-title').textContent).toBe('fills & <slippage>')
  })

  it('shows the network error', async () => {
    await renderAt('/projects/stealth-alpha/2026-11-20')
    await settle(() => net.responseFor(URL).reject(new TypeError('Failed to fetch')))
    expect(alertText()).toBe(`Could not load ${URL} (Failed to fetch).`)
  })

  it('shows an empty state for a blank body', async () => {
    await renderAt('/projects/stealth-alpha/2026-11-20')
    await settle(() => net.responseFor(URL).resolve(markdownResponse('')))
    expect(page().querySelector('.devlog-empty').textContent).toBe('This entry has no text.')
  })

  it.each([
    ['an unknown date', '/projects/stealth-alpha/2026-11-21'],
    ['an unknown project', '/projects/nope/2026-11-20'],
    ["another project's date", '/projects/notes/2026-11-20'],
    ['a malformed date', '/projects/stealth-alpha/latest'],
  ])('shows not found for %s, without fetching', async (_, path) => {
    await renderAt(path)
    expect(alertText()).toBe(`Could not load ${path} (not found).`)
    expect(page().querySelector('h1')).toBeNull()
    expect(net.urls()).toEqual([])
  })
})

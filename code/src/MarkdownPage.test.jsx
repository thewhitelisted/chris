import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { StrictMode } from 'react'
import MarkdownPage from './MarkdownPage.jsx'
import { deferred, mount, settle } from './testUtils.js'

let view
let responses
let calls

const markdown = (body) => ({
  ok: true,
  status: 200,
  headers: new Headers({ 'content-type': 'text/markdown' }),
  text: async () => body,
})

function responseFor(url) {
  responses[url] ??= deferred()
  return responses[url]
}

beforeEach(() => {
  view = mount()
  responses = {}
  calls = []
  vi.stubGlobal('fetch', (url, { signal }) => {
    calls.push({ url, signal })
    return responseFor(url).promise
  })
})

afterEach(() => {
  view.unmount()
  vi.unstubAllGlobals()
})

const renderPage = (url) => view.render(<StrictMode><MarkdownPage url={url} /></StrictMode>)
const page = () => view.container.querySelector('.content-page')
const isLoading = () => page().querySelector('.content-loading') !== null
const alertText = () => page().querySelector('[role="alert"]')?.textContent

describe('MarkdownPage', () => {
  it('shows Loading until the response arrives, then the rendered markdown with the post classes', async () => {
    await renderPage('/papers/about.md')
    expect(isLoading()).toBe(true)
    expect(new Set(calls.map((c) => c.url))).toEqual(new Set(['/papers/about.md']))

    await settle(() => responseFor('/papers/about.md').resolve(markdown('# About\n\nHello **there**')))
    expect(isLoading()).toBe(false)
    expect(page().querySelector('h1.post-title').textContent).toBe('About')
    expect(page().querySelector('p.post-paragraph').textContent).toBe('Hello there')
    expect(page().querySelector('strong.post-bold').textContent).toBe('there')
    expect(alertText()).toBeUndefined()
  })

  it('shows the HTTP status for a non-OK response', async () => {
    await renderPage('/posts/missing.md')
    await settle(() => responseFor('/posts/missing.md').resolve({
      ok: false,
      status: 404,
      headers: new Headers({ 'content-type': 'text/html' }),
      text: async () => '<html></html>',
    }))
    expect(alertText()).toBe('Could not load /posts/missing.md (HTTP 404).')
  })

  it('treats an HTML response as not found (SPA fallback)', async () => {
    await renderPage('/posts/missing.md')
    await settle(() => responseFor('/posts/missing.md').resolve({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }),
      text: async () => '<!doctype html><div id="root"></div>',
    }))
    expect(alertText()).toBe('Could not load /posts/missing.md (not found).')
    expect(page().textContent).not.toContain('root')
  })

  it('shows the network error message', async () => {
    await renderPage('/papers/music.md')
    await settle(() => responseFor('/papers/music.md').reject(new TypeError('Failed to fetch')))
    expect(alertText()).toBe('Could not load /papers/music.md (Failed to fetch).')
  })

  it('shows an error, not a blank success, when the failure has no message', async () => {
    await renderPage('/papers/music.md')
    await settle(() => responseFor('/papers/music.md').reject(new Error('')))
    expect(alertText()).toBe('Could not load /papers/music.md (unknown error).')
  })

  it('shows Loading again when the URL changes', async () => {
    await renderPage('/posts/a.md')
    await settle(() => responseFor('/posts/a.md').resolve(markdown('# A')))
    await renderPage('/posts/b.md')
    expect(isLoading()).toBe(true)
    await settle(() => responseFor('/posts/b.md').resolve(markdown('# B')))
    expect(page().querySelector('h1').textContent).toBe('B')
  })

  it("shows B when A's response arrives after B's", async () => {
    await renderPage('/posts/a.md')
    await renderPage('/posts/b.md')
    expect(calls.filter((c) => c.url === '/posts/a.md').every((c) => c.signal.aborted)).toBe(true)

    await settle(() => responseFor('/posts/b.md').resolve(markdown('# B')))
    await settle(() => responseFor('/posts/a.md').resolve(markdown('# A')))

    expect(isLoading()).toBe(false)
    expect(page().querySelector('h1').textContent).toBe('B')
  })

  it("shows B when A's failure arrives after B's success", async () => {
    await renderPage('/posts/a.md')
    await renderPage('/posts/b.md')
    await settle(() => responseFor('/posts/b.md').resolve(markdown('# B')))
    await settle(() => responseFor('/posts/a.md').reject(new TypeError('Failed to fetch')))
    expect(alertText()).toBeUndefined()
    expect(page().querySelector('h1').textContent).toBe('B')
  })

  it("shows B's error, not A's late success", async () => {
    await renderPage('/posts/a.md')
    await renderPage('/posts/b.md')
    await settle(() => responseFor('/posts/b.md').reject(new TypeError('Failed to fetch')))
    await settle(() => responseFor('/posts/a.md').resolve(markdown('# A')))
    expect(alertText()).toBe('Could not load /posts/b.md (Failed to fetch).')
  })
})

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MotionGlobalConfig } from 'framer-motion'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
MotionGlobalConfig.skipAnimations = true

export function deferred() {
  let resolve
  let reject
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

export function mount() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const caught = []
  const root = createRoot(container, { onCaughtError: (error) => caught.push(error) })
  return {
    container,
    caught,
    render: (element) => act(async () => root.render(element)),
    unmount: () => {
      act(() => root.unmount())
      container.remove()
    },
  }
}

export const settle = (fn) => act(async () => { await fn() })

export const markdownResponse = (body) => ({
  ok: true,
  status: 200,
  headers: new Headers({ 'content-type': 'text/markdown' }),
  text: async () => body,
})

export const htmlResponse = () => ({
  ok: true,
  status: 200,
  headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }),
  text: async () => '<!doctype html><div id="root"></div>',
})

export const statusResponse = (status) => ({
  ok: false,
  status,
  headers: new Headers({ 'content-type': 'text/plain' }),
  text: async () => 'not found',
})

// Replaces fetch (through vi.stubGlobal) with one whose responses the test settles per URL.
export function stubFetch(stubGlobal) {
  const responses = {}
  const calls = []
  const responseFor = (url) => {
    responses[url] ??= deferred()
    return responses[url]
  }
  stubGlobal('fetch', (url, { signal }) => {
    calls.push({ url, signal })
    return responseFor(url).promise
  })
  return { responseFor, urls: () => [...new Set(calls.map((c) => c.url))] }
}

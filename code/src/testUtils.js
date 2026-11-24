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

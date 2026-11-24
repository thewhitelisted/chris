import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Suspense, act, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import RouteErrorBoundary from './RouteErrorBoundary.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

function Throws() {
  throw new Error('boom')
}

function Fine() {
  return <p>fine page</p>
}

let container
let root
let caught

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  caught = []
  root = createRoot(container, { onCaughtError: (error) => caught.push(error) })
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

const alertText = () => container.querySelector('[role="alert"]')?.textContent

describe('RouteErrorBoundary', () => {
  it('renders children when nothing throws', () => {
    act(() => root.render(<RouteErrorBoundary resetKey="/a"><Fine /></RouteErrorBoundary>))
    expect(container.textContent).toBe('fine page')
    expect(alertText()).toBeUndefined()
  })

  it('shows the error message in place of a child that throws', () => {
    act(() => root.render(<RouteErrorBoundary resetKey="/a"><Throws /></RouteErrorBoundary>))
    expect(alertText()).toBe('Could not load this page (boom).')
    expect(caught.map((e) => e.message)).toEqual(['boom'])
  })

  it('keeps showing the error while the reset key is unchanged', () => {
    act(() => root.render(<RouteErrorBoundary resetKey="/a"><Throws /></RouteErrorBoundary>))
    act(() => root.render(<RouteErrorBoundary resetKey="/a"><Fine /></RouteErrorBoundary>))
    expect(alertText()).toBe('Could not load this page (boom).')
  })

  it('recovers when the reset key changes', () => {
    act(() => root.render(<RouteErrorBoundary resetKey="/a"><Throws /></RouteErrorBoundary>))
    act(() => root.render(<RouteErrorBoundary resetKey="/b"><Fine /></RouteErrorBoundary>))
    expect(alertText()).toBeUndefined()
    expect(container.textContent).toBe('fine page')
  })

  it('catches a lazy route whose chunk fails to load, then recovers on navigation', async () => {
    const Broken = lazy(() => Promise.reject(new TypeError('Failed to fetch dynamically imported module')))
    await act(async () => {
      root.render(
        <RouteErrorBoundary resetKey="/projects">
          <Suspense fallback={<p>loading</p>}><Broken /></Suspense>
        </RouteErrorBoundary>,
      )
    })
    expect(alertText()).toBe('Could not load this page (Failed to fetch dynamically imported module).')

    await act(async () => {
      root.render(
        <RouteErrorBoundary resetKey="/blog">
          <Suspense fallback={<p>loading</p>}><Fine /></Suspense>
        </RouteErrorBoundary>,
      )
    })
    expect(container.textContent).toBe('fine page')
  })
})

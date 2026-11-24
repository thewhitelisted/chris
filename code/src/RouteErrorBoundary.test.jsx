import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Suspense, lazy } from 'react'
import RouteErrorBoundary from './RouteErrorBoundary.jsx'
import { mount } from './testUtils.js'

function Throws({ value }) {
  throw value
}

function Fine() {
  return <p>fine page</p>
}

let view

beforeEach(() => {
  view = mount()
})

afterEach(() => {
  view.unmount()
})

const alertText = () => view.container.querySelector('[role="alert"]')?.textContent

describe('RouteErrorBoundary', () => {
  it('renders children when nothing throws', async () => {
    await view.render(<RouteErrorBoundary resetKey="/a"><Fine /></RouteErrorBoundary>)
    expect(view.container.textContent).toBe('fine page')
    expect(alertText()).toBeUndefined()
  })

  it('shows the error message in place of a child that throws', async () => {
    await view.render(<RouteErrorBoundary resetKey="/a"><Throws value={new Error('boom')} /></RouteErrorBoundary>)
    expect(alertText()).toBe('Could not load this page (boom).')
    expect(view.caught.map((e) => e.message)).toEqual(['boom'])
  })

  it.each([
    ['null', null, 'unknown error'],
    ['undefined', undefined, 'unknown error'],
    ['an empty string', '', 'unknown error'],
    ['a string', 'chunk gone', 'chunk gone'],
    ['a plain object', { code: 42 }, 'unknown error'],
    ['an Error with no message', new Error(''), 'unknown error'],
  ])('contains a thrown %s and still shows the error view', async (_, value, shown) => {
    await view.render(<RouteErrorBoundary resetKey="/a"><Throws value={value} /></RouteErrorBoundary>)
    expect(alertText()).toBe(`Could not load this page (${shown}).`)
  })

  it('keeps showing the error while the reset key is unchanged', async () => {
    await view.render(<RouteErrorBoundary resetKey="/a"><Throws value={new Error('boom')} /></RouteErrorBoundary>)
    await view.render(<RouteErrorBoundary resetKey="/a"><Fine /></RouteErrorBoundary>)
    expect(alertText()).toBe('Could not load this page (boom).')
  })

  it('recovers when the reset key changes', async () => {
    await view.render(<RouteErrorBoundary resetKey="/a"><Throws value={null} /></RouteErrorBoundary>)
    await view.render(<RouteErrorBoundary resetKey="/b"><Fine /></RouteErrorBoundary>)
    expect(alertText()).toBeUndefined()
    expect(view.container.textContent).toBe('fine page')
  })

  it('catches a lazy component whose import rejects', async () => {
    const Broken = lazy(() => Promise.reject(new TypeError('Failed to fetch dynamically imported module')))
    await view.render(
      <RouteErrorBoundary resetKey="/projects">
        <Suspense fallback={<p>loading</p>}><Broken /></Suspense>
      </RouteErrorBoundary>,
    )
    expect(alertText()).toBe('Could not load this page (Failed to fetch dynamically imported module).')
  })
})

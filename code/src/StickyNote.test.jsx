import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { projects } from 'virtual:projects'
import StickyNote from './StickyNote.jsx'
import { mount } from './testUtils.js'

// happy-dom does no layout, so the note's rendered size is stubbed: it is what the browser would report.

let view
let noteSize
let observers

// Records what the note observes, so a test can report a size change the way the browser would.
class FakeResizeObserver {
  constructor(callback) {
    this.callback = callback
    this.observed = []
    this.disconnected = false
    observers.push(this)
  }
  observe(element) { this.observed.push(element) }
  disconnect() { this.disconnected = true }
}

beforeEach(() => {
  observers = []
  vi.stubGlobal('ResizeObserver', FakeResizeObserver)
  view = mount()
  noteSize = { width: 300, height: 438 }
  const sizeOf = (axis) => function () { return this.classList.contains('sticky-note') ? noteSize[axis] : 0 }
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(sizeOf('width'))
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(sizeOf('height'))
  window.happyDOM.setViewport({ width: 1280, height: 720 })
})

afterEach(() => {
  view.unmount()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const stealth = projects.find((p) => p.slug === 'stealth-alpha')
const note = () => view.container.querySelector('.sticky-note')
const box = () => ({ x: parseFloat(note().style.left), y: parseFloat(note().style.top) })

const open = (initialPosition) => view.render(
  <MemoryRouter>
    <StickyNote project={stealth} entries={[]} initialPosition={initialPosition} zIndex={1} onClose={() => {}} onBringToFront={() => {}} />
  </MemoryRouter>,
)

const resize = (width, height) => act(async () => {
  window.happyDOM.setViewport({ width, height })
  window.dispatchEvent(new Event('resize'))
})

const mouse = (type, target, x, y) => act(async () => {
  target.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: x, clientY: y }))
})

describe('StickyNote placement', () => {
  it('moves a note placed too low up so its bottom, links included, is on screen', async () => {
    await open({ x: 40, y: 370 })
    expect(box()).toEqual({ x: 40, y: 720 - 438 - 8 })
  })

  it('leaves a note that fits where Projects put it', async () => {
    await open({ x: 40, y: 120 })
    expect(box()).toEqual({ x: 40, y: 120 })
  })

  it('moves a note placed off the right or left edge back in', async () => {
    await open({ x: 1200, y: 100 })
    expect(box().x).toBe(1280 - 300 - 8)
    view.unmount()
    view = mount()
    await open({ x: -30, y: 100 })
    expect(box().x).toBe(8)
  })

  it('refits when the window shrinks', async () => {
    await open({ x: 900, y: 250 })
    await resize(800, 600)
    expect(box()).toEqual({ x: 800 - 300 - 8, y: 600 - 438 - 8 })
  })

  it('stops a drag at the bottom edge using the measured height', async () => {
    await open({ x: 40, y: 100 })
    await mouse('mousedown', note().querySelector('.sticky-note-title'), 50, 110)
    await mouse('mousemove', document, 50, 5000)
    await mouse('mouseup', document, 50, 5000)
    expect(box().y).toBe(720 - 438 - 8)
  })

  it('refits when the note itself grows, as reported by its ResizeObserver', async () => {
    await open({ x: 40, y: 250 })
    expect(box().y).toBe(250)
    const [observer] = observers
    expect(observer.observed).toEqual([note()])
    noteSize = { width: 300, height: 600 }
    await act(async () => observer.callback([]))
    expect(box()).toEqual({ x: 40, y: 720 - 600 - 8 })
  })

  it('stops observing and listening when it closes', async () => {
    const added = vi.spyOn(window, 'addEventListener')
    const removed = vi.spyOn(window, 'removeEventListener')
    await open({ x: 40, y: 100 })
    const [, onResize] = added.mock.calls.find(([type]) => type === 'resize')
    const [observer] = observers
    expect(observer.disconnected).toBe(false)
    view.unmount()
    view = mount()
    expect(observer.disconnected).toBe(true)
    expect(removed.mock.calls.some(([type, fn]) => type === 'resize' && fn === onResize)).toBe(true)
  })
})

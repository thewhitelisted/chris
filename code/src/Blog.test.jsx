import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import Blog from './Blog.jsx'
import { mount } from './testUtils.js'

let view

function Probe() {
  return <p className="probe">{useLocation().pathname}</p>
}

beforeEach(async () => {
  view = mount()
  await view.render(
    <MemoryRouter initialEntries={['/blog']}>
      <Routes>
        <Route path="/blog" element={<Blog />} />
        <Route path="*" element={<Probe />} />
      </Routes>
    </MemoryRouter>,
  )
})

afterEach(() => view.unmount())

const rows = () => [...view.container.querySelectorAll('.row')]
const listed = () => rows().map((r) => [r.querySelector('.file-name').textContent, r.querySelector('.devlog-tag')?.textContent ?? null, r.querySelector('.col.date').textContent])
const titles = () => rows().map((r) => r.querySelector('.file-name').textContent)
const header = (label) => [...view.container.querySelectorAll('.header-button')].find((b) => b.textContent.startsWith(label))

async function search(text) {
  const input = view.container.querySelector('.toolbar-search')
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
  await act(async () => {
    setValue.call(input, text)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

describe('Blog list with devlog entries', () => {
  it('mixes entries in with posts, newest first, tagging entries with their project', () => {
    expect(listed()).toEqual([
      ['fills & <slippage>', 'stealth-alpha devlog', '20 November, 2026'],
      ['vol of vol', 'notes devlog', '2 November, 2026'],
      ['first take', 'stealth-alpha devlog', '5 October, 2026'],
      ['shelving it', 'shelved devlog', '10 February, 2026'],
      ['R&D <notes>', null, '1 January, 2026'],
      ['how i deal with having adhd', null, '18 June, 2025'],
    ])
  })

  it('keeps the Name and Date sort headers working across both kinds', async () => {
    await act(async () => header('Name').click())
    expect(titles()).toEqual(['fills & <slippage>', 'first take', 'how i deal with having adhd', 'R&D <notes>', 'shelving it', 'vol of vol'])
    await act(async () => header('Date').click())
    expect(titles()[0]).toBe('fills & <slippage>')
    await act(async () => header('Date').click())
    expect(titles()).toEqual(['how i deal with having adhd', 'R&D <notes>', 'shelving it', 'first take', 'vol of vol', 'fills & <slippage>'])
  })

  it('finds entries by project and by "devlog", and posts by slug', async () => {
    await search('stealth')
    expect(titles()).toEqual(['fills & <slippage>', 'first take'])
    await search('devlog')
    expect(titles()).toHaveLength(4)
    await search('r-and-d')
    expect(titles()).toEqual(['R&D <notes>'])
  })

  it('opens an entry at its entry page and a post at its blog page', async () => {
    await act(async () => rows()[0].click())
    expect(view.container.querySelector('.probe').textContent).toBe('/projects/stealth-alpha/2026-11-20')
  })

  it('opens a post at its blog page', async () => {
    await act(async () => rows()[4].click())
    expect(view.container.querySelector('.probe').textContent).toBe('/blog/r-and-d')
  })
})

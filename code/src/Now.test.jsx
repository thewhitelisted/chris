import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import Now from './Now.jsx'
import { mount } from './testUtils.js'

let view

beforeEach(async () => {
  view = mount()
  await view.render(<MemoryRouter initialEntries={['/now']}><Now /></MemoryRouter>)
})

afterEach(() => view.unmount())

const cards = () => [...view.container.querySelectorAll('.project-card')]
const card = (title) => cards().find((c) => c.querySelector('.sticky-note-title').textContent === title)
const latest = (c) => c.querySelector('a.sticky-note-devlog')

describe('Now page', () => {
  it('lists only in-progress projects, newest first', () => {
    expect(view.container.querySelector('h1.post-title').textContent).toBe('Now')
    expect(cards().map((c) => c.querySelector('.sticky-note-title').textContent)).toEqual(['stealth-alpha', 'quiet', 'fresh', 'notes'])
    expect(view.container.querySelector('.now-empty')).toBeNull()
  })

  it('links the title to the timeline and shows stats and the latest entry linking to its page', () => {
    const c = card('stealth-alpha')
    expect(c.querySelector('.sticky-note-title a').getAttribute('href')).toBe('/projects/stealth-alpha')
    expect([...c.querySelectorAll('.stats-language')].map((li) => li.textContent)).toEqual(['Python91.4%', 'Shell8.6%'])
    expect(c.querySelector('.stats-activity-text').textContent).toBe('17 commits in the last 30 days')
    expect(latest(c).getAttribute('href')).toBe('/projects/stealth-alpha/2026-11-20')
    expect(latest(c).textContent).toBe('Latest update · 20 November, 2026fills & <slippage>')
  })

  it('says there are no entries yet, with no title link, for a project without entries', () => {
    const c = card('quiet')
    expect(c.querySelector('.sticky-note-title a')).toBeNull()
    expect(latest(c)).toBeNull()
    expect(c.querySelector('.now-no-entry').textContent).toBe('No devlog entries yet.')
    expect(c.querySelector('.stats-languages')).toBeNull()
    expect(c.querySelector('.stats-activity-text').textContent).toBe('0 commits in the last 30 days')
  })

  it('shows languages only when activity is null', () => {
    const c = card('fresh')
    expect([...c.querySelectorAll('.stats-language')].map((li) => li.textContent)).toEqual(['Go100%'])
    expect(c.querySelector('.stats-activity')).toBeNull()
  })

  it('shows no stats block for stats null, and the latest entry', () => {
    const c = card('notes')
    expect(c.querySelector('.project-stats')).toBeNull()
    expect(latest(c).getAttribute('href')).toBe('/projects/notes/2026-11-02')
  })
})

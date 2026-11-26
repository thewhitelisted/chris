import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { projects } from 'virtual:projects'
import ProjectCard from './ProjectCard.jsx'
import { mount } from './testUtils.js'

let view
beforeEach(() => { view = mount() })
afterEach(() => view.unmount())

const bySlug = (slug) => projects.find((p) => p.slug === slug)
const status = () => view.container.querySelector('.sticky-note-status')?.textContent ?? null

describe('ProjectCard status pill', () => {
  it.each([
    ['stealth-alpha', 'In progress'],
    ['shelved', 'Archived'],
    ['shipped', null],
  ])('shows %s as %s, like the /projects list', async (slug, expected) => {
    await view.render(<MemoryRouter><ProjectCard project={bySlug(slug)} headingLevel={1} /></MemoryRouter>)
    expect(status()).toBe(expected)
    expect(view.container.querySelector('h1').textContent).toBe(slug)
  })
})

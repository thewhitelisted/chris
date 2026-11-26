import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import Now from './Now.jsx'
import { mount } from './testUtils.js'

vi.mock('virtual:projects', async (importOriginal) => {
  const { projects } = await importOriginal()
  return { projects: projects.filter((p) => p.status !== 'in-progress') }
})

describe('Now page with nothing in progress', () => {
  it('says so and links to the projects page', async () => {
    const view = mount()
    await view.render(<MemoryRouter><Now /></MemoryRouter>)
    expect(view.container.querySelectorAll('.project-card')).toHaveLength(0)
    expect(view.container.querySelector('.now-empty').textContent).toBe('Nothing in progress right now. See projects for finished work.')
    expect(view.container.querySelector('.now-empty a').getAttribute('href')).toBe('/projects')
    view.unmount()
  })
})

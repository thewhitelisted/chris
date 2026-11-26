import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import Projects from './Projects.jsx'
import { mount } from './testUtils.js'

let view

beforeEach(async () => {
  view = mount()
  await view.render(<Projects />)
})

afterEach(() => view.unmount())

const rows = () => [...view.container.querySelectorAll('.row')]
const rowTitles = () => rows().map((row) => row.querySelector('.file-name').textContent)
const row = (title) => rows().find((r) => r.querySelector('.file-name').textContent === title)
const note = () => document.body.querySelector('.sticky-note')

async function openNote(title) {
  await act(async () => row(title).click())
  return note()
}

async function search(text) {
  const input = view.container.querySelector('.toolbar-search')
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
  await act(async () => {
    setValue.call(input, text)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

describe('Projects page status and privacy', () => {
  it('lists in-progress projects first, newest first, then complete, then archived', () => {
    expect(rowTitles()).toEqual(['stealth-alpha', 'notes', 'shipped', 'shelved'])
  })

  it('shows a status badge on in-progress and archived rows, and none on complete ones', () => {
    expect(rows().map((r) => r.querySelector('.status-badge')?.textContent ?? null)).toEqual(['In progress', 'In progress', null, 'Archived'])
    expect(row('stealth-alpha').querySelector('.status-badge').className).toBe('status-badge status-in-progress')
  })

  it('has a sortable Status column', async () => {
    const header = [...view.container.querySelectorAll('.header-button')].find((b) => b.textContent.startsWith('Status'))
    expect(header.className).toContain('active')
    await act(async () => header.click())
    expect(rowTitles()).toEqual(['shelved', 'shipped', 'notes', 'stealth-alpha'])
  })

  it('marks only private repos with a lock', () => {
    expect(rows().filter((r) => r.querySelector('.private-icon')).map((r) => r.querySelector('.file-name').textContent)).toEqual(['stealth-alpha'])
    expect(row('stealth-alpha').querySelector('.private-icon').getAttribute('aria-label')).toBe('Private repository')
  })

  it('finds projects by status and by "private"', async () => {
    await search('in progress')
    expect(rowTitles()).toEqual(['stealth-alpha', 'notes'])
    await search('private')
    expect(rowTitles()).toEqual(['stealth-alpha'])
    await search('archived')
    expect(rowTitles()).toEqual(['shelved'])
    await search('complete')
    expect(rowTitles()).toEqual([])
  })

  it('shows start and last-updated dates, "Source private" and no code link for a private in-progress repo', async () => {
    const card = await openNote('stealth-alpha')
    expect(card.querySelector('.sticky-note-date').textContent).toBe('Started September 2026 · Last updated 20 November, 2026')
    expect(card.querySelector('.sticky-note-status').textContent).toBe('In progress')
    expect(card.querySelector('.sticky-note-private').textContent).toBe('Source private')
    expect([...card.querySelectorAll('.sticky-note-link')].map((a) => [a.textContent, a.getAttribute('href')])).toEqual([['Live', 'https://stealth.example']])
  })

  it('shows only the start date for an in-progress project with no last-updated date', async () => {
    const card = await openNote('notes')
    expect(card.querySelector('.sticky-note-date').textContent).toBe('Started May 2026')
  })

  it('shows the plain creation date and a code link for a complete public repo', async () => {
    const card = await openNote('shipped')
    expect(card.querySelector('.sticky-note-date').textContent).toBe('February 2025')
    expect(card.querySelector('.sticky-note-status')).toBeNull()
    expect(card.querySelector('.sticky-note-private')).toBeNull()
    expect([...card.querySelectorAll('.sticky-note-link')].map((a) => a.textContent)).toEqual(['Code'])
  })

  it('labels an archived repo in its note', async () => {
    const card = await openNote('shelved')
    expect(card.querySelector('.sticky-note-status').textContent).toBe('Archived')
    expect(card.querySelector('.sticky-note-date').textContent).toBe('January 2026')
  })
})

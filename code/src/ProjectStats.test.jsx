import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import ProjectStats from './ProjectStats.jsx'
import { mount } from './testUtils.js'

// Input classes: stats null; languages [] with activity null; languages only; activity only;
// one language at 100%; several languages (more than the opacity steps); all-zero weeks; one commit.

let view
beforeEach(() => { view = mount() })
afterEach(() => view.unmount())

const weeks = (...last) => [...Array(52 - last.length).fill(0), ...last]
const stats = () => view.container.querySelector('.project-stats')
const legend = () => [...view.container.querySelectorAll('.stats-language')].map((li) => li.textContent)
const segments = () => [...view.container.querySelectorAll('.stats-language-segment')]
const bars = () => [...view.container.querySelectorAll('.stats-sparkline-week')]
const activityText = () => view.container.querySelector('.stats-activity-text')?.textContent

describe('ProjectStats', () => {
  it('renders nothing for stats null', async () => {
    await view.render(<ProjectStats stats={null} />)
    expect(view.container.innerHTML).toBe('')
  })

  it('renders nothing when there are no languages and no activity', async () => {
    await view.render(<ProjectStats stats={{ languages: [], activity: null }} />)
    expect(view.container.innerHTML).toBe('')
  })

  it('shows languages as proportional segments with a readable legend, largest first', async () => {
    await view.render(<ProjectStats stats={{ languages: [{ name: 'Python', percent: 91.4 }, { name: 'Shell', percent: 8.6 }], activity: null }} />)
    expect(legend()).toEqual(['Python91.4%', 'Shell8.6%'])
    expect(view.container.querySelector('.stats-language-legend').getAttribute('aria-label')).toBe('Languages')
    expect(view.container.querySelector('.stats-language-bar').getAttribute('aria-hidden')).toBe('true')
    expect(segments().map((s) => [s.style.flexGrow, s.style.opacity])).toEqual([['91.4', '1'], ['8.6', '0.7']])
    expect(view.container.querySelector('.stats-sparkline')).toBeNull()
    expect(activityText()).toBeUndefined()
  })

  it('shows one language at 100%', async () => {
    await view.render(<ProjectStats stats={{ languages: [{ name: 'Go', percent: 100 }], activity: null }} />)
    expect(legend()).toEqual(['Go100%'])
    expect(segments().map((s) => s.style.flexGrow)).toEqual(['100'])
  })

  it('keeps the last opacity step for languages past the sixth', async () => {
    const languages = 'ABCDEFGH'.split('').map((name) => ({ name, percent: 12.5 }))
    await view.render(<ProjectStats stats={{ languages, activity: null }} />)
    expect(segments().map((s) => s.style.opacity)).toEqual(['1', '0.7', '0.5', '0.36', '0.26', '0.18', '0.18', '0.18'])
    expect(legend()).toHaveLength(8)
  })

  it('draws 52 weekly bars scaled to the busiest week, oldest first, and the 30-day count', async () => {
    await view.render(<ProjectStats stats={{ languages: [], activity: { weekly: weeks(3, 0, 12, 5), last30Days: 17 } }} />)
    expect(bars()).toHaveLength(52)
    const heights = bars().map((b) => Number(b.getAttribute('height')))
    expect(heights.slice(0, 48).every((h) => h === 0)).toBe(true)
    expect(heights.slice(48)).toEqual([3 / 12 * 19, 0, 19, 5 / 12 * 19])
    expect(bars().map((b) => Number(b.getAttribute('x')))[51]).toBeCloseTo(51.15)
    expect(view.container.querySelector('.stats-sparkline').getAttribute('aria-label'))
      .toBe('Commits per week over the last 52 weeks: 20 commits in all, at most 12 in one week')
    expect(activityText()).toBe('17 commits in the last 30 days')
    expect(view.container.querySelector('.stats-languages')).toBeNull()
  })

  it('draws flat bars, not NaN, when every week is zero', async () => {
    await view.render(<ProjectStats stats={{ languages: [], activity: { weekly: weeks(), last30Days: 0 } }} />)
    expect(bars().map((b) => b.getAttribute('height'))).toEqual(Array(52).fill('0'))
    expect(activityText()).toBe('0 commits in the last 30 days')
  })

  it('says "1 commit"', async () => {
    await view.render(<ProjectStats stats={{ languages: [], activity: { weekly: weeks(1), last30Days: 1 } }} />)
    expect(activityText()).toBe('1 commit in the last 30 days')
    expect(stats().querySelector('.stats-sparkline').getAttribute('aria-label')).toContain('1 commit in all, at most 1 in one week')
  })
})

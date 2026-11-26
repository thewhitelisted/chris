import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Markdown from './Markdown.jsx'
import { mount } from './testUtils.js'

// Post and devlog bodies are author-written, but they are still rendered as markdown only:
// raw HTML stays text and unsafe URL schemes are dropped.

let view
beforeEach(() => { view = mount() })
afterEach(() => view.unmount())

const render = (text) => view.render(<Markdown text={text} />)

describe('Markdown safety', () => {
  it('renders an inline raw HTML image with onerror as text, not as an element', async () => {
    await render('before <img src="x" onerror="alert(1)"> after')
    expect(view.container.querySelector('img')).toBeNull()
    expect(view.container.querySelector('[onerror]')).toBeNull()
    expect(view.container.querySelector('p').textContent).toBe('before <img src="x" onerror="alert(1)"> after')
  })

  it('renders a raw HTML block (script, iframe) as text', async () => {
    await render('<script>alert(1)</script>\n\n<iframe src="https://example.com"></iframe>')
    expect(view.container.querySelector('script, iframe')).toBeNull()
    expect(view.container.textContent).toContain('<script>alert(1)</script>')
    expect(view.container.textContent).toContain('<iframe src="https://example.com"></iframe>')
  })

  it.each([
    'javascript:alert(1)',
    'JavaScript:alert(1)',
    'vbscript:msgbox(1)',
    'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
  ])('drops a %s link target, keeping the text', async (url) => {
    await render(`[click](<${url}>)`)
    const link = view.container.querySelector('a')
    expect(link.textContent).toBe('click')
    expect(link.getAttribute('href') ?? '').toBe('')
  })

  it('drops a javascript: image source', async () => {
    await render('![alt](<javascript:alert(1)>)')
    expect(view.container.querySelector('img').getAttribute('src') ?? '').toBe('')
  })

  it('keeps ordinary https, relative and mailto links', async () => {
    await render('[a](https://example.com/x) [b](/projects/notes) [c](mailto:me@example.com)')
    expect([...view.container.querySelectorAll('a')].map((a) => a.getAttribute('href'))).toEqual(['https://example.com/x', '/projects/notes', 'mailto:me@example.com'])
  })
})

describe('Markdown tables and images', () => {
  it('puts a table in its own focusable scroll box, with header and body cells and GFM alignment', async () => {
    await render('| a | b |\n|:--|--:|\n| https://example.com/a/very/long/path | 2 |')
    const wrap = view.container.querySelector('div.post-table-wrap')
    expect(wrap.getAttribute('role')).toBe('region')
    expect(wrap.getAttribute('aria-label')).toBe('Table')
    expect(wrap.getAttribute('tabindex')).toBe('0')
    expect(wrap.querySelector('table.post-table')).not.toBeNull()
    expect([...wrap.querySelectorAll('th.post-table-cell')].map((c) => [c.textContent, c.style.textAlign])).toEqual([['a', 'left'], ['b', 'right']])
    expect([...wrap.querySelectorAll('td.post-table-cell')].map((c) => [c.textContent, c.style.textAlign])).toEqual([['https://example.com/a/very/long/path', 'left'], ['2', 'right']])
  })

  it('renders an image with the post-image class, keeping src, alt and title', async () => {
    await render('![a chart](/img/chart.png "Weekly commits")')
    const img = view.container.querySelector('img')
    expect([img.className, img.getAttribute('src'), img.getAttribute('alt'), img.getAttribute('title')]).toEqual(['post-image', '/img/chart.png', 'a chart', 'Weekly commits'])
  })
})

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

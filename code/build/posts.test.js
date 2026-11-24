import { describe, it, expect } from 'vitest'
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { parsePost, checkUniqueSlugs, sortNewestFirst, loadPosts, ContentError } from './posts.js'

const good = '---\ntitle: hello\ndate: 2025-06-18\ndescription: a post\n---\n\n# Heading\n\nBody text.\n'

function frontmatter(lines, body = '# Body\n') {
  return `---\n${lines.join('\n')}\n---\n${body}`
}

async function postsDir(files) {
  const dir = await mkdtemp(path.join(tmpdir(), 'posts-'))
  for (const [name, text] of Object.entries(files)) {
    if (text === null) await mkdir(path.join(dir, name))
    else await writeFile(path.join(dir, name), text)
  }
  return dir
}

describe('parsePost', () => {
  it('reads the three fields and strips the frontmatter from the body', () => {
    expect(parsePost('posts/hello.md', good)).toEqual({
      file: 'posts/hello.md',
      slug: 'hello',
      title: 'hello',
      date: '2025-06-18',
      description: 'a post',
      body: '# Heading\n\nBody text.\n',
    })
  })

  it('keeps a "---" rule inside the body', () => {
    const post = parsePost('a.md', frontmatter(['title: t', 'date: 2025-01-01', 'description: d'], 'one\n\n---\n\ntwo\n'))
    expect(post.body).toBe('one\n\n---\n\ntwo\n')
  })

  it('accepts CRLF line endings and a BOM', () => {
    const post = parsePost('a.md', '\uFEFF' + good.replace(/\n/g, '\r\n'))
    expect(post.title).toBe('hello')
    expect(post.body).toBe('# Heading\n\nBody text.\n')
  })

  it('keeps colons, quotes and unicode in values', () => {
    const post = parsePost('a.md', frontmatter(['title: "R&D: <a> \\"quoted\\" — ünï"', 'date: 2024-02-29', "description: 'it''s fine'"]))
    expect(post.title).toBe('R&D: <a> "quoted" — ünï')
    expect(post.description).toBe("it's fine")
  })

  it.each([
    ['no frontmatter', '# just a body\n', /must start with a "---" frontmatter block/],
    ['unclosed frontmatter', '---\ntitle: t\ndate: 2025-01-01\ndescription: d\n# body\n', /must start with a "---" frontmatter block/],
    ['frontmatter not at the top', '\n' + good, /must start with a "---" frontmatter block/],
    ['missing title', frontmatter(['date: 2025-01-01', 'description: d']), /missing frontmatter field "title"/],
    ['missing date', frontmatter(['title: t', 'description: d']), /missing frontmatter field "date"/],
    ['missing description', frontmatter(['title: t', 'date: 2025-01-01']), /missing frontmatter field "description"/],
    ['empty title', frontmatter(['title: ""', 'date: 2025-01-01', 'description: d']), /"title" must be a non-empty string/],
    ['blank description', frontmatter(['title: t', 'date: 2025-01-01', 'description: "   "']), /"description" must be a non-empty string/],
    ['null title', frontmatter(['title:', 'date: 2025-01-01', 'description: d']), /"title" must be a non-empty string/],
    ['numeric title', frontmatter(['title: 2025', 'date: 2025-01-01', 'description: d']), /"title" must be a non-empty string/],
    ['list title', frontmatter(['title: [a, b]', 'date: 2025-01-01', 'description: d']), /"title" must be a non-empty string/],
    ['unknown field', frontmatter(['title: t', 'date: 2025-01-01', 'description: d', 'tags: x']), /unknown frontmatter field\(s\): tags/],
    ['misspelt field', frontmatter(['title: t', 'date: 2025-01-01', 'descripton: d']), /unknown frontmatter field\(s\): descripton/],
    ['month-only date', frontmatter(['title: t', 'date: 2025-01', 'description: d']), /date must be YYYY-MM-DD/],
    ['prose date', frontmatter(['title: t', 'date: June 18 2025', 'description: d']), /date must be YYYY-MM-DD/],
    ['timestamp date', frontmatter(['title: t', 'date: 2025-06-18T00:00:00Z', 'description: d']), /date must be YYYY-MM-DD/],
    ['impossible date', frontmatter(['title: t', 'date: 2025-02-29', 'description: d']), /not a real calendar date/],
    ['month 13', frontmatter(['title: t', 'date: 2025-13-01', 'description: d']), /not a real calendar date/],
    ['invalid YAML', frontmatter(['title: a: b', 'date: 2025-01-01', 'description: d']), /not valid YAML/],
    ['scalar frontmatter', frontmatter(['just text']), /must be key: value pairs/],
    ['empty frontmatter', '---\n\n---\nbody\n', /must be key: value pairs/],
    ['empty body', frontmatter(['title: t', 'date: 2025-01-01', 'description: d'], '\n  \n'), /post body is empty/],
    ['an unquoted " #" that YAML would cut off', frontmatter(['title: C# is #1', 'date: 2025-01-01', 'description: d']), /contains a YAML comment/],
    ['a trailing comment', frontmatter(['title: t', 'date: 2025-01-01', 'description: d # note']), /contains a YAML comment/],
    ['a comment after the date', frontmatter(['title: t', 'date: 2025-01-01 # c', 'description: d']), /contains a YAML comment/],
    ['a full-line comment first', frontmatter(['# draft', 'title: t', 'date: 2025-01-01', 'description: d']), /contains a YAML comment/],
    ['a full-line comment last', frontmatter(['title: t', 'date: 2025-01-01', 'description: d', '# end']), /contains a YAML comment/],
    ['a control character in the title', frontmatter(['title: "a\\u0007b"', 'date: 2025-01-01', 'description: d']), /"title" contains the control character U\+0007/],
    ['a NUL in the description', frontmatter(['title: t', 'date: 2025-01-01', 'description: "x\\0y"']), /"description" contains the control character U\+0000/],
    ['a lone surrogate', frontmatter(['title: "a\\uD800b"', 'date: 2025-01-01', 'description: d']), /control character U\+D800/],
    ['U+FFFF', frontmatter(['title: "a\\uFFFFb"', 'date: 2025-01-01', 'description: d']), /control character U\+FFFF/],
  ])('rejects %s, naming the file', (_name, source, message) => {
    let error
    try {
      parsePost('posts/broken.md', source)
    } catch (err) {
      error = err
    }
    expect(error).toBeInstanceOf(ContentError)
    expect(error.message).toMatch(/^posts\/broken\.md: /)
    expect(error.message).toMatch(message)
  })

  it.each(['Hello.md', 'my post.md', 'a_b.md', '-a.md', 'a--b.md', 'a.markdown', 'a.md.txt'])('rejects the file name %s', (name) => {
    expect(() => parsePost(name, good)).toThrow(ContentError)
  })

  it('rejects the reserved slug "index", which would replace the blog listing page', () => {
    expect(() => parsePost('posts/index.md', good)).toThrow('posts/index.md: "index" is reserved; rename the file')
    expect(parsePost('posts/indexes.md', good).slug).toBe('indexes')
  })

  it('accepts # inside a quoted value or without a preceding space', () => {
    expect(parsePost('a.md', frontmatter(['title: "C# is #1"', 'date: 2025-01-01', 'description: a#b'])).title).toBe('C# is #1')
    expect(parsePost('a.md', frontmatter(['title: C#', 'date: 2025-01-01', 'description: a#b'])).description).toBe('a#b')
  })

  it('allows tabs and newlines in values', () => {
    const post = parsePost('a.md', frontmatter(['title: "a\\tb"', 'date: 2025-01-01', 'description: |', '  line one', '  line two']))
    expect(post.title).toBe('a\tb')
    expect(post.description).toBe('line one\nline two\n')
  })
})

describe('checkUniqueSlugs', () => {
  it('passes distinct slugs', () => {
    expect(() => checkUniqueSlugs([{ slug: 'a', file: 'a.md' }, { slug: 'b', file: 'b.md' }])).not.toThrow()
  })

  it('names both files when a slug repeats', () => {
    expect(() => checkUniqueSlugs([{ slug: 'a', file: 'x/a.md' }, { slug: 'b', file: 'b.md' }, { slug: 'a', file: 'y/a.md' }]))
      .toThrow('y/a.md: duplicate slug "a" (also used by x/a.md)')
  })
})

describe('sortNewestFirst', () => {
  it('orders by date descending, then slug, without mutating', () => {
    const posts = [
      { slug: 'b', date: '2025-01-01' },
      { slug: 'c', date: '2026-03-04' },
      { slug: 'a', date: '2025-01-01' },
    ]
    expect(sortNewestFirst(posts).map((p) => p.slug)).toEqual(['c', 'a', 'b'])
    expect(posts.map((p) => p.slug)).toEqual(['b', 'c', 'a'])
  })
})

describe('loadPosts', () => {
  it('discovers every .md file, newest first, ignoring dotfiles', async () => {
    const dir = await postsDir({
      'older.md': frontmatter(['title: old', 'date: 2024-01-01', 'description: d']),
      'newer.md': frontmatter(['title: new', 'date: 2025-01-01', 'description: d']),
      '.DS_Store': 'junk',
    })
    expect((await loadPosts(dir)).map((p) => p.slug)).toEqual(['newer', 'older'])
  })

  it('returns an empty list for an empty folder', async () => {
    expect(await loadPosts(await postsDir({}))).toEqual([])
  })

  it('fails on a non-markdown file', async () => {
    const dir = await postsDir({ 'notes.txt': 'x' })
    await expect(loadPosts(dir)).rejects.toThrow(/notes\.txt: posts must be \.md files/)
  })

  it('fails on a sub-folder', async () => {
    const dir = await postsDir({ drafts: null })
    await expect(loadPosts(dir)).rejects.toThrow(/drafts: only \.md files belong/)
  })

  it('fails when one of several posts is invalid, naming it', async () => {
    const dir = await postsDir({ 'ok.md': good, 'bad.md': frontmatter(['title: t', 'date: 2025-01-01']) })
    await expect(loadPosts(dir)).rejects.toThrow(/bad\.md: missing frontmatter field "description"/)
  })

  it('loads the real posts folder with both converted posts, newest first', async () => {
    const posts = await loadPosts(path.join(import.meta.dirname, '../../posts'))
    expect(posts.map((p) => p.slug)).toEqual(['first-work-experience', 'handling-adhd'])
    expect(posts[0]).toMatchObject({
      title: 'my first work experience in finance',
      date: '2026-04-25',
      description: "I had the opportunity to work at one of Canada's biggest pension funds this winter, here's what I learnt",
    })
    expect(posts[0].body.startsWith('# my first work experience in finance\n')).toBe(true)
    const adhd = posts.find((p) => p.slug === 'handling-adhd')
    expect(adhd).toMatchObject({
      title: 'how i deal with having adhd',
      date: '2025-06-18',
      description: 'handing adhd as a double degree student pursing finance',
    })
    expect(adhd.body.startsWith('# handling adhd as a second year double degree student\n')).toBe(true)
    expect(adhd.body).not.toMatch(/^title:/m)
  })
})

import { parseDocument, visit } from 'yaml'
import { formatDate } from '../src/dates.js'
import { invalidXmlChar } from './text.js'

const FULL_DATE = /^\d{4}-\d{2}-\d{2}$/
const FIELDS = ['title', 'date', 'description']
const FRONTMATTER = /^---\n([\s\S]*?)\n---(?:\n|$)/

export class ContentError extends Error {
  constructor(file, message) {
    super(`${file}: ${message}`)
    this.name = 'ContentError'
    this.file = file
  }
}

export function parseFrontmatter(file, source) {
  const text = source.replace(/^﻿/, '').replace(/\r\n?/g, '\n')
  const match = FRONTMATTER.exec(text)
  if (!match) throw new ContentError(file, 'must start with a "---" frontmatter block closed by "---"')

  const doc = parseDocument(match[1])
  if (doc.errors.length) throw new ContentError(file, `frontmatter is not valid YAML: ${doc.errors[0].message}`)
  if (hasComment(doc)) {
    throw new ContentError(file, 'frontmatter contains a YAML comment (" #"); quote the value if the # is part of it, e.g. title: "C# is #1"')
  }
  const data = doc.toJS()
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    throw new ContentError(file, `frontmatter must be key: value pairs (${FIELDS.join(', ')})`)
  }

  const unknown = Object.keys(data).filter((key) => !FIELDS.includes(key))
  if (unknown.length) throw new ContentError(file, `unknown frontmatter field(s): ${unknown.join(', ')}`)
  for (const field of FIELDS) {
    if (!(field in data)) throw new ContentError(file, `missing frontmatter field "${field}"`)
    if (typeof data[field] !== 'string' || data[field].trim() === '') {
      throw new ContentError(file, `frontmatter field "${field}" must be a non-empty string (quote it if it looks like a number)`)
    }
    const bad = invalidXmlChar(data[field])
    if (bad) throw new ContentError(file, `frontmatter field "${field}" contains the control character ${bad}`)
  }
  if (!FULL_DATE.test(data.date)) throw new ContentError(file, `date must be YYYY-MM-DD, got ${JSON.stringify(data.date)}`)
  try {
    formatDate(data.date)
  } catch (err) {
    throw new ContentError(file, `date is not a real calendar date: ${err.message}`)
  }

  const body = text.slice(match[0].length).replace(/^\n+/, '')
  if (body.trim() === '') throw new ContentError(file, 'body after the frontmatter is empty')

  return { title: data.title, date: data.date, description: data.description, body }
}

function hasComment(doc) {
  let found = Boolean(doc.comment || doc.commentBefore)
  visit(doc, (_key, node) => {
    if (node?.comment || node?.commentBefore) found = true
  })
  return found
}

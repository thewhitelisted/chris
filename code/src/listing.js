import { useState } from 'react'
import { compareIsoDates } from './dates.js'
import { STATUSES } from './projectStatus.js'

const COMPARATORS = {
  name: (a, b) => a.title.localeCompare(b.title),
  date: (a, b) => compareIsoDates(a.date, b.date),
  type: (a, b) => a.type.localeCompare(b.type),
  status: (a, b) => statusRank(a) - statusRank(b) || compareIsoDates(b.date, a.date),
}

function statusRank(item) {
  const rank = STATUSES.indexOf(item.status)
  if (rank === -1) throw new Error(`Unknown project status: ${JSON.stringify(item.status)}`)
  return rank
}

export const INITIAL_SORT = { key: 'date', dir: 'desc' }
export const PROJECTS_INITIAL_SORT = { key: 'status', dir: 'asc' }

export function nextSort(sort, key) {
  if (sort.key === key) return { key, dir: sort.dir === 'asc' ? 'desc' : 'asc' }
  return { key, dir: key === 'date' ? 'desc' : 'asc' }
}

export function sortItems(items, { key, dir }) {
  const compare = COMPARATORS[key]
  if (!compare) throw new Error(`Unknown sort key: ${key}`)
  return items.slice().sort((a, b) => (dir === 'asc' ? compare(a, b) : compare(b, a)))
}

export function filterItems(items, query, searchableText) {
  const needle = query.toLowerCase()
  return items.filter((item) => searchableText(item).some((text) => text.toLowerCase().includes(needle)))
}

export function useListing(items, searchableText, initialSort = INITIAL_SORT) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState(initialSort)
  return {
    query,
    setQuery,
    sort,
    toggleSort: (key) => setSort((prev) => nextSort(prev, key)),
    visible: sortItems(filterItems(items, query, searchableText), sort),
  }
}

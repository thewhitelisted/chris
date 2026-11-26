import { useState, useEffect } from 'react'
import { describeError } from './describeError.js'

async function fetchMarkdown(url, signal) {
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  if ((res.headers.get('content-type') ?? '').includes('text/html')) {
    throw new Error('not found')
  }
  return res.text()
}

// null while url loads, then { status: 'success', text } or { status: 'error', message }.
export function useMarkdown(url) {
  const [result, setResult] = useState(null)

  useEffect(() => {
    const controller = new AbortController()
    fetchMarkdown(url, controller.signal).then(
      (text) => {
        if (!controller.signal.aborted) setResult({ url, status: 'success', text })
      },
      (err) => {
        if (!controller.signal.aborted) setResult({ url, status: 'error', message: describeError(err) })
      },
    )
    return () => controller.abort()
  }, [url])

  return result?.url === url ? result : null
}

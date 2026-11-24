import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import './BlogPost.css'

const components = {
  h1: ({children}) => <h1 className="post-title">{children}</h1>,
  h2: ({children}) => <h2 className="post-heading">{children}</h2>,
  h3: ({children}) => <h3 className="post-subheading">{children}</h3>,
  p: ({children}) => <p className="post-paragraph">{children}</p>,
  em: ({children}) => <em className="post-date">{children}</em>,
  ul: ({children}) => <ul className="post-list">{children}</ul>,
  ol: ({children}) => <ol className="post-ordered-list">{children}</ol>,
  li: ({children}) => <li className="post-list-item">{children}</li>,
  code: ({children}) => <code className="post-inline-code">{children}</code>,
  pre: ({children}) => <pre className="post-code-block">{children}</pre>,
  blockquote: ({children}) => <blockquote className="post-quote">{children}</blockquote>,
  hr: () => <hr className="post-divider" />,
  strong: ({children}) => <strong className="post-bold">{children}</strong>,
}

async function fetchMarkdown(url, signal) {
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  if ((res.headers.get('content-type') ?? '').includes('text/html')) {
    throw new Error('not found')
  }
  return res.text()
}

function MarkdownPage({ url }) {
  const [result, setResult] = useState(null)

  useEffect(() => {
    const controller = new AbortController()
    fetchMarkdown(url, controller.signal).then(
      (text) => {
        if (!controller.signal.aborted) setResult({ url, text })
      },
      (err) => {
        if (!controller.signal.aborted) setResult({ url, error: err.message })
      },
    )
    return () => controller.abort()
  }, [url])

  if (result?.url !== url) {
    return <div className="content-page"><p className="content-loading">Loading...</p></div>
  }

  if (result.error) {
    return (
      <div className="content-page">
        <p className="post-paragraph" role="alert">Could not load {url} ({result.error}).</p>
      </div>
    )
  }

  return (
    <motion.div
      className="content-page"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {result.text}
      </ReactMarkdown>
    </motion.div>
  )
}

export default MarkdownPage

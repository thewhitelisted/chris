import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
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

function BlogPost() {
  const { slug } = useParams()
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const paths = [`/posts/${slug}.md`, `./posts/${slug}.md`]
    const tryLoad = async () => {
      for (const path of paths) {
        try {
          const res = await fetch(path)
          if (res.ok) { setContent(await res.text()); return }
        } catch {}
      }
      setError(`Post not found: ${slug}`)
    }
    if (slug) tryLoad().finally(() => setLoading(false))
  }, [slug])

  if (loading) return <div className="content-page"><p className="content-loading">Loading...</p></div>
  if (error) return <div className="content-page"><p className="post-paragraph">{error}</p></div>

  return (
    <motion.div
      className="content-page"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </motion.div>
  )
}

export default BlogPost

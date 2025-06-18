import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ArrowLeft } from 'lucide-react'
import './BlogPost.css'

function BlogPost() {
  const { slug } = useParams()
  const [markdownContent, setMarkdownContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  useEffect(() => {
    const loadMarkdown = async () => {
      try {
        setLoading(true)
        // Try multiple possible paths for compatibility
        const possiblePaths = [
          `/website/posts/${slug}.md`,
          `/posts/${slug}.md`,
          `./posts/${slug}.md`
        ]
        
        let content = null
        let lastError = null
        
        for (const path of possiblePaths) {
          try {
            const response = await fetch(path)
            if (response.ok) {
              content = await response.text()
              break
            }
          } catch (err) {
            lastError = err
          }
        }
        
        if (!content) {
          throw new Error(`Post not found: ${slug}`)
        }
        
        setMarkdownContent(content)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    if (slug) {
      loadMarkdown()
    }
  }, [slug])

  const containerVariants = {
    hidden: { opacity: 0, y: 50 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.8,
        staggerChildren: 0.1
      }
    }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6 }
    }
  }

  if (loading) {
    return (
      <div className="blog-post-container">
        <div className="blog-post-content">
          <div className="loading">Loading...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="blog-post-container">
        <div className="blog-post-content">
          <div className="error">
            <h1>Post Not Found</h1>
            <p>{error}</p>
            <Link to="/blog" className="back-link">
              <ArrowLeft size={16} />
              back to blog
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="blog-post-container">
      <motion.div
        className="blog-post-content"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Back to Blog Button */}
        <Link to="/blog">
          <motion.div
            className="back-button"
            variants={itemVariants}
            whileHover={{ 
              scale: 1.05,
              transition: { duration: 0.2 }
            }}
            whileTap={{ scale: 0.95 }}
          >
            <ArrowLeft size={16} />
            back to blog
          </motion.div>
        </Link>

        {/* Markdown Content */}
        <motion.article
          className="markdown-content"
          variants={itemVariants}
        >
          <ReactMarkdown 
            remarkPlugins={[remarkGfm]}
            components={{
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
            }}
          >
            {markdownContent}
          </ReactMarkdown>
        </motion.article>
      </motion.div>
    </div>
  )
}

export default BlogPost

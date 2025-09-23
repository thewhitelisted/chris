import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import './BlogPost.css'

function Hobbies() {
  const [markdownContent, setMarkdownContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [pageHtmls, setPageHtmls] = useState([])
  const sourceRef = useRef(null)

  useEffect(() => {
    const loadMarkdown = async () => {
      try {
        setLoading(true)
        // Try multiple possible paths for compatibility
        const possiblePaths = [
          `/hobbies.md`,
          `./hobbies.md`,
          `/chris/hobbies.md`
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
          throw new Error(`Hobbies content not found`)
        }
        
        setMarkdownContent(content)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    loadMarkdown()
  }, [])

  // Paginate into letter-sized pages after content loads
  useEffect(() => {
    let rafId = 0
    const buildPages = () => {
      const source = sourceRef.current
      if (!source) return
      if (!source.innerHTML || source.children.length === 0) {
        rafId = requestAnimationFrame(buildPages)
        return
      }
      
      // Calculate based on current page width using Letter ratio (11/8.5), then subtract vertical padding (60+60)
      const pagesContainer = document.querySelector('.pages')
      const pageOuterWidth = pagesContainer?.clientWidth || 720
      const pageOuterHeight = Math.round(pageOuterWidth * (11 / 8.5))
      const pageInnerHeight = Math.max(1, pageOuterHeight - 120)
      const pages = []
      let current = document.createElement('div')
      current.className = 'markdown-content'
      const scratch = document.createElement('div')
      scratch.style.position = 'absolute'
      scratch.style.visibility = 'hidden'
      scratch.style.width = `${(pageOuterWidth - 120)}px`
      document.body.appendChild(scratch)
      
      const children = Array.from(source.children)
      children.forEach((node) => {
        // Special handling for unordered lists only - keep ordered lists together
        if (node.tagName === 'UL') {
          const listItems = Array.from(node.children)
          listItems.forEach((listItem) => {
            // Create a new list container for each item or group of items
            const listContainer = document.createElement(node.tagName)
            listContainer.className = node.className
            listContainer.appendChild(listItem.cloneNode(true))
            
            scratch.innerHTML = ''
            scratch.appendChild(current.cloneNode(true))
            const testCurrent = scratch.firstChild
            testCurrent.appendChild(listContainer)
            const height = testCurrent.scrollHeight
            
            if (height > pageInnerHeight && current.childNodes.length > 0) {
              pages.push(current.innerHTML)
              current = document.createElement('div')
              current.className = 'markdown-content'
              current.appendChild(listContainer)
            } else {
              // Try to merge with existing list if possible
              const existingList = current.querySelector(node.tagName.toLowerCase() + ':last-child')
              if (existingList && existingList.tagName === node.tagName) {
                existingList.appendChild(listItem.cloneNode(true))
              } else {
                current.appendChild(listContainer)
              }
            }
          })
        } else {
          // Normal handling for non-list elements
          const clone = node.cloneNode(true)
          scratch.innerHTML = ''
          scratch.appendChild(current.cloneNode(true))
          const testCurrent = scratch.firstChild
          testCurrent.appendChild(clone)
          const height = testCurrent.scrollHeight
          if (height > pageInnerHeight && current.childNodes.length > 0) {
            pages.push(current.innerHTML)
            current = document.createElement('div')
            current.className = 'markdown-content'
            current.appendChild(clone)
          } else {
            current.appendChild(clone)
          }
        }
      })
      pages.push(current.innerHTML)
      document.body.removeChild(scratch)
      const nonEmptyPages = pages.filter(html => html && html.trim() !== '')
      setPageHtmls(nonEmptyPages)
    }
    
    rafId = requestAnimationFrame(buildPages)
    const onResize = () => {
      setPageHtmls([])
      rafId = requestAnimationFrame(buildPages)
    }
    window.addEventListener('resize', onResize)
    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', onResize)
    }
  }, [markdownContent])

  if (loading) {
    return <div className="blog-post-content"><div className="loading">Loading...</div></div>
  }

  if (error) {
    return (
      <div className="blog-post-content">
        <div className="error">
          <h1>Content Not Found</h1>
          <p>{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="blog-post-paginated">
      {/* Hidden source render for measurement */}
      <div id="hidden-markdown-source" ref={sourceRef} style={{position:'absolute', visibility:'hidden', width:600, pointerEvents:'none'}}>
        <ReactMarkdown 
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({children}) => <h1 className="post-title">re: {children}</h1>,
            h2: ({children}) => <h2 className="post-heading">--- {children}</h2>,
            h3: ({children}) => <h3 className="post-subheading">--- --- {children}</h3>,
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
      </div>

      <motion.div className="pages" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
        {pageHtmls.length > 0 ? (
          pageHtmls.map((html, idx) => (
            <motion.div key={idx} className="paper-page" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: idx * 0.05 }}>
              <motion.article className="markdown-content" dangerouslySetInnerHTML={{__html: html}} />
            </motion.div>
          ))
        ) : (
          <motion.div className="paper-page" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <motion.article className="markdown-content">
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({children}) => <h1 className="post-title">hobbies: {children}</h1>,
                  h2: ({children}) => <h2 className="post-heading">--- {children}</h2>,
                  h3: ({children}) => <h3 className="post-subheading">--- --- {children}</h3>,
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
        )}
      </motion.div>
    </div>
  )
}

export default Hobbies

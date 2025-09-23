import { useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { FileText, Search } from 'lucide-react'
import { blogPosts } from './blogData.js'
import './Blog.css'

function Blog() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState('')
  const [sortKey, setSortKey] = useState('date') // 'name' | 'date'
  const [sortDir, setSortDir] = useState('desc') // 'asc' | 'desc'

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

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir(key === 'date' ? 'desc' : 'asc')
    }
  }

  const visiblePosts = (() => {
    const filtered = blogPosts.filter(p =>
      p.title.toLowerCase().includes(filter.toLowerCase()) ||
      p.slug.toLowerCase().includes(filter.toLowerCase())
    )
    const sorted = filtered.slice().sort((a, b) => {
      if (sortKey === 'name') {
        const cmp = a.title.localeCompare(b.title)
        return sortDir === 'asc' ? cmp : -cmp
      } else {
        const da = Date.parse(a.date)
        const db = Date.parse(b.date)
        const cmp = da - db
        return sortDir === 'asc' ? cmp : -cmp
      }
    })
    return sorted
  })()

  return (
    <motion.div className="blog-window" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
      <div className="titlebar">
        <div className="traffic">
          <span className="light red" />
          <span className="light yellow" />
          <span className="light green" />
        </div>
        <div className="window-title">Blog</div>
      </div>
      <div className="toolbar">
        <div className="breadcrumbs">Home / Blog</div>
        <div className="search-wrap">
          <Search className="search-icon" size={14} />
          <input
            className="toolbar-search"
            placeholder="Search posts"
            value={filter}
            onChange={(e)=>setFilter(e.target.value)}
          />
        </div>
      </div>
      <div className="explorer-split">
        <section className="explorer-content">
          <div className="list-header">
            <button className={`header-button${sortKey==='name' ? ' active' : ''}`} onClick={()=>handleSort('name')}>
              <span>Name</span>
              <span className="sort-caret">{sortKey==='name' ? (sortDir==='asc' ? '▲' : '▼') : ''}</span>
            </button>
            <button className={`header-button${sortKey==='date' ? ' active' : ''}`} onClick={()=>handleSort('date')}>
              <span>Date Created</span>
              <span className="sort-caret">{sortKey==='date' ? (sortDir==='asc' ? '▲' : '▼') : ''}</span>
            </button>
          </div>
          <div className="list-body">
            {visiblePosts.map((post) => (
              <button key={post.slug} className="row" onClick={()=>navigate(`/blog/${post.slug}`)}>
                <div className="col name">
                  <FileText className="file-icon" size={16} />
                  <span className="file-name">{post.title}</span>
                </div>
                <div className="col date">{post.date}</div>
              </button>
            ))}
          </div>
        </section>
      </div>
    </motion.div>
  )
}

export default Blog

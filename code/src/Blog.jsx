import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { FileText, Search } from 'lucide-react'
import { blogPosts } from 'virtual:posts'
import { formatDate } from './dates.js'
import { useListing } from './listing.js'
import SortHeader from './SortHeader.jsx'

const COLUMNS = [
  { key: 'name', label: 'Name' },
  { key: 'date', label: 'Date Created' },
]

const searchableText = (post) => [post.title, post.slug]

function Blog() {
  const navigate = useNavigate()
  const { query, setQuery, sort, toggleSort, visible } = useListing(blogPosts, searchableText)

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
            value={query}
            onChange={(e)=>setQuery(e.target.value)}
          />
        </div>
      </div>
      <div className="explorer-split">
        <section className="explorer-content">
          <SortHeader columns={COLUMNS} sort={sort} onSort={toggleSort} />
          <div className="list-body">
            {visible.map((post) => (
              <button key={post.slug} className="row" onClick={()=>navigate(`/blog/${post.slug}`)}>
                <div className="col name">
                  <FileText className="file-icon" size={16} />
                  <span className="file-name">{post.title}</span>
                </div>
                <div className="col date">{formatDate(post.date)}</div>
              </button>
            ))}
          </div>
        </section>
      </div>
    </motion.div>
  )
}

export default Blog

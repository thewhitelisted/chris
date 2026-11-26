import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { FileText, NotebookPen, Search } from 'lucide-react'
import { blogPosts } from 'virtual:posts'
import { projects } from 'virtual:projects'
import { devlogs } from 'virtual:devlogs'
import { blogListItems } from './devlogs.js'
import { formatDate } from './dates.js'
import { useListing } from './listing.js'
import SortHeader from './SortHeader.jsx'

const COLUMNS = [
  { key: 'name', label: 'Name' },
  { key: 'date', label: 'Date Created' },
]

const items = blogListItems(blogPosts, devlogs, projects)

const searchableText = (item) => item.searchText

function Blog() {
  const navigate = useNavigate()
  const { query, setQuery, sort, toggleSort, visible } = useListing(items, searchableText)

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
            placeholder="Search posts and devlogs"
            value={query}
            onChange={(e)=>setQuery(e.target.value)}
          />
        </div>
      </div>
      <div className="explorer-split">
        <section className="explorer-content">
          <SortHeader columns={COLUMNS} sort={sort} onSort={toggleSort} />
          <div className="list-body">
            {visible.map((item) => (
              <button key={item.key} className="row" onClick={()=>navigate(item.path)}>
                <div className="col name">
                  {item.project === null
                    ? <FileText className="file-icon" size={16} />
                    : <NotebookPen className="file-icon" size={16} />}
                  <span className="file-name">{item.title}</span>
                  {item.project !== null && <span className="devlog-tag">{item.project} devlog</span>}
                </div>
                <div className="col date">{formatDate(item.date)}</div>
              </button>
            ))}
          </div>
        </section>
      </div>
    </motion.div>
  )
}

export default Blog

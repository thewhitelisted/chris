import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { blogPosts } from './blogData.js'
import './Blog.css'

function Blog() {

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

  return (
    <div className="blog-container">
      <motion.div
        className="blog-content"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >        {/* Back to Home Button */}
        <Link to="/">
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
            back to home
          </motion.div>
        </Link>

        {/* Blog Title */}
        <motion.h1 
          className="blog-title"
          variants={itemVariants}
        >
          blog
        </motion.h1>

        {/* Blog Posts */}
        <motion.div 
          className="blog-posts"
          variants={itemVariants}
        >          {blogPosts.map((post, index) => (
            <Link key={index} to={`/blog/${post.slug}`} className="blog-post-link">
              <motion.article
                className="blog-post"
                variants={itemVariants}
                whileHover={{ 
                  scale: 1.02,
                  transition: { duration: 0.2 }
                }}
              >
                <div className="post-header">
                  <h2 className="post-title">{post.title}</h2>
                  <div className="title-underline"></div>
                </div>
                <div className="post-meta">
                  <span className="post-date">{post.date}</span>
                  <span className="post-separator">·</span>
                  <span className="post-description">{post.description}</span>
                </div>
              </motion.article>
            </Link>
          ))}
        </motion.div>
      </motion.div>
    </div>
  )
}

export default Blog

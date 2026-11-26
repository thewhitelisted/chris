import { motion } from 'framer-motion'
import Loading from './Loading.jsx'
import Markdown from './Markdown.jsx'
import { useMarkdown } from './useMarkdown.js'

function MarkdownPage({ url }) {
  const result = useMarkdown(url)

  if (result === null) {
    return <Loading />
  }

  if (result.status === 'error') {
    return (
      <div className="content-page">
        <p className="post-paragraph" role="alert">Could not load {url} ({result.message}).</p>
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
      <Markdown text={result.text} />
    </motion.div>
  )
}

export default MarkdownPage

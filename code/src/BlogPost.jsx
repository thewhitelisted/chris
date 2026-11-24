import { useParams } from 'react-router-dom'
import MarkdownPage from './MarkdownPage.jsx'

function BlogPost() {
  const { slug } = useParams()
  return <MarkdownPage url={`/posts/${encodeURIComponent(slug)}.md`} />
}

export default BlogPost

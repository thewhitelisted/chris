import Markdown from './Markdown.jsx'
import { useMarkdown } from './useMarkdown.js'
import { entryBodyUrl } from './devlogs.js'

function DevlogBody({ entry }) {
  const url = entryBodyUrl(entry)
  const result = useMarkdown(url)

  if (result === null) {
    return <p className="content-loading">Loading...</p>
  }
  if (result.status === 'error') {
    return <p className="post-paragraph" role="alert">Could not load {url} ({result.message}).</p>
  }
  if (result.text.trim() === '') {
    return <p className="devlog-empty">This entry has no text.</p>
  }
  return <div className="devlog-body"><Markdown text={result.text} /></div>
}

export default DevlogBody

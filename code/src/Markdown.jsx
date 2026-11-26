import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

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
  img: ({src, alt, title}) => <img className="post-image" src={src} alt={alt} title={title} />,
  // A wide table scrolls inside its own box instead of widening the page.
  table: ({children}) => (
    <div className="post-table-wrap" role="region" aria-label="Table" tabIndex={0}>
      <table className="post-table">{children}</table>
    </div>
  ),
  th: ({children, style}) => <th className="post-table-cell" style={style}>{children}</th>,
  td: ({children, style}) => <td className="post-table-cell" style={style}>{children}</td>,
}

function Markdown({ text }) {
  return <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>{text}</ReactMarkdown>
}

export default Markdown

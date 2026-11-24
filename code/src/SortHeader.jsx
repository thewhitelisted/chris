function SortHeader({ columns, sort, onSort }) {
  return (
    <div className="list-header">
      {columns.map(({ key, label }) => (
        <button key={key} className={`header-button${sort.key === key ? ' active' : ''}`} onClick={() => onSort(key)}>
          <span>{label}</span>
          <span className="sort-caret">{sort.key === key ? (sort.dir === 'asc' ? '▲' : '▼') : ''}</span>
        </button>
      ))}
    </div>
  )
}

export default SortHeader

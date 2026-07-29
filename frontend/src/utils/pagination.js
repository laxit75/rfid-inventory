/**
 * Pagination utility for data tables.
 * Inspired by the PartnerManagement component from the sw attendance management system.
 */

export function paginate(items, page = 1, pageSize = 10) {
  const total = Math.max(1, Math.ceil(items.length / pageSize))
  const safePage = Math.min(Math.max(1, page), total)
  const start = (safePage - 1) * pageSize
  return {
    page: safePage,
    pageSize,
    total,
    from: items.length === 0 ? 0 : start + 1,
    to: Math.min(start + pageSize, items.length),
    rows: items.slice(start, start + pageSize),
    hasNext: safePage < total,
    hasPrev: safePage > 1
  }
}

/**
 * A reusable pagination bar component.
 */
export function PaginationBar({ pager, onPageChange, pageSize, onPageSizeChange }) {
  if (!pager || pager.total <= 1 && !pageSize) return null

  return (
    <div className="pagination-bar">
      <div className="pagination-info">
        Showing {pager.from}–{pager.to} of {pager.total + (pageSize ? ` (page ${pager.page})` : '')}
      </div>
      <div className="pagination-controls">
        {onPageSizeChange && (
          <select
            value={pager.pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="pagination-size-select"
            aria-label="Page size"
          >
            {[5, 10, 20, 50, 100].map(size => (
              <option key={size} value={size}>{size} per page</option>
            ))}
          </select>
        )}
        <button
          className="pagination-btn"
          disabled={!pager.hasPrev}
          onClick={() => onPageChange(pager.page - 1)}
          aria-label="Previous page"
        >
          ‹
        </button>
        <span className="pagination-page">{pager.page} / {pager.total}</span>
        <button
          className="pagination-btn"
          disabled={!pager.hasNext}
          onClick={() => onPageChange(pager.page + 1)}
          aria-label="Next page"
        >
          ›
        </button>
      </div>
    </div>
  )
}

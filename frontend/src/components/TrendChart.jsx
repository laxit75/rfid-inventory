import React from 'react'

export default function TrendChart({ data = [], width = 720, height = 180, padding = 24, highlightDates = [], onBarClick = () => {} }) {
  const max = Math.max(...data.map(d => d.total), 1)
  const barWidth = data.length > 0 ? (width - padding * 2) / data.length : 10

  return (
    <div style={{ overflowX: 'auto' }} className="trend-chart">
      <svg width={Math.max(width, data.length * 14)} height={height} viewBox={`0 0 ${Math.max(width, data.length * 14)} ${height}`}>
        <defs>
          <linearGradient id="g1" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#60a5fa" stopOpacity="0.8" />
          </linearGradient>
          <linearGradient id="g2" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#f97316" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#fb923c" stopOpacity="0.8" />
          </linearGradient>
        </defs>
        {/* grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((f, i) => (
          <line key={i} x1={padding} x2={Math.max(width, data.length * 14) - padding} y1={padding + (height - padding * 2) * f} y2={padding + (height - padding * 2) * f} stroke="#eef2ff" />
        ))}

        {data.map((d, i) => {
          const w = barWidth * 0.75
          const x = padding + i * barWidth + (barWidth - w) / 2
          const h = ((d.total) / max) * (height - padding * 2)
          const y = height - padding - h
          const isHighlighted = highlightDates.includes(d.date)
          return (
            <g key={d.date}>
              <rect
                x={x}
                y={y}
                width={w}
                height={h}
                fill={isHighlighted ? 'url(#g2)' : 'url(#g1)'}
                style={{ cursor: 'pointer', transition: 'opacity 140ms, transform 140ms' }}
                onClick={() => onBarClick(d.date)}
              >
                <title>{`${d.date}: ${d.total}`}</title>
              </rect>
              <text x={x + w / 2} y={height - padding + 14} fontSize="10" fill={isHighlighted ? '#0b1220' : '#475569'} textAnchor="middle" style={{ transformOrigin: `${x + w / 2}px ${height - padding + 14}px`, transform: 'rotate(-45deg)' }}>
                {new Date(d.date).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit' })}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

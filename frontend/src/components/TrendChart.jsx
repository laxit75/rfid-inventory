import React from 'react'

export default function TrendChart({ data = [], width = 720, height = 180, padding = 24, highlightDates = [], onBarClick = () => {} }) {
  const max = Math.max(...data.map(d => d.total), 1)
  const barWidth = data.length > 0 ? (width - padding * 2) / data.length : 10
  const svgWidth = Math.max(width, data.length * 14)
  const plotTop = padding
  const plotBottom = height - padding
  const plotH = plotBottom - plotTop

  // Top-center points of each bar, used to draw the soft area fill
  const areaPoints = data.map((d, i) => {
    const w = barWidth * 0.72
    const x = padding + i * barWidth + (barWidth - w) / 2
    const h = Math.max(2, (d.total / max) * plotH)
    const y = plotBottom - h
    return { x: x + w / 2, y }
  })
  const areaPath = areaPoints.length > 0
    ? `M ${areaPoints[0].x} ${plotBottom}` +
      areaPoints.map(p => ` L ${p.x} ${p.y}`).join('') +
      ` L ${areaPoints[areaPoints.length - 1].x} ${plotBottom} Z`
    : ''

  return (
    <div style={{ overflowX: 'auto' }}>
      <style>{`
        .trend-bar {
          transform-box: fill-box;
          transform-origin: bottom center;
          animation: trend-grow 0.65s cubic-bezier(0.22, 1, 0.36, 1) both;
          transition: filter 140ms ease;
          cursor: pointer;
        }
        .trend-bar:hover { filter: brightness(1.14); }
        @keyframes trend-grow {
          from { transform: scaleY(0.02); opacity: 0.35; }
          to   { transform: scaleY(1); opacity: 1; }
        }
      `}</style>
      <svg
        width={svgWidth}
        height={height}
        viewBox={`0 0 ${svgWidth} ${height}`}
        style={{ display: 'block' }}
      >
        <defs>
          <linearGradient id="trend-bar-normal" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#5b8bff" />
            <stop offset="100%" stopColor="#2f67f6" />
          </linearGradient>
          <linearGradient id="trend-bar-highlight" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#8fb0ff" />
            <stop offset="100%" stopColor="#1d4ed8" />
          </linearGradient>
          <linearGradient id="trend-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(47,103,246,0.18)" />
            <stop offset="100%" stopColor="rgba(47,103,246,0)" />
          </linearGradient>
        </defs>

        {/* Soft area fill behind the bars */}
        {areaPath && <path d={areaPath} fill="url(#trend-area)" />}

        {/* Horizontal grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((f, i) => (
          <line
            key={i}
            x1={padding}
            x2={svgWidth - padding}
            y1={plotTop + plotH * f}
            y2={plotTop + plotH * f}
            stroke={i === 0 ? 'rgba(47, 103, 246, 0.16)' : 'rgba(71, 85, 105, 0.10)'}
            strokeDasharray={i === 0 ? '0' : '4 4'}
          />
        ))}

        {/* Y-axis labels */}
        <text x={padding - 6} y={plotTop + 12} fontSize="9" fill="rgba(71,85,105,0.7)" textAnchor="end" style={{ pointerEvents: 'none' }}>
          {max}
        </text>
        <text x={padding - 6} y={plotBottom + 3} fontSize="9" fill="rgba(71,85,105,0.7)" textAnchor="end" style={{ pointerEvents: 'none' }}>
          0
        </text>

        {/* Bars */}
        {data.map((d, i) => {
          const w = barWidth * 0.72
          const x = padding + i * barWidth + (barWidth - w) / 2
          const h = Math.max(2, (d.total / max) * plotH)
          const y = plotBottom - h
          const isHighlighted = highlightDates.includes(d.date)

          return (
            <g key={d.date}>
              <rect
                className="trend-bar"
                x={x}
                y={y}
                width={w}
                height={h}
                rx={Math.min(4, w / 3)}
                fill={isHighlighted ? 'url(#trend-bar-highlight)' : 'url(#trend-bar-normal)'}
                style={{ animationDelay: `${Math.min(i * 22, 450)}ms` }}
                onClick={() => onBarClick(d.date)}
              >
                <title>{`${d.date}: ${d.total} violations`}</title>
              </rect>
              {/* Value label above bar (only if bar is tall enough) */}
              {h > 18 && d.total > 0 && (
                <text
                  x={x + w / 2}
                  y={y - 5}
                  fontSize="9.5"
                  fontWeight="700"
                  fill={isHighlighted ? '#1d4ed8' : 'rgba(71, 85, 105, 0.85)'}
                  textAnchor="middle"
                  style={{ pointerEvents: 'none' }}
                >
                  {d.total}
                </text>
              )}
              {/* Date label */}
              <text
                x={x + w / 2}
                y={plotBottom + 16}
                fontSize="9"
                fill={isHighlighted ? 'rgba(29, 78, 216, 0.95)' : 'rgba(100, 116, 139, 0.75)'}
                textAnchor="middle"
                style={{
                  transformOrigin: `${x + w / 2}px ${plotBottom + 16}px`,
                  transform: 'rotate(-45deg)',
                }}
              >
                {new Date(d.date).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit' })}
              </text>
            </g>
          )
        })}

        {/* Baseline */}
        <line x1={padding} x2={svgWidth - padding} y1={plotBottom} y2={plotBottom} stroke="rgba(71, 85, 105, 0.25)" />
      </svg>
    </div>
  )
}

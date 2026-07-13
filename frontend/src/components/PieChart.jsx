import React, { useRef, useState } from 'react'

function polarToCartesian(cx, cy, r, angleDeg) {
  const a = (angleDeg - 90) * Math.PI / 180.0
  return { x: cx + (r * Math.cos(a)), y: cy + (r * Math.sin(a)) }
}

function describeArc(cx, cy, r, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, r, endAngle)
  const end = polarToCartesian(cx, cy, r, startAngle)
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1'
  return [`M ${cx} ${cy}`, `L ${start.x} ${start.y}`, `A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`, 'Z'].join(' ')
}

export default function PieChart({ data = [], size = 160, innerRadius = 48 }) {
  const total = data.reduce((s, d) => s + Math.max(0, d.value), 0) || 1
  const cx = size / 2
  const cy = size / 2
  const r = size / 2
  const containerRef = useRef(null)
  const [hovered, setHovered] = useState(null)
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, html: '' })

  let angle = 0

  const handleEnter = (e, idx, slice, pct) => {
    setHovered(idx)
    const rect = containerRef.current?.getBoundingClientRect()
    const x = rect ? e.clientX - rect.left : 0
    const y = rect ? e.clientY - rect.top : 0
    setTooltip({ visible: true, x, y, html: `${slice.label}: ${slice.value} (${pct}%)` })
  }

  const handleMove = (e) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    setTooltip(t => ({ ...t, x: e.clientX - rect.left + 12, y: e.clientY - rect.top + 8 }))
  }

  const handleLeave = () => {
    setHovered(null)
    setTooltip({ visible: false, x: 0, y: 0, html: '' })
  }

  return (
    <div ref={containerRef} className="pie-chart-container" style={{ display: 'flex', gap: 16, alignItems: 'center', position: 'relative' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="pie-svg">
        {data.map((slice, idx) => {
          const value = Math.max(0, slice.value)
          const angleDelta = (value / total) * 360
          const start = angle
          const end = angle + angleDelta
          const mid = start + angleDelta / 2
          angle = end
          if (value === 0) return null
          const path = describeArc(cx, cy, r, start, end)
          const pct = Math.round((value / total) * 100)
          // label position
          const labelRad = innerRadius + (r - innerRadius) / 2
          const labelPos = polarToCartesian(cx, cy, labelRad, mid)

          return (
            <g key={idx}>
              <path
                d={path}
                fill={slice.color || '#888'}
                stroke="#fff"
                strokeWidth="1"
                style={{ transition: 'transform 180ms ease, opacity 180ms ease', transformOrigin: `${cx}px ${cy}px`, transform: hovered === idx ? 'scale(1.04)' : 'scale(1)' }}
                onMouseEnter={(e) => handleEnter(e, idx, slice, pct)}
                onMouseMove={handleMove}
                onMouseLeave={handleLeave}
              />
              {pct >= 6 && (
                <text x={labelPos.x} y={labelPos.y} fontSize={Math.max(10, Math.min(14, Math.round(size / 14)))} textAnchor="middle" fill="#fff" style={{ pointerEvents: 'none', fontWeight: 600 }}>
                  {pct}%
                </text>
              )}
            </g>
          )
        })}
        <circle cx={cx} cy={cy} r={innerRadius} fill="#fff" />
        <circle cx={cx} cy={cy} r={innerRadius - 1} fill="none" stroke="#e6e6e6" strokeWidth="1" />
        <text x={cx} y={cy - 8} fontSize="14" textAnchor="middle" fill="#111"><tspan fontWeight="600">{total}</tspan></text>
        <text x={cx} y={cy + 12} fontSize="11" textAnchor="middle" fill="#64748b">Total</text>
      </svg>

      <div className="pie-legend">
        {data.map((d, i) => {
          const pct = total > 0 ? Math.round((d.value / total) * 100) : 0
          return (
            <div key={i} className={`pie-legend-item ${hovered === i ? 'active' : ''}`}>
              <span className="legend-swatch" style={{ background: d.color || '#888' }} />
              <div className="legend-label">
                <div className="legend-title">{d.label}</div>
                <div className="legend-sub">{d.value} • {pct}%</div>
              </div>
            </div>
          )
        })}
      </div>

      {tooltip.visible && (
        <div className="pie-tooltip" style={{ left: tooltip.x, top: tooltip.y }} dangerouslySetInnerHTML={{ __html: tooltip.html }} />
      )}
    </div>
  )
}

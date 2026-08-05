import React, { useEffect, useRef, useState } from 'react'

// Angle in degrees measured clockwise from top → cartesian point
function polarToCartesian(cx, cy, r, angleDeg) {
  const a = (angleDeg - 90) * Math.PI / 180.0
  return { x: cx + (r * Math.cos(a)), y: cy + (r * Math.sin(a)) }
}

// Lighten (factor > 1) or darken (factor < 1) a hex color
function shade(hex, factor) {
  const n = parseInt(hex.replace('#', ''), 16)
  if (Number.isNaN(n)) return hex
  const r = Math.min(255, Math.round(((n >> 16) & 255) * factor))
  const g = Math.min(255, Math.round(((n >> 8) & 255) * factor))
  const b = Math.min(255, Math.round((n & 255) * factor))
  return `rgb(${r}, ${g}, ${b})`
}

// Rough luminance so labels stay readable on any slice color
function luminance(hex) {
  const n = parseInt(hex.replace('#', ''), 16)
  if (Number.isNaN(n)) return 0.5
  return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255
}

export default function PieChart({ data = [], size = 160, innerRadius = 48, onSliceClick = () => {} }) {
  const total = data.reduce((s, d) => s + Math.max(0, d.value), 0)
  const safeTotal = total || 1
  const cx = size / 2
  const cy = size / 2
  const ringW = size / 2 - innerRadius
  const ringR = innerRadius + ringW / 2
  const C = 2 * Math.PI * ringR
  const gap = Math.max(3, ringW * 0.55)

  const containerRef = useRef(null)
  const [hovered, setHovered] = useState(null)
  const [mounted, setMounted] = useState(false)
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, html: '' })

  // Trigger the sweep-in once after first paint
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const hasData = total > 0
  let anglePx = 0

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
    <div
      ref={containerRef}
      style={{ display: 'flex', gap: 20, alignItems: 'center', position: 'relative', flexWrap: 'wrap' }}
    >
      <div className="pie-chart-wrap" style={{ flexShrink: 0 }}>
        <style>{`
          .pie-chart-wrap { animation: pie-in 0.6s cubic-bezier(0.22, 1, 0.36, 1) both; }
          @keyframes pie-in {
            from { opacity: 0; transform: scale(0.86); }
            to   { opacity: 1; transform: scale(1); }
          }
          .pie-slice {
            animation: pie-sweep 0.95s cubic-bezier(0.22, 1, 0.36, 1) both;
          }
          @keyframes pie-sweep {
            from { stroke-dashoffset: var(--sweep, 500); }
            to   { stroke-dashoffset: 0; }
          }
        `}</style>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          style={{ display: 'block', overflow: 'visible', filter: 'drop-shadow(0 3px 8px rgba(15, 23, 42, 0.08))' }}
        >
          <defs>
            {data.map((slice, idx) => (
              <linearGradient key={idx} id={`pie-grad-${idx}`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor={shade(slice.color || '#94a3b8', 1.18)} />
                <stop offset="100%" stopColor={shade(slice.color || '#94a3b8', 0.82)} />
              </linearGradient>
            ))}
          </defs>

          {/* Faint full track for depth */}
          {hasData && (
            <circle cx={cx} cy={cy} r={ringR} fill="none" stroke="rgba(15, 23, 42, 0.045)" strokeWidth={ringW} />
          )}

          {/* Empty state track */}
          {!hasData && (
            <circle cx={cx} cy={cy} r={ringR} fill="none" stroke="rgba(71, 85, 105, 0.12)" strokeWidth={ringW} />
          )}

          {/* Rounded-cap donut segments */}
          {data.map((slice, idx) => {
            const value = Math.max(0, slice.value)
            const len = (value / safeTotal) * C
            const dash = Math.max(len - gap, 1.5)
            const rot = (anglePx / C) * 360
            anglePx += len
            if (value === 0) return null
            const pct = Math.round((value / safeTotal) * 100)
            const color = slice.color || '#94a3b8'
            const textFill = luminance(color) > 0.55 ? 'rgba(15, 23, 42, 0.92)' : '#ffffff'
            // Label sits at the angular center of this dash (SVG angle from 3 o'clock + 90° for the polar helper)
            const labelAngle = rot - 90 + (dash / C) * 180 + 90
            const lp = polarToCartesian(cx, cy, ringR, labelAngle)

            return (
              <g key={idx}>
                <circle
                  className="pie-slice"
                  cx={cx}
                  cy={cy}
                  r={ringR}
                  fill="none"
                  stroke={`url(#pie-grad-${idx})`}
                  strokeWidth={hovered === idx ? ringW + 7 : ringW}
                  strokeLinecap="round"
                  strokeDasharray={`${dash} ${C - dash}`}
                  transform={`rotate(${rot - 90} ${cx} ${cy})`}
                  style={{
                    '--sweep': C,
                    animationDelay: `${idx * 140}ms`,
                    transition: 'stroke-width 180ms ease, opacity 180ms ease, filter 180ms ease',
                    opacity: hovered !== null && hovered !== idx ? 0.5 : 1,
                    filter: hovered === idx ? 'drop-shadow(0 6px 14px rgba(47, 103, 246, 0.35))' : 'none',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => handleEnter(e, idx, slice, pct)}
                  onMouseMove={handleMove}
                  onMouseLeave={handleLeave}
                  onClick={() => onSliceClick(slice)}
                >
                  <title>{`${slice.label}: ${slice.value} (${pct}%)`}</title>
                </circle>
                {pct >= 8 && (
                  <text
                    x={lp.x}
                    y={lp.y}
                    fontSize={Math.max(10, Math.min(13, Math.round(size / 14)))}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={textFill}
                    style={{
                      pointerEvents: 'none',
                      fontWeight: 700,
                      opacity: mounted ? 1 : 0,
                      transition: 'opacity 300ms ease 450ms',
                    }}
                  >
                    {pct}%
                  </text>
                )}
              </g>
            )
          })}

          {/* Donut center — white with a soft ring */}
          <circle cx={cx} cy={cy} r={innerRadius} fill="#ffffff" />
          <circle cx={cx} cy={cy} r={innerRadius - 1} fill="none" stroke="rgba(71, 85, 105, 0.10)" strokeWidth="1" />

          {/* Center text */}
          {hasData ? (
            <>
              <text
                x={cx}
                y={cy - 8}
                fontSize="16"
                textAnchor="middle"
                fill="rgba(15, 23, 42, 0.92)"
                fontWeight="800"
                letterSpacing="-0.02em"
              >
                {total}
              </text>
              <text
                x={cx}
                y={cy + 11}
                fontSize="10"
                textAnchor="middle"
                fill="rgba(71, 85, 105, 0.7)"
                fontWeight="600"
                letterSpacing="0.08em"
              >
                TOTAL
              </text>
            </>
          ) : (
            <text
              x={cx}
              y={cy}
              fontSize="11"
              textAnchor="middle"
              dominantBaseline="middle"
              fill="rgba(71, 85, 105, 0.6)"
              fontWeight="600"
            >
              No data
            </text>
          )}
        </svg>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {data.map((d, i) => {
          const pct = total > 0 ? Math.round((d.value / total) * 100) : 0
          return (
            <div
              key={i}
              onClick={() => onSliceClick(d)}
              style={{
                display: 'flex',
                gap: 10,
                alignItems: 'center',
                padding: '6px 10px',
                borderRadius: 10,
                cursor: 'pointer',
                transition: 'background 160ms, transform 160ms',
                background: hovered === i ? 'rgba(47, 103, 246, 0.07)' : 'transparent',
                transform: hovered === i ? 'translateX(4px)' : 'none',
              }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              <span
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 5,
                  display: 'inline-block',
                  background: `linear-gradient(135deg, ${shade(d.color || '#94a3b8', 1.15)}, ${shade(d.color || '#94a3b8', 0.85)})`,
                  boxShadow: 'inset 0 0 0 1px rgba(15, 23, 42, 0.08)',
                  flexShrink: 0,
                }}
              />
              <div>
                <div style={{ fontWeight: 600, color: 'rgba(15, 23, 42, 0.92)', fontSize: '0.88rem' }}>
                  {d.label}
                </div>
                <div style={{ fontSize: 12, color: 'rgba(71, 85, 105, 0.8)' }}>
                  {d.value} • {pct}%
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Tooltip */}
      {tooltip.visible && (
        <div
          style={{
            position: 'absolute',
            pointerEvents: 'none',
            background: 'rgba(15, 15, 15, 0.92)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: 8,
            padding: '6px 10px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
            fontSize: 13,
            color: 'rgba(255, 255, 255, 0.90)',
            left: tooltip.x,
            top: tooltip.y,
            transform: 'translate(-8px, -100%)',
            whiteSpace: 'nowrap',
            zIndex: 10,
          }}
          dangerouslySetInnerHTML={{ __html: tooltip.html }}
        />
      )}
    </div>
  )
}

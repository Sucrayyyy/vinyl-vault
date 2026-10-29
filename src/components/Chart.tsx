import { motion } from 'motion/react'
import { useId, useMemo, useRef, useState } from 'react'
import { dateFmt } from '../lib/util'

export interface ChartPoint {
  at: number
  value: number
  label?: string
}

/**
 * Courbe de valeur animée avec lecture au doigt.
 * Les points sont reliés par des segments droits : aucune interpolation
 * « embellissante » entre deux observations réelles.
 */
export function ValueChart({
  points,
  height = 160,
  format,
  showDots = true,
}: {
  points: ChartPoint[]
  height?: number
  format: (n: number) => string
  showDots?: boolean
}) {
  const id = useId().replace(/:/g, '')
  const ref = useRef<SVGSVGElement>(null)
  const [hover, setHover] = useState<number | null>(null)
  const W = 340
  const H = height
  const PAD = { t: 14, b: 22, l: 4, r: 4 }

  const geo = useMemo(() => {
    if (points.length === 0) return null
    const xs = points.map((p) => p.at)
    const ys = points.map((p) => p.value)
    const x0 = Math.min(...xs)
    const x1 = Math.max(...xs)
    let y0 = Math.min(...ys)
    let y1 = Math.max(...ys)
    const span = y1 - y0 || Math.max(1, y1 * 0.1)
    y0 -= span * 0.25
    y1 += span * 0.15
    const sx = (x: number) => (x1 === x0 ? W / 2 : PAD.l + ((x - x0) / (x1 - x0)) * (W - PAD.l - PAD.r))
    const sy = (y: number) => PAD.t + (1 - (y - y0) / (y1 - y0)) * (H - PAD.t - PAD.b)
    const pts = points.map((p) => ({ x: sx(p.at), y: sy(p.value), p }))
    const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
    const area = `${line} L${pts[pts.length - 1].x.toFixed(1)},${H - PAD.b} L${pts[0].x.toFixed(1)},${H - PAD.b} Z`
    return { pts, line, area, x0, x1 }
  }, [points, H])

  if (!geo) return null

  const onMove = (clientX: number) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = ((clientX - rect.left) / rect.width) * W
    let best = 0
    geo.pts.forEach((p, i) => {
      if (Math.abs(p.x - x) < Math.abs(geo.pts[best].x - x)) best = i
    })
    setHover(best)
  }

  const active = hover != null ? geo.pts[hover] : geo.pts[geo.pts.length - 1]

  return (
    <div className="chart">
      <div className="chart-readout">
        <span className="chart-readout-value">{format(active.p.value)}</span>
        <span className="chart-readout-date">{active.p.label ?? dateFmt(active.p.at)}</span>
      </div>
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="chart-svg"
        onPointerMove={(e) => onMove(e.clientX)}
        onPointerDown={(e) => onMove(e.clientX)}
        onPointerLeave={() => setHover(null)}
        role="img"
        aria-label="Évolution de la valeur"
      >
        <defs>
          <linearGradient id={`fill${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--accent)" stopOpacity="0.28" />
            <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((k) => (
          <line key={k} x1="0" x2={W} y1={PAD.t + k * (H - PAD.t - PAD.b)} y2={PAD.t + k * (H - PAD.t - PAD.b)} className="chart-grid" />
        ))}
        <motion.path d={geo.area} fill={`url(#fill${id})`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.9, delay: 0.3 }} />
        <motion.path
          d={geo.line}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        />
        {showDots &&
          geo.pts.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={hover === i ? 4.5 : 2.4} className="chart-dot" vectorEffect="non-scaling-stroke" />
          ))}
        <line x1={active.x} x2={active.x} y1={PAD.t - 6} y2={H - PAD.b} className="chart-cursor" />
        <text x={PAD.l} y={H - 6} className="chart-axis">
          {dateFmt(geo.x0, { month: 'short', year: '2-digit' })}
        </text>
        <text x={W - PAD.r} y={H - 6} className="chart-axis" textAnchor="end">
          {dateFmt(geo.x1, { month: 'short', year: '2-digit' })}
        </text>
      </svg>
    </div>
  )
}

/** Barres horizontales animées (statistiques de profil). */
export function Bars({ data, format = (n) => String(n) }: { data: { label: string; value: number }[]; format?: (n: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <div className="bars">
      {data.map((d, i) => (
        <div className="bar-row" key={d.label}>
          <span className="bar-label">{d.label}</span>
          <div className="bar-track">
            <motion.span className="bar-fill" initial={{ width: 0 }} animate={{ width: `${(d.value / max) * 100}%` }} transition={{ duration: 0.8, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }} />
          </div>
          <span className="bar-value">{format(d.value)}</span>
        </div>
      ))}
    </div>
  )
}

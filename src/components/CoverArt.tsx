import { memo, useEffect, useRef, useState } from 'react'
import { getPhoto } from '../lib/db'
import { hash } from '../lib/util'
import { findArtwork } from '../services/itunes'

export interface CoverSource {
  artist: string
  title: string
  coverUrl?: string
  photoKey?: string
  coverSeed?: number
}

// Palettes éditoriales pour les pochettes générées (démo et disques sans visuel).
const PALETTES: [string, string, string][] = [
  ['#e8e2d4', '#151515', '#d24a2c'],
  ['#14213d', '#f1ede4', '#f2b134'],
  ['#1e1e1e', '#e9e6df', '#ff7a2e'],
  ['#c8d5cf', '#1d2b26', '#e0592a'],
  ['#2b1d3a', '#f4d9e8', '#ff6fb1'],
  ['#efe9dd', '#2a2a2a', '#2f6fd6'],
  ['#5b1b1b', '#f3e2c6', '#f0a03c'],
  ['#0f2f35', '#e1f2ee', '#7fe0c8'],
  ['#d9c9a8', '#3a2a17', '#8d2f1f'],
  ['#101820', '#f2f2f2', '#9ec5ff'],
]

function Generated({ artist, title, seed }: { artist: string; title: string; seed: number }) {
  const [bg, fg, ac] = PALETTES[seed % PALETTES.length]
  const style = Math.floor(seed / 7) % 6
  const r = (n: number) => ((seed * (n + 3) * 2654435761) >>> 0) % 1000 / 1000
  const id = `g${seed}`
  return (
    <svg viewBox="0 0 300 300" className="cover-gen" role="img" aria-label={`${artist} — ${title}`}>
      <defs>
        <radialGradient id={`${id}o`} cx={0.3 + r(1) * 0.4} cy={0.3 + r(2) * 0.4} r="0.7">
          <stop offset="0" stopColor={ac} />
          <stop offset="1" stopColor={bg} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="300" height="300" fill={bg} />
      {style === 0 && <circle cx={90 + r(3) * 120} cy={110 + r(4) * 60} r={70 + r(5) * 30} fill={ac} />}
      {style === 1 &&
        Array.from({ length: 9 }).map((_, i) => (
          <rect key={i} x={-40 + i * 44} y={-60} width={18} height={420} fill={i % 3 === 0 ? ac : fg} opacity={i % 3 === 0 ? 1 : 0.85} transform="rotate(28 150 150)" />
        ))}
      {style === 2 && <rect width="300" height="300" fill={`url(#${id}o)`} />}
      {style === 3 &&
        Array.from({ length: 8 }).map((_, i) => (
          <circle key={i} cx="150" cy="140" r={18 + i * 16} fill="none" stroke={i === 3 ? ac : fg} strokeWidth={i === 3 ? 6 : 1.4} opacity={i === 3 ? 1 : 0.7} />
        ))}
      {style === 4 && (
        <text x="-8" y="250" fontFamily="Instrument Serif, serif" fontStyle="italic" fontSize="190" fill={ac}>
          {title.slice(0, 2)}
        </text>
      )}
      {style === 5 &&
        Array.from({ length: 64 }).map((_, i) => (
          <circle key={i} cx={30 + (i % 8) * 34} cy={30 + Math.floor(i / 8) * 30} r={2 + ((i * seed) % 7)} fill={(i + seed) % 5 === 0 ? ac : fg} />
        ))}
      <text x="18" y="276" fontFamily="Inter Tight Variable, sans-serif" fontWeight="650" fontSize="17" letterSpacing="-0.2" fill={style === 1 || style === 5 ? bg : fg}>
        {title.length > 24 ? title.slice(0, 23) + '…' : title}
      </text>
      <text x="18" y="30" fontFamily="Geist Mono Variable, monospace" fontSize="10" letterSpacing="1.6" fill={style === 1 || style === 5 ? bg : fg} opacity="0.85">
        {artist.toUpperCase().slice(0, 30)}
      </text>
    </svg>
  )
}

function usePhoto(key?: string) {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    if (!key) return
    let u: string | undefined
    let alive = true
    getPhoto(key).then((b) => {
      if (b && alive) {
        u = URL.createObjectURL(b)
        setUrl(u)
      }
    })
    return () => {
      alive = false
      if (u) URL.revokeObjectURL(u)
    }
  }, [key])
  return url
}

/** Pochette : photo locale > URL distante > recherche iTunes (optionnelle) > pochette générée. */
export const CoverArt = memo(function CoverArt({
  src,
  lookup = false,
  className = '',
  eager = false,
}: {
  src: CoverSource
  lookup?: boolean
  className?: string
  eager?: boolean
}) {
  const photo = usePhoto(src.photoKey)
  const [failed, setFailed] = useState(false)
  const [found, setFound] = useState<string>()
  const [loaded, setLoaded] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!lookup || src.coverUrl || src.photoKey || found) return
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect()
          findArtwork(src.artist, src.title).then((u) => u && setFound(u))
        }
      },
      { rootMargin: '200px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [lookup, src.coverUrl, src.photoKey, src.artist, src.title, found])

  const url = photo ?? (!failed ? src.coverUrl ?? found : undefined)
  const seed = src.coverSeed ?? hash(src.artist + src.title)

  return (
    <div ref={ref} className={`cover ${className}`}>
      <Generated artist={src.artist} title={src.title} seed={seed} />
      {url && (
        <img
          src={url}
          alt={`${src.artist} — ${src.title}`}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          className={loaded ? 'is-loaded' : ''}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          referrerPolicy="no-referrer"
        />
      )}
      <span className="cover-sheen" aria-hidden="true" />
    </div>
  )
})

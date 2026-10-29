import { motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { CoverArt } from '../../components/CoverArt'
import { Icon } from '../../components/Icon'
import { Badge, Skeleton, spring } from '../../components/ui'
import { describeFormat, releaseCover, splitTitle, versionThumbs, type DgSearchResult } from '../../services/discogs'

/**
 * Liste d'éditions vinyle avec la vraie pochette de chacune.
 * Les vignettes arrivent d'abord par album (versions Discogs), puis édition par édition
 * pour celles qui restent, au fur et à mesure qu'elles apparaissent à l'écran.
 */
export function EditionsList({
  results,
  loading,
  loadingId,
  owned,
  onPick,
}: {
  results: DgSearchResult[]
  loading: boolean
  loadingId: number | null
  owned: (id: number) => boolean
  onPick: (r: DgSearchResult) => void
}) {
  const [thumbs, setThumbs] = useState<Map<number, string>>(new Map())
  const [versionsDone, setVersionsDone] = useState(false)
  const key = results.map((r) => r.id).join(',')

  useEffect(() => {
    let alive = true
    setVersionsDone(false)
    const masters = results.map((r) => r.master_id).filter((m): m is number => !!m)
    versionThumbs(masters)
      .then((m) => alive && setThumbs((prev) => new Map([...prev, ...m])))
      .finally(() => alive && setVersionsDone(true))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  if (loading && !results.length)
    return (
      <div className="skeleton-list">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="result-skel">
            <Skeleton w={64} h={64} r={8} />
            <div style={{ flex: 1 }}>
              <Skeleton h={14} w="70%" />
              <Skeleton h={11} w="45%" className="mt-6" />
            </div>
          </div>
        ))}
      </div>
    )

  return (
    <ul className="results">
      {results.map((r, i) => (
        <EditionRow
          key={`${r.id}-${i}`}
          r={r}
          index={i}
          known={thumbs.get(r.id) || r.cover_image || r.thumb || undefined}
          canFetch={versionsDone}
          busy={loadingId === r.id}
          owned={owned(r.id)}
          onPick={() => onPick(r)}
        />
      ))}
    </ul>
  )
}

function EditionRow({ r, index, known, canFetch, busy, owned, onPick }: { r: DgSearchResult; index: number; known?: string; canFetch: boolean; busy: boolean; owned: boolean; onPick: () => void }) {
  const { artist, title } = splitTitle(r.title)
  const f = describeFormat(r.formats)
  const ref = useRef<HTMLLIElement>(null)
  const [own, setOwn] = useState<string>()
  const [state, setState] = useState<'idle' | 'loading' | 'failed'>('idle')
  const cover = known ?? own

  useEffect(() => {
    if (cover || !canFetch || state !== 'idle') return
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return
        io.disconnect()
        setState('loading')
        releaseCover(r.id)
          .then((u) => (u ? setOwn(u) : setState('failed')))
          .catch(() => setState('failed'))
      },
      { rootMargin: '300px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [cover, canFetch, state, r.id])

  const pending = !cover && state !== 'failed'

  return (
    <motion.li ref={ref} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: Math.min(index, 10) * 0.025 }}>
      <button type="button" className="result" onClick={onPick} disabled={busy}>
        <span className="result-cover">
          {pending ? <span className="cover-pending" aria-label="Chargement de la pochette" /> : <CoverArt src={{ artist, title, coverUrl: cover }} lookup={!cover} />}
        </span>
        <span className="result-text">
          <span className="record-title">{title}</span>
          <span className="record-artist">{artist}</span>
          <span className="record-meta mono">{[r.year, r.country, r.catno].filter(Boolean).join(' · ')}</span>
          <span className="result-tags">
            {f.color && <Badge tone="info">{f.color}</Badge>}
            {f.reissue && <Badge>Réédition</Badge>}
            {f.limited && <Badge tone="accent">Limitée</Badge>}
            {owned && <Badge tone="up">Possédé</Badge>}
          </span>
        </span>
        {busy ? <span className="spinner" /> : <Icon name="chevron" size={18} className="muted" />}
      </button>
    </motion.li>
  )
}

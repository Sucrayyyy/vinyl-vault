import { AnimatePresence, motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { CoverArt } from '../../components/CoverArt'
import { Icon } from '../../components/Icon'
import { Wordmark } from '../../components/Logo'
import { Button, Chip, Empty, IconButton, Segmented, Sheet, spring } from '../../components/ui'
import { useDebounced, useEstimates, useMoney } from '../../lib/hooks'
import { useApp } from '../../lib/store'
import { CONDITIONS, type Condition, type SortKey, type VinylRecord } from '../../lib/types'
import { normalize } from '../../lib/util'
import { ValueCard } from './ValueCard'

type View = 'grid' | 'list'

interface Filters {
  genres: string[]
  decades: number[]
  pressing: 'all' | 'original' | 'reissue'
  minCondition?: Condition
  favorites: boolean
  colored: boolean
}
const NO_FILTERS: Filters = { genres: [], decades: [], pressing: 'all', favorites: false, colored: false }

const SORTS: { value: SortKey; label: string }[] = [
  { value: 'added', label: 'Ajout récent' },
  { value: 'artist', label: 'Artiste' },
  { value: 'title', label: 'Titre' },
  { value: 'year', label: 'Année' },
  { value: 'value', label: 'Valeur' },
]

export function CollectionScreen() {
  const records = useApp((s) => s.records)
  const openRecord = useApp((s) => s.openRecord)
  const setAddOpen = useApp((s) => s.setAddOpen)
  const clearDemo = useApp((s) => s.clearDemo)
  const toast = useApp((s) => s.toast)
  const est = useEstimates()
  const fmt = useMoney()

  const [query, setQuery] = useState('')
  const q = useDebounced(query, 120)
  const [sort, setSort] = useState<SortKey>('added')
  const [view, setView] = useState<View>(() => (localStorage.getItem('vv-view') as View) || 'grid')
  const [filters, setFilters] = useState<Filters>(NO_FILTERS)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const hasDemo = records.some((r) => r.demo)
  const genres = useMemo(() => {
    const c = new Map<string, number>()
    records.forEach((r) => [...r.genres, ...r.styles].forEach((g) => c.set(g, (c.get(g) ?? 0) + 1)))
    return [...c.entries()].sort((a, b) => b[1] - a[1]).map(([g]) => g)
  }, [records])
  const decades = useMemo(() => [...new Set(records.map((r) => (r.year ? Math.floor(r.year / 10) * 10 : 0)).filter(Boolean))].sort(), [records])

  const list = useMemo(() => {
    const nq = normalize(q)
    const terms = nq.split(' ').filter(Boolean)
    const condIdx = (c?: Condition) => (c ? CONDITIONS.indexOf(c) : 99)
    let out = records.filter((r) => {
      if (terms.length) {
        const hay = normalize([r.artist, r.title, r.label, r.catno, r.year, r.country, r.color, r.barcode, ...r.genres, ...r.styles, r.notes, r.shelf].filter(Boolean).join(' '))
        if (!terms.every((t) => hay.includes(t))) return false
      }
      if (filters.favorites && !r.favorite) return false
      if (filters.colored && !r.color) return false
      if (filters.pressing !== 'all' && r.pressing !== filters.pressing) return false
      if (filters.genres.length && !filters.genres.some((g) => r.genres.includes(g) || r.styles.includes(g))) return false
      if (filters.decades.length && !(r.year && filters.decades.includes(Math.floor(r.year / 10) * 10))) return false
      if (filters.minCondition && condIdx(r.mediaCondition) > condIdx(filters.minCondition)) return false
      return true
    })
    const coll = new Intl.Collator('fr', { sensitivity: 'base' })
    out = [...out].sort((a, b) => {
      switch (sort) {
        case 'artist':
          return coll.compare(a.artist.replace(/^the /i, ''), b.artist.replace(/^the /i, '')) || (a.year ?? 0) - (b.year ?? 0)
        case 'title':
          return coll.compare(a.title, b.title)
        case 'year':
          return (b.year ?? 0) - (a.year ?? 0)
        case 'value':
          return (est.get(b.id)?.value ?? -1) - (est.get(a.id)?.value ?? -1)
        default:
          return b.createdAt - a.createdAt
      }
    })
    return out
  }, [records, q, filters, sort, est])

  const activeFilterCount =
    filters.genres.length + filters.decades.length + (filters.pressing !== 'all' ? 1 : 0) + (filters.minCondition ? 1 : 0) + (filters.favorites ? 1 : 0) + (filters.colored ? 1 : 0)

  const toggleGenre = (g: string) =>
    setFilters((f) => ({ ...f, genres: f.genres.includes(g) ? f.genres.filter((x) => x !== g) : [...f.genres, g] }))

  const changeView = (v: View) => {
    setView(v)
    try {
      localStorage.setItem('vv-view', v)
    } catch {
      /* ignoré */
    }
  }

  return (
    <div className="screen">
      <header className="topbar">
        <Wordmark />
        <div className="topbar-actions">
          <IconButton icon="scan" label="Scanner un vinyle" onClick={() => setAddOpen(true)} />
        </div>
      </header>

      <Greeting />
      <div className="hero-title">
        <h1 className="display">Collection</h1>
        <span className="hero-count mono">
          {records.length} disque{records.length > 1 ? 's' : ''}
        </span>
      </div>

      {hasDemo && (
        <motion.div className="demo-banner" layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Icon name="info" size={18} />
          <p>
            <strong>Collection de démonstration.</strong> Artistes, labels et prix sont fictifs, pour présenter l’application.
          </p>
          <button
            type="button"
            onClick={() => {
              clearDemo()
              toast('Données de démonstration effacées')
            }}
          >
            Effacer
          </button>
        </motion.div>
      )}

      {records.length > 0 && <ValueCard />}

      {records.length > 0 && (
        <div className="toolbar">
          <div className="search glass-soft">
            <Icon name="search" size={18} />
            <input
              type="search"
              inputMode="search"
              placeholder="Artiste, titre, label, référence…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Rechercher dans la collection"
            />
            {query && (
              <button type="button" className="search-clear" onClick={() => setQuery('')} aria-label="Effacer la recherche">
                <Icon name="close" size={14} />
              </button>
            )}
          </div>
          <IconButton icon="filter" label="Filtres et tri" onClick={() => setFiltersOpen(true)} active={activeFilterCount > 0} badge={activeFilterCount} />
          <IconButton icon={view === 'grid' ? 'list' : 'grid'} label={view === 'grid' ? 'Affichage liste' : 'Affichage grille'} onClick={() => changeView(view === 'grid' ? 'list' : 'grid')} />
        </div>
      )}

      {genres.length > 0 && (
        <div className="chip-row" role="toolbar" aria-label="Filtres rapides">
          <Chip active={activeFilterCount === 0} onClick={() => setFilters(NO_FILTERS)}>
            Tout
          </Chip>
          <Chip active={filters.favorites} icon="heart" onClick={() => setFilters((f) => ({ ...f, favorites: !f.favorites }))}>
            Favoris
          </Chip>
          {genres.slice(0, 10).map((g) => (
            <Chip key={g} active={filters.genres.includes(g)} onClick={() => toggleGenre(g)}>
              {g}
            </Chip>
          ))}
        </div>
      )}

      {records.length === 0 ? (
        <Empty icon="disc" title="Votre coffre est vide" action={<Button variant="accent" icon="camera" onClick={() => setAddOpen(true)}>Ajouter un premier vinyle</Button>}>
          Photographiez une pochette, scannez un code-barres ou cherchez un disque pour commencer.
        </Empty>
      ) : list.length === 0 ? (
        <Empty icon="search" title="Aucun résultat" action={<Button variant="ghost" onClick={() => { setQuery(''); setFilters(NO_FILTERS) }}>Réinitialiser</Button>}>
          Aucun disque ne correspond à cette recherche ou à ces filtres.
        </Empty>
      ) : (
        <>
          <motion.div className={view === 'grid' ? 'record-grid' : 'record-list'} layout={list.length <= 150}>
            <AnimatePresence initial={false}>
              {list.map((r, i) => (
                <RecordTile key={r.id} r={r} view={view} index={i} light={list.length > 150} value={fmt(est.get(r.id)?.value)} onOpen={() => openRecord(r.id)} />
              ))}
            </AnimatePresence>
          </motion.div>
        </>
      )}

      {createPortal(
        <motion.button
          type="button"
          className="fab"
          onClick={() => setAddOpen(true)}
          whileTap={{ scale: 0.92 }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ ...spring, delay: 0.2 }}
          aria-label="Ajouter un vinyle"
        >
          <Icon name="plus" size={20} weight={2} />
          <span>Ajouter un vinyle</span>
        </motion.button>,
        document.body,
      )}

      <Sheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filtres et tri">
        <div className="form-stack">
          <div className="form-group">
            <div className="form-label">Trier par</div>
            <div className="chip-wrap">
              {SORTS.map((s) => (
                <Chip key={s.value} active={sort === s.value} onClick={() => setSort(s.value)}>
                  {s.label}
                </Chip>
              ))}
            </div>
          </div>
          <div className="form-group">
            <div className="form-label">Pressage</div>
            <Segmented
              value={filters.pressing}
              onChange={(v) => setFilters((f) => ({ ...f, pressing: v }))}
              options={[
                { value: 'all', label: 'Tous' },
                { value: 'original', label: 'Originaux' },
                { value: 'reissue', label: 'Rééditions' },
              ]}
            />
          </div>
          <div className="form-group">
            <div className="form-label">État minimum du disque</div>
            <div className="chip-wrap">
              <Chip active={!filters.minCondition} onClick={() => setFilters((f) => ({ ...f, minCondition: undefined }))}>
                Indifférent
              </Chip>
              {CONDITIONS.slice(0, 5).map((c) => (
                <Chip key={c} active={filters.minCondition === c} onClick={() => setFilters((f) => ({ ...f, minCondition: c }))}>
                  {c}
                </Chip>
              ))}
            </div>
          </div>
          {decades.length > 0 && (
            <div className="form-group">
              <div className="form-label">Décennie</div>
              <div className="chip-wrap">
                {decades.map((d) => (
                  <Chip key={d} active={filters.decades.includes(d)} onClick={() => setFilters((f) => ({ ...f, decades: f.decades.includes(d) ? f.decades.filter((x) => x !== d) : [...f.decades, d] }))}>
                    {`${String(d).slice(2)}s`}
                  </Chip>
                ))}
              </div>
            </div>
          )}
          <div className="form-group">
            <div className="form-label">Genres et styles</div>
            <div className="chip-wrap">
              {genres.map((g) => (
                <Chip key={g} active={filters.genres.includes(g)} onClick={() => toggleGenre(g)}>
                  {g}
                </Chip>
              ))}
            </div>
          </div>
          <div className="form-group">
            <div className="chip-wrap">
              <Chip icon="heart" active={filters.favorites} onClick={() => setFilters((f) => ({ ...f, favorites: !f.favorites }))}>
                Favoris uniquement
              </Chip>
              <Chip active={filters.colored} onClick={() => setFilters((f) => ({ ...f, colored: !f.colored }))}>
                Vinyles couleur
              </Chip>
            </div>
          </div>
          <div className="form-actions">
            <Button variant="ghost" onClick={() => setFilters(NO_FILTERS)}>
              Réinitialiser
            </Button>
            <Button variant="accent" onClick={() => setFiltersOpen(false)}>
              Voir {list.length} disque{list.length > 1 ? 's' : ''}
            </Button>
          </div>
        </div>
      </Sheet>
    </div>
  )
}

function Greeting() {
  const name = useApp((s) => s.profile.displayName.split(' ')[0])
  if (!name) return null
  const h = new Date().getHours()
  const hello = h < 5 || h >= 18 ? 'Bonsoir' : 'Bonjour'
  return (
    <motion.p className="greeting" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      {hello}, <em>{name}</em>
    </motion.p>
  )
}

function RecordTile({ r, view, index, value, onOpen, light }: { r: VinylRecord; view: View; index: number; value: string; onOpen: () => void; light: boolean }) {
  // Grandes collections : on désactive les animations de mise en page pour rester fluide.
  const delay = light ? 0 : Math.min(index, 12) * 0.03
  if (view === 'list') {
    return (
      <motion.button
        type="button"
        className="record-row"
        onClick={onOpen}
        layout={!light}
        initial={light ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0, transition: { ...spring, delay } }}
        exit={{ opacity: 0, scale: 0.96 }}
        whileTap={{ scale: 0.98 }}
      >
        <motion.div layoutId={`cover-${r.id}`} className="record-row-cover">
          <CoverArt src={r} />
        </motion.div>
        <div className="record-row-text">
          <span className="record-title">{r.title}</span>
          <span className="record-artist">{r.artist}</span>
          <span className="record-meta mono">
            {[r.year, r.label, r.catno].filter(Boolean).join(' · ')}
          </span>
        </div>
        <span className="record-row-value mono">{value}</span>
      </motion.button>
    )
  }
  return (
    <motion.button
      type="button"
      className="record-tile"
      onClick={onOpen}
      layout={!light}
      initial={light ? false : { opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1, transition: { ...spring, delay } }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileTap={{ scale: 0.97 }}
    >
      <motion.div layoutId={`cover-${r.id}`} className="record-tile-cover">
        <CoverArt src={r} />
        {r.favorite && (
          <span className="tile-fav" aria-label="Favori">
            <Icon name="heart" size={13} weight={2} />
          </span>
        )}
        {r.demo && <span className="tile-demo mono">DÉMO</span>}
      </motion.div>
      <span className="record-title">{r.title}</span>
      <span className="record-artist">{r.artist}</span>
      <span className="record-meta mono">
        {r.year ?? '—'}
        <span className="dot-sep" />
        {value}
      </span>
    </motion.button>
  )
}

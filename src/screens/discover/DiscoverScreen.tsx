import { motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { CoverArt } from '../../components/CoverArt'
import { Previews } from '../../components/Previews'
import { Icon } from '../../components/Icon'
import { Badge, Button, Chip, DemoBadge, Empty, ExternalLink, SectionHeader, Sheet, Skeleton, spring } from '../../components/ui'
import { useAsync, useMoney, useOnline } from '../../lib/hooks'
import { useApp } from '../../lib/store'
import type { VinylRecord } from '../../lib/types'
import { normalize } from '../../lib/util'
import {
  cleanName,
  getArtistReleases,
  getMarketStats,
  getMaster,
  getMasterVersions,
  masterUrl,
  releaseUrl,
  searchMasters,
  sellUrl,
  splitTitle,
} from '../../services/discogs'
import { describeError } from '../../services/http'

export interface Reco {
  key: string
  artist: string
  title: string
  edition?: string
  year?: number
  coverUrl?: string
  coverSeed?: number
  /** Release Discogs utilisée pour le prix. */
  releaseId?: number
  masterId?: number
  reason: string
  url?: string
  tags?: string[]
  demo?: boolean
  demoPrice?: number
}

/** Release à utiliser pour le prix : l'édition précise, sinon l'édition principale de l'album. */
async function priceFor(r: Reco) {
  let id = r.releaseId
  let main = false
  if (!id && r.masterId) {
    id = (await getMaster(r.masterId)).main_release
    main = true
  }
  if (!id) return null
  return { id, main, stats: await getMarketStats(id) }
}

type Section = 'pour-vous' | 'manquants' | 'editions' | 'rares' | 'marche'

const SECTIONS: { id: Section; label: string }[] = [
  { id: 'pour-vous', label: 'Pour vous' },
  { id: 'manquants', label: 'Albums manquants' },
  { id: 'editions', label: 'Autres éditions' },
  { id: 'rares', label: 'Pressages rares' },
  { id: 'marche', label: 'Marché' },
]

function topTastes(records: VinylRecord[], profileGenres: string[]) {
  const c = new Map<string, number>()
  profileGenres.forEach((g) => c.set(g, 100))
  records.forEach((r) => r.styles.forEach((s) => c.set(s, (c.get(s) ?? 0) + 1)))
  return [...c.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k)
}

export function DiscoverScreen() {
  const records = useApp((s) => s.records)
  const profile = useApp((s) => s.profile)
  const online = useOnline()
  const [section, setSection] = useState<Section>('pour-vous')
  const [selected, setSelected] = useState<Reco | null>(null)

  const real = useMemo(() => records.filter((r) => !r.demo), [records])
  const tastes = useMemo(() => topTastes(real, profile.genres), [real, profile.genres])
  const onlyDemo = real.length === 0

  return (
    <div className="screen">
      <div className="hero-title">
        <h1 className="display">Découvrir</h1>
        <span className="hero-count mono">{tastes.length ? `Selon ${tastes.slice(0, 2).join(', ')}` : 'Personnalisé'}</span>
      </div>

      {!online && (
        <div className="note note-warn">
          <Icon name="alert" size={16} /> Hors connexion : les recommandations nécessitent le réseau.
        </div>
      )}

      <div className="chip-row sticky-chips" role="tablist">
        {SECTIONS.map((s) => (
          <Chip key={s.id} active={section === s.id} onClick={() => setSection(s.id)}>
            {s.label}
          </Chip>
        ))}
      </div>

      <motion.div key={section} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={spring}>
        {section === 'pour-vous' && <ForYou tastes={tastes} owned={real} onOpen={setSelected} onlyDemo={onlyDemo} />}
        {section === 'manquants' && <Missing owned={real} onOpen={setSelected} />}
        {section === 'editions' && <Alternatives owned={real} onOpen={setSelected} rareOnly={false} />}
        {section === 'rares' && <Alternatives owned={real} onOpen={setSelected} rareOnly />}
        {section === 'marche' && <Market onOpen={setSelected} />}
      </motion.div>

      <RecoSheet reco={selected} onClose={() => setSelected(null)} />
    </div>
  )
}

/* ── Pour vous : masters Discogs dans vos styles, non possédés ── */
function ForYou({ tastes, owned, onOpen, onlyDemo }: { tastes: string[]; owned: VinylRecord[]; onOpen: (r: Reco) => void; onlyDemo: boolean }) {
  const setProfile = useApp((s) => s.setProfile)
  const profile = useApp((s) => s.profile)
  const [style, setStyle] = useState<string | null>(null)
  const active = style ?? tastes[0]
  const ownedKeys = useMemo(() => new Set(owned.map((r) => normalize(r.artist + r.title))), [owned])
  const { loading, error, data, reload } = useAsync(async () => {
    if (!active) return []
    const res = await searchMasters({ style: active })
    return res.results
      .map((m) => {
        const { artist, title } = splitTitle(m.title)
        return {
          key: `m${m.id}`,
          artist,
          title,
          year: m.year ? Number(m.year) : undefined,
          coverUrl: m.cover_image || undefined,
          masterId: m.id,
          url: masterUrl(m.id),
          reason: `Parce que vous aimez le style ${active}`,
          tags: m.style?.slice(0, 2),
        } satisfies Reco
      })
      .filter((r) => !ownedKeys.has(normalize(r.artist + r.title)))
  }, [active])

  if (!tastes.length)
    return (
      <Empty icon="spark" title="Dites-nous ce que vous aimez">
        {onlyDemo ? 'Ajoutez vos propres disques ou choisissez quelques genres : les recommandations s’appuient sur des données réelles (Discogs), pas sur la démo.' : 'Choisissez quelques styles pour personnaliser vos recommandations.'}
        <div className="chip-wrap center mt-12">
          {['Jazz', 'Soul', 'House', 'Shoegaze', 'Hip Hop', 'Ambient', 'Krautrock', 'Chanson', 'Disco', 'Post-Punk'].map((g) => (
            <Chip key={g} active={profile.genres.includes(g)} onClick={() => setProfile({ genres: profile.genres.includes(g) ? profile.genres.filter((x) => x !== g) : [...profile.genres, g] })}>
              {g}
            </Chip>
          ))}
        </div>
      </Empty>
    )

  return (
    <>
      <div className="chip-row">
        {tastes.slice(0, 8).map((t) => (
          <Chip key={t} active={active === t} onClick={() => setStyle(t)}>
            {t}
          </Chip>
        ))}
      </div>
      <RecoGrid loading={loading} error={error} reload={reload} items={data ?? []} onOpen={onOpen} empty="Aucune recommandation pour ce style." />
    </>
  )
}

/* ── Albums manquants d'artistes possédés ── */
function Missing({ owned, onOpen }: { owned: VinylRecord[]; onOpen: (r: Reco) => void }) {
  const artists = useMemo(() => {
    const m = new Map<number, { name: string; count: number; masters: Set<number>; titles: Set<string> }>()
    owned.forEach((r) => {
      if (!r.discogsArtistId) return
      const e = m.get(r.discogsArtistId) ?? { name: r.artist, count: 0, masters: new Set(), titles: new Set() }
      e.count++
      if (r.masterId) e.masters.add(r.masterId)
      e.titles.add(normalize(r.title))
      m.set(r.discogsArtistId, e)
    })
    return [...m.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 4)
  }, [owned])

  const { loading, error, data, reload } = useAsync(async () => {
    const out: Reco[] = []
    for (const [id, a] of artists) {
      const res = await getArtistReleases(id)
      res.releases
        .filter((x) => x.type === 'master' && x.role === 'Main' && !a.masters.has(x.id) && !a.titles.has(normalize(x.title)))
        .sort((x, y) => (y.stats?.community?.in_collection ?? 0) - (x.stats?.community?.in_collection ?? 0))
        .slice(0, 8)
        .forEach((x) =>
          out.push({
            key: `a${id}m${x.id}`,
            artist: cleanName(x.artist || a.name),
            title: x.title,
            year: x.year,
            coverUrl: x.thumb || undefined,
            masterId: x.id,
            releaseId: x.main_release,
            url: masterUrl(x.id),
            reason: `Vous avez ${a.count} disque${a.count > 1 ? 's' : ''} de ${a.name}`,
          }),
        )
    }
    return out
  }, [artists.map((a) => a[0]).join(',')])

  if (!artists.length)
    return (
      <Empty icon="disc" title="Pas encore d’artistes suivis">
        Ajoutez des disques identifiés via Discogs (scan ou recherche) : Vinyl Vault listera les albums de ces artistes qui manquent à votre collection.
      </Empty>
    )
  return <RecoGrid loading={loading} error={error} reload={reload} items={data ?? []} onOpen={onOpen} empty="Vous possédez déjà toute leur discographie référencée." />
}

/* ── Éditions alternatives et pressages rares d'albums possédés ── */
function Alternatives({ owned, onOpen, rareOnly }: { owned: VinylRecord[]; onOpen: (r: Reco) => void; rareOnly: boolean }) {
  const masters = useMemo(() => owned.filter((r) => r.masterId).slice(0, 6), [owned])
  const { loading, error, data, reload } = useAsync(async () => {
    const out: (Reco & { score: number })[] = []
    for (const r of masters) {
      const res = await getMasterVersions(r.masterId!)
      for (const v of res.versions) {
        if (v.id === r.discogsId) continue
        const limited = /limited|numbered|test pressing|promo|coloured|colored|clear|splatter|marbled/i.test(v.format)
        if (rareOnly && !limited) continue
        const have = v.stats?.community?.in_collection ?? 0
        const want = v.stats?.community?.in_wantlist ?? 0
        out.push({
          key: `v${v.id}`,
          artist: r.artist,
          title: r.title,
          edition: [v.released, v.country, v.format].filter(Boolean).join(' · '),
          coverUrl: v.thumb || undefined,
          releaseId: v.id,
          masterId: r.masterId,
          url: releaseUrl(v.id),
          reason: rareOnly ? `Édition limitée de « ${r.title} » · ${want} recherchent / ${have} possèdent` : `Autre pressage de « ${r.title} », que vous possédez`,
          tags: limited ? ['Limitée'] : undefined,
          score: rareOnly ? want / Math.max(1, have) : have,
        })
      }
    }
    return out.sort((a, b) => b.score - a.score).slice(0, 24)
  }, [masters.map((m) => m.masterId).join(','), rareOnly])

  if (!masters.length)
    return (
      <Empty icon="layers" title="Aucune édition à comparer">
        Les éditions alternatives apparaissent pour les disques associés à Discogs. Scannez un vinyle pour commencer.
      </Empty>
    )
  return (
    <>
      {rareOnly && <p className="fine">Classement par rareté relative : nombre de collectionneurs qui recherchent l’édition rapporté à ceux qui la possèdent (données Discogs).</p>}
      <RecoGrid loading={loading} error={error} reload={reload} items={data ?? []} onOpen={onOpen} empty={rareOnly ? 'Aucune édition limitée référencée pour vos albums.' : 'Aucune autre édition trouvée.'} />
    </>
  )
}

/* ── Marché : bonnes affaires sur la wishlist (réel) + tendances (vos données) ── */
function Market({ onOpen }: { onOpen: (r: Reco) => void }) {
  const wishlist = useApp((s) => s.wishlist)
  const records = useApp((s) => s.records)
  const prices = useApp((s) => s.prices)
  const fmt = useMoney()

  const deals = wishlist.filter((w) => w.lastSeen && w.targetPrice != null && w.lastSeen.value <= w.targetPrice)
  const movers = useMemo(() => {
    const out: { r: VinylRecord; from: number; to: number; demo: boolean }[] = []
    for (const r of records) {
      const obs = prices.filter((p) => p.recordId === r.id).sort((a, b) => a.at - b.at)
      if (obs.length < 2) continue
      out.push({ r, from: obs[0].value, to: obs[obs.length - 1].value, demo: !!r.demo })
    }
    return out.sort((a, b) => Math.abs(b.to / b.from - 1) - Math.abs(a.to / a.from - 1)).slice(0, 6)
  }, [records, prices])

  return (
    <div className="form-stack">
      <SectionHeader kicker="Wishlist" title="Bonnes affaires" />
      {deals.length ? (
        <div className="reco-grid">
          {deals.map((w, i) => (
            <RecoCard
              key={w.id}
              index={i}
              onOpen={onOpen}
              r={{ key: w.id, artist: w.artist, title: w.title, edition: w.edition, coverUrl: w.coverUrl, coverSeed: w.coverSeed, releaseId: w.discogsId, reason: `Sous votre prix cible de ${fmt(w.targetPrice)}`, demo: w.demo, demoPrice: w.lastSeen?.value, url: w.discogsId ? sellUrl(w.discogsId) : undefined }}
            />
          ))}
        </div>
      ) : (
        <p className="fine">Aucune annonce sous vos prix cibles pour le moment. Les prix des éléments de votre wishlist liés à Discogs sont vérifiés à chaque ouverture (toutes les 6 h).</p>
      )}

      <SectionHeader kicker="Votre collection" title="Tendances observées" />
      {movers.length ? (
        <ul className="mover-list">
          {movers.map(({ r, from, to, demo }) => {
            const d = (to / from - 1) * 100
            return (
              <li key={r.id}>
                <CoverArt src={r} className="mini-cover" />
                <span className="mini-text">
                  <span className="record-title">{r.title}</span>
                  <span className="record-artist">
                    {r.artist} {demo && <DemoBadge />}
                  </span>
                </span>
                <span className="mover-val">
                  <span className="mono">{fmt(to)}</span>
                  <span className={`mono small ${d >= 0 ? 'up' : 'down'}`}>
                    {d >= 0 ? '▲' : '▼'} {Math.abs(d).toFixed(0)} %
                  </span>
                </span>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="fine">Les tendances apparaîtront dès que vos disques auront au moins deux observations de prix.</p>
      )}

      <div className="note">
        <Icon name="plug" size={16} />
        Les tendances globales du marché (ventes eBay, flux d’annonces) nécessitent un connecteur serveur. Voir Profil › Connecteurs.
      </div>
    </div>
  )
}

/* ── Grille et cartes ── */
function RecoGrid({ loading, error, reload, items, onOpen, empty }: { loading: boolean; error?: unknown; reload: () => void; items: Reco[]; onOpen: (r: Reco) => void; empty: string }) {
  if (loading)
    return (
      <div className="reco-grid">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="reco-card">
            <Skeleton h={0} className="skel-square" />
            <Skeleton h={13} w="80%" className="mt-8" />
            <Skeleton h={11} w="55%" className="mt-6" />
          </div>
        ))}
      </div>
    )
  if (error)
    return (
      <div className="note note-error">
        <Icon name="alert" size={16} /> {describeError(error)}
        <button type="button" className="link" onClick={reload}>
          Réessayer
        </button>
      </div>
    )
  if (!items.length) return <p className="fine">{empty}</p>
  return (
    <div className="reco-grid">
      {items.map((r, i) => (
        <RecoCard key={r.key} r={r} index={i} onOpen={onOpen} />
      ))}
    </div>
  )
}

function RecoCard({ r, index, onOpen }: { r: Reco; index: number; onOpen: (r: Reco) => void }) {
  return (
    <motion.div
      role="button"
      tabIndex={0}
      className="reco-card"
      onClick={() => onOpen(r)}
      onKeyDown={(e) => e.key === 'Enter' && onOpen(r)}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...spring, delay: Math.min(index, 10) * 0.035 }}
      whileTap={{ scale: 0.97 }}
    >
      <div className="reco-cover">
        <CoverArt src={r} lookup />
        {r.tags?.[0] && <span className="reco-tag mono">{r.tags[0]}</span>}
      </div>
      <span className="record-title">{r.title}</span>
      <span className="record-artist">{r.artist}</span>
      {r.edition && <span className="record-meta mono clamp-1">{r.edition}</span>}
      <PriceLine r={r} />
      <span className="reco-reason">{r.reason}</span>
    </motion.div>
  )
}

function PriceLine({ r }: { r: Reco }) {
  const fmt = useMoney()
  const lookups = useApp((s) => s.profile.privacy.priceLookups)
  const [want, setWant] = useState(false)
  const { loading, data: res, error } = useAsync(async () => (want && lookups ? priceFor(r) : null), [want, r.releaseId, r.masterId, lookups])
  const data = res?.stats
  if (r.demo) return <span className="price-line mono">{r.demoPrice != null ? `dès ${fmt(r.demoPrice)} · fictif` : 'fictif'}</span>
  if (!r.releaseId && !r.masterId) return <span className="price-line mono muted">Prix indisponible</span>
  if (!lookups) return <span className="price-line mono muted">Prix : recherche désactivée</span>
  if (!want)
    return (
      <button
        type="button"
        className="price-line mono link"
        onClick={(e) => {
          e.stopPropagation()
          setWant(true)
        }}
      >
        Voir le prix
      </button>
    )
  if (loading) return <Skeleton h={11} w="50%" />
  if (error || !data) return <span className="price-line mono muted">Prix indisponible</span>
  return <span className="price-line mono">{data.lowest != null ? `dès ${fmt(data.lowest, data.currency, true)} · ${data.numForSale} annonce${data.numForSale > 1 ? 's' : ''}` : 'Aucune annonce'}</span>
}

/* ── Fiche recommandation ── */
export function RecoSheet({ reco, onClose }: { reco: Reco | null; onClose: () => void }) {
  const addWish = useApp((s) => s.addWish)
  const wishlist = useApp((s) => s.wishlist)
  const toast = useApp((s) => s.toast)
  const fmt = useMoney()
  const lookups = useApp((s) => s.profile.privacy.priceLookups)
  const { loading, data: res, error } = useAsync(async () => (reco && !reco.demo && lookups ? priceFor(reco) : null), [reco?.releaseId, reco?.masterId, lookups])
  const data = res?.stats
  const priceRelease = res?.id
  const inWish = reco && wishlist.some((w) => (reco.releaseId && w.discogsId === reco.releaseId) || (normalize(w.artist) === normalize(reco.artist) && normalize(w.title) === normalize(reco.title) && w.edition === reco.edition))

  return (
    <Sheet open={!!reco} onClose={onClose} title="Recommandation">
      {reco && (
        <div className="form-stack">
          <div className="confirm-head">
            <div className="confirm-cover">
              <CoverArt src={reco} lookup eager />
            </div>
            <div>
              <h2 className="display confirm-title">{reco.title}</h2>
              <p className="detail-artist">{reco.artist}</p>
              <div className="badge-row">
                {reco.year && <Badge>{reco.year}</Badge>}
                {reco.tags?.map((t) => (
                  <Badge key={t} tone="accent">
                    {t}
                  </Badge>
                ))}
                {reco.demo && <DemoBadge />}
              </div>
            </div>
          </div>
          {reco.edition && (
            <div className="panel">
              <div className="kicker">Édition</div>
              <p>{reco.edition}</p>
            </div>
          )}
          <div className="panel">
            <div className="kicker">Pourquoi cette recommandation</div>
            <p>{reco.reason}</p>
          </div>
          <Previews artist={reco.artist} title={reco.title} demo={reco.demo} />
          <div className="panel">
            <div className="kicker">Prix disponible</div>
            {reco.demo ? (
              <p className="mono">{reco.demoPrice != null ? `${fmt(reco.demoPrice)} (fictif)` : '—'}</p>
            ) : !reco.releaseId && !reco.masterId ? (
              <p className="fine">Aucune édition Discogs associée.</p>
            ) : loading ? (
              <Skeleton h={18} w="60%" />
            ) : error ? (
              <p className="fine">{describeError(error)}</p>
            ) : data?.lowest != null ? (
              <p>
                <span className="value-big small">{fmt(data.lowest, data.currency, true)}</span>
                <span className="fine block">
                  Prix affiché le plus bas sur Discogs, tous états confondus{res?.main ? ', pour l’édition principale de l’album' : ''} · {data.numForSale} annonce{data.numForSale > 1 ? 's' : ''}
                </span>
              </p>
            ) : (
              <p className="fine">Aucune annonce en cours sur Discogs pour cette édition.</p>
            )}
            {priceRelease && !reco.demo && <ExternalLink href={sellUrl(priceRelease)}>Voir les annonces (source)</ExternalLink>}
          </div>
          <div className="form-actions">
            {reco.url && !reco.demo && (
              <a className="btn btn-glass btn-md" href={reco.url} target="_blank" rel="noopener noreferrer">
                <Icon name="external" size={18} />
                <span>Discogs</span>
              </a>
            )}
            <Button
              variant="accent"
              icon={inWish ? 'check' : 'heart'}
              disabled={!!inWish}
              onClick={() => {
                addWish({
                  artist: reco.artist,
                  title: reco.title,
                  edition: reco.edition,
                  year: reco.year,
                  coverUrl: reco.coverUrl,
                  coverSeed: reco.coverSeed,
                  discogsId: reco.releaseId ?? priceRelease,
                  masterId: reco.masterId,
                  status: data?.lowest != null ? 'available' : 'unknown',
                  lastSeen: data?.lowest != null ? { value: data.lowest, currency: data.currency, count: data.numForSale, at: Date.now() } : undefined,
                  alert: true,
                  reason: reco.reason,
                })
                toast('Ajouté à la wishlist')
              }}
            >
              {inWish ? 'Dans la wishlist' : 'Ajouter à la wishlist'}
            </Button>
          </div>
        </div>
      )}
    </Sheet>
  )
}

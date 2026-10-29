import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { CoverArt } from '../../components/CoverArt'
import { Icon } from '../../components/Icon'
import { Badge, Button, Chip, DemoBadge, Empty, ExternalLink, Field, IconButton, Segmented, Sheet, Skeleton, spring, Toggle } from '../../components/ui'
import { useAsync, useMoney, useOnline } from '../../lib/hooks'
import { addToCalendar } from '../../lib/ics'
import { useApp } from '../../lib/store'
import type { WishItem, WishStatus } from '../../lib/types'
import { dateFmt, daysUntil, relativeDays } from '../../lib/util'
import { checkAlerts } from '../../services/alerts'
import { describeError } from '../../services/http'
import { CONNECTORS } from '../../services/market'
import { datedVinylReleases, type FeedRelease } from '../../services/musicbrainz'

type Pane = 'feed' | 'wishlist' | 'alerts'
type FeedFilter = 'all' | 'new' | 'reissue' | 'limited' | 'preorder' | 'restock'

export const STATUS_LABEL: Record<WishStatus, string> = {
  upcoming: 'À paraître',
  preorder: 'Précommande',
  available: 'Disponible',
  unavailable: 'Épuisé',
  unknown: 'Statut inconnu',
}

export function ReleasesScreen() {
  const [pane, setPane] = useState<Pane>('feed')
  const unread = useApp((s) => s.alerts.filter((a) => !a.read).length)
  const wishCount = useApp((s) => s.wishlist.length)
  return (
    <div className="screen">
      <div className="hero-title">
        <h1 className="display">Sorties</h1>
        <span className="hero-count mono">Culture vinyle</span>
      </div>
      <Segmented
        value={pane}
        onChange={setPane}
        options={[
          { value: 'feed', label: 'Fil' },
          { value: 'wishlist', label: `Wishlist${wishCount ? ` · ${wishCount}` : ''}` },
          { value: 'alerts', label: `Alertes${unread ? ` · ${unread}` : ''}` },
        ]}
      />
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={pane} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={spring} className="pane">
          {pane === 'feed' && <Feed />}
          {pane === 'wishlist' && <Wishlist />}
          {pane === 'alerts' && <Alerts />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

/* ── Fil d'actualité (MusicBrainz, données datées et vérifiables) ── */
function Feed() {
  const records = useApp((s) => s.records)
  const profile = useApp((s) => s.profile)
  const online = useOnline()
  const [filter, setFilter] = useState<FeedFilter>('all')
  const [scope, setScope] = useState<'followed' | 'all'>('followed')

  const followed = useMemo(() => {
    const artists = new Set<string>(profile.favoriteArtists)
    profile.follows.filter((f) => f.kind === 'artist').forEach((f) => artists.add(f.name))
    const counts = new Map<string, number>()
    records.filter((r) => !r.demo).forEach((r) => counts.set(r.artist, (counts.get(r.artist) ?? 0) + 1))
    ;[...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).forEach(([a]) => artists.add(a))
    const labels = profile.follows.filter((f) => f.kind === 'label').map((f) => f.name)
    return { artists: [...artists], labels }
  }, [records, profile])

  const hasFollows = followed.artists.length + followed.labels.length > 0
  const effectiveScope = hasFollows ? scope : 'all'

  const { loading, error, data, reload } = useAsync(
    () =>
      datedVinylReleases(
        effectiveScope === 'followed'
          ? { artists: followed.artists, labels: followed.labels, fromDays: -45, toDays: 240 }
          : { tags: profile.genres.length ? profile.genres : undefined, fromDays: 0, toDays: 120 },
      ),
    [effectiveScope, followed.artists.join('|'), followed.labels.join('|'), profile.genres.join('|')],
  )

  const items = (data ?? []).filter((r) => {
    if (filter === 'new') return r.kind === 'new' && daysUntil(r.date) >= 0
    if (filter === 'reissue') return r.kind === 'reissue'
    if (filter === 'limited') return r.limited
    return true
  })

  return (
    <div className="form-stack">
      <div className="chip-row">
        <Chip active={filter === 'all'} onClick={() => setFilter('all')}>Tout</Chip>
        <Chip active={filter === 'new'} onClick={() => setFilter('new')}>À venir</Chip>
        <Chip active={filter === 'reissue'} onClick={() => setFilter('reissue')}>Rééditions</Chip>
        <Chip active={filter === 'limited'} onClick={() => setFilter('limited')}>Éditions limitées</Chip>
        <Chip active={filter === 'preorder'} onClick={() => setFilter('preorder')}>Précommandes</Chip>
        <Chip active={filter === 'restock'} onClick={() => setFilter('restock')}>Restocks</Chip>
      </div>

      {(filter === 'preorder' || filter === 'restock') ? (
        <DemoRetail kind={filter} />
      ) : (
        <>
          {hasFollows && (
            <Segmented
              size="sm"
              value={scope}
              onChange={setScope}
              options={[
                { value: 'followed', label: 'Artistes & labels suivis' },
                { value: 'all', label: profile.genres.length ? 'Mes genres' : 'Toutes les sorties' },
              ]}
            />
          )}
          {!hasFollows && (
            <p className="fine">Ajoutez des disques ou suivez des artistes et labels (Profil) pour un fil personnalisé. En attendant : prochaines sorties vinyles {profile.genres.length ? 'dans vos genres' : 'référencées'}.</p>
          )}
          {!online ? (
            <div className="note note-warn">
              <Icon name="alert" size={16} /> Hors connexion.
            </div>
          ) : loading ? (
            <div className="skeleton-list">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="result-skel">
                  <Skeleton w={52} h={60} r={10} />
                  <Skeleton w={56} h={56} r={8} />
                  <div style={{ flex: 1 }}>
                    <Skeleton h={14} w="70%" />
                    <Skeleton h={11} w="45%" className="mt-6" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="note note-error">
              <Icon name="alert" size={16} /> {describeError(error)} (MusicBrainz)
              <button type="button" className="link" onClick={reload}>
                Réessayer
              </button>
            </div>
          ) : items.length === 0 ? (
            <Empty icon="calendar" title="Rien de daté pour l’instant">
              Aucune sortie vinyle référencée pour cette sélection sur MusicBrainz.
            </Empty>
          ) : (
            <ul className="feed">
              {items.map((r, i) => (
                <FeedItem key={r.id} r={r} index={i} />
              ))}
            </ul>
          )}
          <p className="fine">Source : MusicBrainz (base communautaire ouverte). Seules les sorties avec une date publiée sont affichées.</p>
        </>
      )}
    </div>
  )
}

function FeedItem({ r, index }: { r: FeedRelease; index: number }) {
  const addWish = useApp((s) => s.addWish)
  const wishlist = useApp((s) => s.wishlist)
  const toast = useApp((s) => s.toast)
  const followed = wishlist.some((w) => w.mbReleaseId === r.id)
  const d = new Date(r.date.length === 7 ? r.date + '-01' : r.date)
  const left = r.date.length >= 10 ? daysUntil(r.date) : undefined
  return (
    <motion.li className="feed-item" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: Math.min(index, 10) * 0.03 }}>
      <div className="feed-date">
        <span className="feed-day mono">{r.date.length >= 10 ? d.getDate() : '—'}</span>
        <span className="feed-month mono">{dateFmt(d, { month: 'short' })}</span>
        {left != null && left >= 0 && <span className="feed-left mono">J-{left}</span>}
      </div>
      <CoverArt src={{ artist: r.artist, title: r.title, coverUrl: r.coverUrl }} className="feed-cover" />
      <div className="feed-text">
        <span className="record-title">{r.title}</span>
        <span className="record-artist">{r.artist}</span>
        <span className="record-meta mono clamp-1">{[r.label, r.format, r.country].filter(Boolean).join(' · ')}</span>
        <span className="result-tags">
          {r.kind === 'reissue' ? <Badge>Réédition{r.firstReleaseDate ? ` · orig. ${r.firstReleaseDate.slice(0, 4)}` : ''}</Badge> : left != null && left < 0 ? <Badge>Sorti</Badge> : <Badge tone="accent">Nouvelle sortie</Badge>}
          {r.limited && <Badge tone="info">Limitée</Badge>}
        </span>
        <div className="feed-actions">
          <Button
            size="sm"
            variant={followed ? 'ghost' : 'glass'}
            icon={followed ? 'check' : 'bell'}
            disabled={followed}
            onClick={() => {
              addWish({ artist: r.artist, title: r.title, edition: [r.format, r.country, r.label].filter(Boolean).join(' · '), coverUrl: r.coverUrl, releaseDate: r.date.length >= 10 ? r.date : undefined, status: left != null && left > 0 ? 'upcoming' : 'unknown', alert: true, mbReleaseId: r.id, reason: r.kind === 'reissue' ? 'Réédition suivie' : 'Sortie suivie' })
              toast('Album suivi — ajouté à la wishlist')
            }}
          >
            {followed ? 'Suivi' : 'Suivre'}
          </Button>
          {left != null && left > 0 && (
            <Button size="sm" variant="glass" icon="calendar" onClick={() => addToCalendar({ title: `Sortie vinyle : ${r.artist} — ${r.title}`, date: r.date, description: [r.label, r.format].filter(Boolean).join(' · '), url: r.url })}>
              Rappel
            </Button>
          )}
          <ExternalLink href={r.url}>Source</ExternalLink>
        </div>
      </div>
    </motion.li>
  )
}

/** Précommandes / restocks : aucune source publique — mode démo explicitement signalé. */
function DemoRetail({ kind }: { kind: 'preorder' | 'restock' }) {
  const items =
    kind === 'preorder'
      ? [
          { a: 'Marée Basse', t: 'Contre-Courant', e: 'Vinyle vert, 500 ex.', d: 41, p: 29.9, seed: 4441 },
          { a: 'Orchid Theory', t: 'Glass Cathedral', e: '2LP rose néon', d: 63, p: 36.5, seed: 1203 },
          { a: 'Polar Ghosts', t: 'Kelvin Sessions', e: 'Coffret 3LP numéroté', d: 88, p: 79, seed: 3307 },
        ]
      : [
          { a: 'The Velvet Static', t: 'Low Signal', e: 'Repress 2026, noir 180 g', d: 0, p: 27.9, seed: 7919 * 1 + 13 },
          { a: 'Kōji Haru', t: 'Midnight Arcade', e: 'Réédition obi', d: 0, p: 34, seed: 7919 * 2 + 13 },
        ]
  return (
    <div className="form-stack">
      <div className="demo-banner">
        <Icon name="info" size={18} />
        <p>
          <strong>Mode démonstration.</strong> Aucune API publique ne fournit les {kind === 'preorder' ? 'précommandes' : 'remises en stock'} des disquaires. Ces exemples sont fictifs ; un connecteur
          (flux des boutiques partenaires) pourra être branché côté serveur.
        </p>
      </div>
      <ul className="feed">
        {items.map((x, i) => (
          <motion.li key={x.t} className="feed-item is-demo" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: i * 0.04 }}>
            <div className="feed-date">
              <span className="feed-day mono">{kind === 'preorder' ? `J-${x.d}` : 'NEW'}</span>
              <span className="feed-month mono">{kind === 'preorder' ? 'précommande' : 'restock'}</span>
            </div>
            <CoverArt src={{ artist: x.a, title: x.t, coverSeed: x.seed }} className="feed-cover" />
            <div className="feed-text">
              <span className="record-title">{x.t}</span>
              <span className="record-artist">{x.a}</span>
              <span className="record-meta mono">{x.e} · {x.p.toFixed(2).replace('.', ',')} €</span>
              <span className="result-tags">
                <DemoBadge />
              </span>
            </div>
          </motion.li>
        ))}
      </ul>
    </div>
  )
}

/* ── Wishlist ── */
function Wishlist() {
  const wishlist = useApp((s) => s.wishlist)
  const [editing, setEditing] = useState<WishItem | null>(null)
  const [creating, setCreating] = useState(false)
  const sorted = useMemo(
    () =>
      [...wishlist].sort((a, b) => {
        const da = a.releaseDate ? daysUntil(a.releaseDate) : 9999
        const db = b.releaseDate ? daysUntil(b.releaseDate) : 9999
        return (da >= 0 ? da : 9998) - (db >= 0 ? db : 9998) || b.createdAt - a.createdAt
      }),
    [wishlist],
  )
  return (
    <div className="form-stack">
      <Button variant="glass" icon="plus" onClick={() => setCreating(true)}>
        Ajouter à la wishlist
      </Button>
      {sorted.length === 0 ? (
        <Empty icon="heart" title="Wishlist vide">
          Suivez une sortie, ajoutez une recommandation ou saisissez un disque recherché, avec un prix cible.
        </Empty>
      ) : (
        <ul className="wish-list">
          <AnimatePresence initial={false}>
            {sorted.map((w) => (
              <WishRow key={w.id} w={w} onEdit={() => setEditing(w)} />
            ))}
          </AnimatePresence>
        </ul>
      )}
      <WishSheet item={editing} open={!!editing || creating} onClose={() => { setEditing(null); setCreating(false) }} />
    </div>
  )
}

function WishRow({ w, onEdit }: { w: WishItem; onEdit: () => void }) {
  const fmt = useMoney()
  const updateWish = useApp((s) => s.updateWish)
  const left = w.releaseDate ? daysUntil(w.releaseDate) : undefined
  const under = w.lastSeen && w.targetPrice != null && w.lastSeen.value <= w.targetPrice
  return (
    <motion.li className="wish" layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -40 }} transition={spring}>
      <button type="button" className="wish-main" onClick={onEdit}>
        <CoverArt src={w} className="wish-cover" lookup />
        <span className="wish-text">
          <span className="record-title">{w.title}</span>
          <span className="record-artist">{w.artist}</span>
          {w.edition && <span className="record-meta mono clamp-1">{w.edition}</span>}
          <span className="result-tags">
            {w.demo && <DemoBadge />}
            <Badge tone={w.status === 'available' ? 'up' : w.status === 'preorder' ? 'accent' : 'neutral'}>{STATUS_LABEL[w.status]}</Badge>
            {left != null && left >= 0 && <Badge tone="info">{left === 0 ? "Aujourd'hui" : `J-${left}`}</Badge>}
            {under && <Badge tone="up">Sous la cible</Badge>}
          </span>
        </span>
      </button>
      <div className="wish-side">
        <div className="wish-prices mono">
          <span>
            <span className="muted">Cible</span> {w.targetPrice != null ? fmt(w.targetPrice) : '—'}
          </span>
          <span>
            <span className="muted">Vu</span> {w.lastSeen ? fmt(w.lastSeen.value, w.lastSeen.currency, true) : '—'}
          </span>
          {w.lastSeen && <span className="muted small">{relativeDays(w.lastSeen.at)}</span>}
        </div>
        <Toggle checked={w.alert} onChange={(v) => updateWish(w.id, { alert: v })} label="Alerte" />
      </div>
    </motion.li>
  )
}

function WishSheet({ item, open, onClose }: { item: WishItem | null; open: boolean; onClose: () => void }) {
  const addWish = useApp((s) => s.addWish)
  const updateWish = useApp((s) => s.updateWish)
  const removeWish = useApp((s) => s.removeWish)
  const toast = useApp((s) => s.toast)
  const blank = { artist: '', title: '', edition: '', target: '', date: '', status: 'unknown' as WishStatus, alert: true }
  const [f, setF] = useState(blank)
  useEffect(() => {
    if (!open) return
    setF(
      item
        ? { artist: item.artist, title: item.title, edition: item.edition ?? '', target: item.targetPrice != null ? String(item.targetPrice) : '', date: item.releaseDate ?? '', status: item.status, alert: item.alert }
        : blank,
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item])

  const save = () => {
    if (!f.artist.trim() || !f.title.trim()) return toast('Artiste et titre sont obligatoires', 'warn')
    const target = f.target.trim() ? Number(f.target.replace(',', '.')) : undefined
    const patch = { artist: f.artist.trim(), title: f.title.trim(), edition: f.edition.trim() || undefined, targetPrice: target, releaseDate: f.date || undefined, status: f.status, alert: f.alert }
    if (item) updateWish(item.id, patch)
    else addWish(patch)
    toast(item ? 'Wishlist mise à jour' : 'Ajouté à la wishlist')
    onClose()
  }

  const linkRec = { artist: f.artist, title: f.title, discogsId: item?.discogsId }
  return (
    <Sheet open={open} onClose={onClose} title={item ? 'Disque recherché' : 'Nouveau disque recherché'} full>
      <div className="form-stack">
        {item?.demo && (
          <div className="note note-demo">
            <Icon name="info" size={16} /> Élément de démonstration fictif.
          </div>
        )}
        <Field label="Artiste">
          <input value={f.artist} onChange={(e) => setF({ ...f, artist: e.target.value })} />
        </Field>
        <Field label="Titre">
          <input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        </Field>
        <Field label="Édition recherchée">
          <input value={f.edition} onChange={(e) => setF({ ...f, edition: e.target.value })} placeholder="Pressage original, vinyle couleur…" />
        </Field>
        <div className="form-row">
          <Field label="Prix cible (€)">
            <input inputMode="decimal" value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })} />
          </Field>
          <Field label="Date de sortie">
            <input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
          </Field>
        </div>
        <div className="form-group">
          <div className="form-label">Disponibilité</div>
          <div className="chip-wrap">
            {(Object.keys(STATUS_LABEL) as WishStatus[]).map((s) => (
              <Chip key={s} active={f.status === s} onClick={() => setF({ ...f, status: s })}>
                {STATUS_LABEL[s]}
              </Chip>
            ))}
          </div>
        </div>
        <label className="check-row">
          <Toggle checked={f.alert} onChange={(v) => setF({ ...f, alert: v })} label="Alertes" />
          <span>Alertes prix cible et sortie {item?.discogsId ? '' : <span className="muted">(prix : nécessite une édition Discogs)</span>}</span>
        </label>
        {(f.artist || f.title) && (
          <div className="panel">
            <div className="kicker">Liens d’achat</div>
            <div className="link-grid">
              {CONNECTORS.map((c) => (
                <div key={c.id} className="link-card">
                  <span className="link-card-name">{c.name}</span>
                  <ExternalLink href={c.listingsUrl(linkRec)}>Annonces</ExternalLink>
                </div>
              ))}
            </div>
          </div>
        )}
        {f.date && daysUntil(f.date) > 0 && (
          <Button variant="glass" icon="calendar" onClick={() => addToCalendar({ title: `Sortie vinyle : ${f.artist} — ${f.title}`, date: f.date, description: f.edition })}>
            Ajouter un rappel au calendrier
          </Button>
        )}
        <div className="form-actions">
          {item && (
            <Button
              variant="danger"
              icon="trash"
              onClick={() => {
                removeWish(item.id)
                toast('Retiré de la wishlist')
                onClose()
              }}
            >
              Retirer
            </Button>
          )}
          <Button variant="accent" icon="check" onClick={save}>
            Enregistrer
          </Button>
        </div>
      </div>
    </Sheet>
  )
}

/* ── Alertes ── */
function Alerts() {
  const alerts = useApp((s) => s.alerts)
  const markRead = useApp((s) => s.markAlertsRead)
  const clear = useApp((s) => s.clearAlerts)
  const setTab = useApp((s) => s.setTab)
  const toast = useApp((s) => s.toast)
  const [checking, setChecking] = useState(false)
  useEffect(() => {
    const t = setTimeout(markRead, 1200)
    return () => clearTimeout(t)
  }, [markRead, alerts.length])

  const check = async () => {
    setChecking(true)
    try {
      const n = await checkAlerts(true)
      toast(n ? `${n} nouvelle${n > 1 ? 's' : ''} alerte${n > 1 ? 's' : ''}` : 'Rien de nouveau')
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="form-stack">
      <div className="btn-row">
        <Button variant="glass" icon="refresh" onClick={check} busy={checking}>
          Vérifier maintenant
        </Button>
        <IconButton icon="bell" label="Réglages des notifications" onClick={() => setTab('profile')} />
        {alerts.length > 0 && <IconButton icon="trash" label="Effacer les alertes" onClick={clear} />}
      </div>
      {alerts.length === 0 ? (
        <Empty icon="bell" title="Aucune alerte">
          Activez l’alerte d’un disque de votre wishlist : vous serez prévenu quand une annonce Discogs passe sous votre prix cible ou quand la date de sortie arrive.
        </Empty>
      ) : (
        <ul className="alert-list">
          {alerts.map((a) => (
            <motion.li key={a.id} className={`alert-item ${a.read ? '' : 'is-unread'}`} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <span className={`alert-icon alert-${a.kind}`}>
                <Icon name={a.kind === 'price' ? 'tag' : a.kind === 'release' ? 'calendar' : 'info'} size={17} />
              </span>
              <div className="alert-text">
                <span className="record-title">{a.title}</span>
                <span className="fine">{a.body}</span>
                <span className="mono muted small">{relativeDays(a.at)}</span>
              </div>
              {a.url && (
                <a href={a.url} target="_blank" rel="noopener noreferrer" className="icon-link" aria-label="Voir l’annonce">
                  <Icon name="external" size={16} />
                </a>
              )}
            </motion.li>
          ))}
        </ul>
      )}
      <p className="fine">
        Les alertes reposent sur des données vérifiées (statistiques Discogs, dates publiées). Elles sont contrôlées à l’ouverture de l’app ; les notifications en arrière-plan
        nécessiteront le backend de synchronisation.
      </p>
    </div>
  )
}

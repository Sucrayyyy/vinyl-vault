import { motion } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { ValueChart } from '../../components/Chart'
import { CoverArt } from '../../components/CoverArt'
import { Icon } from '../../components/Icon'
import { Badge, Button, Chip, DemoBadge, ExternalLink, Field, IconButton, Segmented, Sheet, Skeleton, softSpring, spring } from '../../components/ui'
import { deletePhoto } from '../../lib/db'
import { useAsync, useEstimates, useMoney } from '../../lib/hooks'
import { useApp } from '../../lib/store'
import { CONDITIONS, CONDITION_LABELS, type Condition, type PriceKind, type PriceObservation, type SourceId, type VinylRecord } from '../../lib/types'
import { dateFmt, relativeDays } from '../../lib/util'
import { BASIS_LABEL, estimate } from '../../lib/valuation'
import { getMasterVersions, masterUrl, releaseUrl } from '../../services/discogs'
import { describeError } from '../../services/http'
import { CONNECTORS, refreshRecordPrices } from '../../services/market'
import { RecordForm, type Draft } from './RecordForm'

export const KIND_LABEL: Record<PriceKind, string> = {
  sold: 'Vente réelle',
  asking: 'Prix affiché',
  'asking-low': 'Prix affiché le plus bas',
  suggested: 'Suggestion par état',
  manual: 'Estimation personnelle',
}
export const SOURCE_LABEL: Record<SourceId, string> = { discogs: 'Discogs', ebay: 'eBay', leboncoin: 'Leboncoin', manual: 'Saisie manuelle', demo: 'Démo (fictif)' }

export function VinylDisc({ className = '', spin = true }: { className?: string; spin?: boolean }) {
  return (
    <div className={`vinyl ${spin ? 'vinyl-spin' : ''} ${className}`} aria-hidden="true">
      <div className="vinyl-label">
        <span className="vinyl-hole" />
      </div>
    </div>
  )
}

export function RecordDetail({ id }: { id: string }) {
  const rec = useApp((s) => s.records.find((r) => r.id === id))
  const close = () => useApp.getState().openRecord(null)
  if (!rec) return null
  return <DetailBody rec={rec} onClose={close} />
}

function DetailBody({ rec, onClose }: { rec: VinylRecord; onClose: () => void }) {
  const updateRecord = useApp((s) => s.updateRecord)
  const removeRecord = useApp((s) => s.removeRecord)
  const restoreRecord = useApp((s) => s.restoreRecord)
  const allPrices = useApp((s) => s.prices)
  const removePrice = useApp((s) => s.removePrice)
  const toast = useApp((s) => s.toast)
  const fmt = useMoney()
  const est = useEstimates().get(rec.id) ?? estimate(rec, allPrices)
  const [editing, setEditing] = useState(false)
  const [adding, setAdding] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const prices = useMemo(() => allPrices.filter((p) => p.recordId === rec.id).sort((a, b) => b.at - a.at), [allPrices, rec.id])
  const series = useMemo(() => {
    const days = [...new Set(prices.map((p) => p.at))].sort((a, b) => a - b)
    return days
      .map((at) => ({ at, e: estimate(rec, prices, at) }))
      .filter((x) => x.e.value != null)
      .map((x) => ({ at: x.at, value: x.e.value!, label: `${dateFmt(x.at)} · ${BASIS_LABEL[x.e.basis]}` }))
  }, [prices, rec])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.classList.add('has-detail')
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.classList.remove('has-detail')
    }
  }, [onClose])

  const refresh = async () => {
    setRefreshing(true)
    try {
      const r = await refreshRecordPrices(rec)
      toast(r.message, r.added ? 'ok' : 'warn')
    } catch (e) {
      toast(describeError(e), 'error')
    } finally {
      setRefreshing(false)
    }
  }

  const doDelete = () => {
    const ownPrices = prices
    const removed = removeRecord(rec.id)
    if (!removed) return
    useApp.setState((s) => ({ prices: s.prices.filter((p) => p.recordId !== rec.id) }))
    toast(`« ${removed.title} » supprimé`, 'ok', {
      label: 'Annuler',
      run: () => restoreRecord(removed, ownPrices),
    })
    // La photo n'est effacée qu'après le délai d'annulation.
    if (removed.photoKey) setTimeout(() => {
      if (!useApp.getState().records.some((r) => r.id === removed.id)) void deletePhoto(removed.photoKey!)
    }, 6000)
  }

  return (
    <motion.div className="detail" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.2, delay: 0.05 } }} transition={{ duration: 0.25 }}>
      <div className="detail-backdrop" aria-hidden>
        <CoverArt src={rec} className="detail-backdrop-art" />
      </div>
      <div className="detail-scroll">
        <header className="detail-bar">
          <IconButton icon="back" label="Retour" onClick={onClose} />
          <div className="detail-bar-actions">
            <IconButton icon="heart" label={rec.favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'} active={!!rec.favorite} onClick={() => updateRecord(rec.id, { favorite: !rec.favorite })} />
            <IconButton icon="edit" label="Modifier" onClick={() => setEditing(true)} />
          </div>
        </header>

        <div className="detail-hero">
          <motion.div className="detail-disc-wrap" initial={{ x: 0, opacity: 0 }} animate={{ x: '26%', opacity: 1 }} transition={{ ...softSpring, delay: 0.25 }}>
            <VinylDisc />
          </motion.div>
          <motion.div layoutId={`cover-${rec.id}`} className="detail-cover" transition={spring}>
            <CoverArt src={rec} eager />
          </motion.div>
        </div>

        <motion.div className="detail-content" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ ...softSpring, delay: 0.12 }}>
          <div className="detail-titles">
            <h1 className="display detail-title">{rec.title}</h1>
            <p className="detail-artist">{rec.artist}</p>
            <div className="badge-row">
              {rec.demo && <DemoBadge />}
              {rec.pressing === 'original' && <Badge tone="accent">Pressage original</Badge>}
              {rec.pressing === 'reissue' && <Badge>Réédition</Badge>}
              {rec.color && <Badge tone="info">{rec.color}</Badge>}
              {(rec.discs ?? 1) > 1 && <Badge>{rec.discs} disques</Badge>}
              {rec.mediaCondition && <Badge>Disque {rec.mediaCondition}</Badge>}
            </div>
          </div>

          {/* Valeur */}
          <section className="panel">
            <div className="panel-head">
              <div>
                <div className="kicker">Valeur estimée</div>
                <div className="value-big small">{est.value != null ? fmt(est.value) : 'Indisponible'}</div>
                <div className="value-sub mono">
                  {BASIS_LABEL[est.basis]}
                  {est.confidence !== 'aucune' && ` · confiance ${est.confidence}`}
                  {est.at && ` · ${relativeDays(est.at)}`}
                </div>
              </div>
              {rec.purchasePrice != null && est.value != null && (
                <div className="panel-aside">
                  <span className="kicker">vs achat</span>
                  <span className={`mono ${est.value - rec.purchasePrice >= 0 ? 'up' : 'down'}`}>
                    {est.value - rec.purchasePrice >= 0 ? '+' : '−'}
                    {fmt(Math.abs(est.value - rec.purchasePrice))}
                  </span>
                </div>
              )}
            </div>
            {est.basis === 'asking-low' && <p className="fine">Indicatif : basé sur le prix le plus bas actuellement demandé, tous états confondus — pas sur une vente conclue.</p>}
            {est.basis === 'none' && (
              <p className="fine">
                {rec.discogsId ? 'Aucune observation de prix pour cette édition. Actualisez ou ajoutez une vente que vous avez constatée.' : 'Associez ce disque à une édition Discogs (via le scan) ou saisissez une observation de prix.'}
              </p>
            )}
            {series.length >= 2 && <ValueChart points={series} format={(n) => fmt(n)} height={140} />}
            <div className="btn-row">
              <Button variant="glass" size="sm" icon="refresh" onClick={refresh} busy={refreshing} disabled={!rec.discogsId || rec.demo}>
                Actualiser
              </Button>
              <Button variant="glass" size="sm" icon="plus" onClick={() => setAdding(true)}>
                Ajouter un prix
              </Button>
            </div>
          </section>

          {/* Historique des observations */}
          {prices.length > 0 && (
            <section className="panel">
              <div className="kicker">Historique des observations</div>
              <ul className="obs-list">
                {prices.map((p) => (
                  <li key={p.id} className="obs">
                    <span className={`basis-dot basis-${p.kind === 'asking' ? 'asking-low' : p.kind}`} />
                    <div className="obs-text">
                      <span>
                        {KIND_LABEL[p.kind]}
                        {p.condition && <span className="muted"> · {p.condition}</span>}
                        {p.count != null && <span className="muted"> · {p.count} annonce{p.count > 1 ? 's' : ''}</span>}
                      </span>
                      <span className="mono muted">
                        {SOURCE_LABEL[p.source]} · {dateFmt(p.at)}
                      </span>
                    </div>
                    <span className="mono obs-value">{fmt(p.value, p.currency, true)}</span>
                    {p.url ? (
                      <a className="obs-link" href={p.url} target="_blank" rel="noopener noreferrer" aria-label="Voir la source">
                        <Icon name="external" size={15} />
                      </a>
                    ) : (
                      <span className="obs-link" />
                    )}
                    {!p.demo && (
                      <button type="button" className="obs-del" aria-label="Supprimer cette observation" onClick={() => removePrice(p.id)}>
                        <Icon name="close" size={14} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Annonces comparables */}
          <section className="panel">
            <div className="kicker">Annonces et ventes comparables</div>
            <div className="link-grid">
              {CONNECTORS.map((c) => (
                <div key={c.id} className="link-card">
                  <span className="link-card-name">{c.name}</span>
                  <ExternalLink href={c.listingsUrl(rec)}>Annonces</ExternalLink>
                  {c.soldUrl?.(rec) && <ExternalLink href={c.soldUrl(rec)!}>Ventes</ExternalLink>}
                </div>
              ))}
            </div>
            <p className="fine">Les recherches sont pré-remplies avec l’artiste, le titre et la référence. Vérifiez l’édition exacte et l’état avant de comparer.</p>
          </section>

          {/* Fiche édition */}
          <section className="panel">
            <div className="kicker">Édition</div>
            <dl className="spec">
              <Spec k="Label" v={rec.label} />
              <Spec k="Référence" v={rec.catno} mono />
              <Spec k="Année" v={rec.year} />
              <Spec k="Pays" v={rec.country} />
              <Spec k="Format" v={rec.formatText} />
              <Spec k="Couleur" v={rec.color ?? (rec.formatText ? 'Noir (standard)' : undefined)} />
              <Spec k="Disques" v={rec.discs} />
              <Spec k="Code-barres" v={rec.barcode} mono />
              <Spec k="Genres" v={[...rec.genres, ...rec.styles].join(', ') || undefined} />
            </dl>
            {rec.discogsId && (
              <div className="btn-row">
                <ExternalLink href={releaseUrl(rec.discogsId)}>Fiche Discogs</ExternalLink>
                {rec.masterId && <ExternalLink href={masterUrl(rec.masterId)}>Toutes les éditions</ExternalLink>}
              </div>
            )}
          </section>

          <section className="panel">
            <div className="kicker">État & achat</div>
            <dl className="spec">
              <Spec k="Disque" v={rec.mediaCondition && `${rec.mediaCondition} — ${CONDITION_LABELS[rec.mediaCondition]}`} />
              <Spec k="Pochette" v={rec.sleeveCondition && `${rec.sleeveCondition} — ${CONDITION_LABELS[rec.sleeveCondition]}`} />
              <Spec k="Prix payé" v={rec.purchasePrice != null ? fmt(rec.purchasePrice, 'EUR', true) : undefined} />
              <Spec k="Date d’achat" v={rec.purchaseDate && dateFmt(rec.purchaseDate)} />
              <Spec k="Lieu" v={rec.purchasePlace} />
              <Spec k="Rangement" v={rec.shelf} />
              <Spec k="Ajouté" v={dateFmt(rec.createdAt)} />
            </dl>
            {rec.notes && <p className="notes">{rec.notes}</p>}
          </section>

          {rec.masterId && !rec.demo && <OtherEditions masterId={rec.masterId} currentId={rec.discogsId} artist={rec.artist} title={rec.title} />}

          {rec.tracklist && rec.tracklist.length > 0 && (
            <section className="panel">
              <div className="kicker">Pistes</div>
              <ol className="tracks">
                {rec.tracklist.map((t, i) => (
                  <li key={i}>
                    <span className="mono muted">{t.position}</span>
                    <span>{t.title}</span>
                    <span className="mono muted">{t.duration}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          <Button variant="danger" icon="trash" onClick={() => setConfirmDelete(true)} className="btn-block">
            Supprimer de la collection
          </Button>
        </motion.div>
      </div>

      <EditSheet rec={rec} open={editing} onClose={() => setEditing(false)} />
      <AddPriceSheet rec={rec} open={adding} onClose={() => setAdding(false)} />
      <Sheet open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Supprimer ce disque ?">
        <p className="fine">
          « {rec.title} » et son historique de prix seront retirés de la collection. Vous pourrez annuler pendant quelques secondes.
        </p>
        <div className="form-actions">
          <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
            Garder
          </Button>
          <Button variant="danger" icon="trash" onClick={() => { setConfirmDelete(false); doDelete() }}>
            Supprimer
          </Button>
        </div>
      </Sheet>
    </motion.div>
  )
}

function Spec({ k, v, mono }: { k: string; v?: string | number; mono?: boolean }) {
  if (v === undefined || v === '') return null
  return (
    <>
      <dt>{k}</dt>
      <dd className={mono ? 'mono' : ''}>{v}</dd>
    </>
  )
}

function EditSheet({ rec, open, onClose }: { rec: VinylRecord; open: boolean; onClose: () => void }) {
  const updateRecord = useApp((s) => s.updateRecord)
  const toast = useApp((s) => s.toast)
  const [draft, setDraft] = useState<Draft>(rec)
  useEffect(() => {
    if (open) setDraft(rec)
  }, [open, rec])
  const save = () => {
    if (!draft.artist.trim() || !draft.title.trim()) {
      toast('Artiste et titre sont obligatoires', 'warn')
      return
    }
    updateRecord(rec.id, draft)
    toast('Modifications enregistrées')
    onClose()
  }
  return (
    <Sheet open={open} onClose={onClose} title="Modifier" full headerRight={<Button size="sm" variant="accent" onClick={save}>Enregistrer</Button>}>
      <RecordForm draft={draft} onChange={setDraft} />
      <div className="form-actions">
        <Button variant="accent" icon="check" onClick={save} className="btn-block">
          Enregistrer
        </Button>
      </div>
    </Sheet>
  )
}

function AddPriceSheet({ rec, open, onClose }: { rec: VinylRecord; open: boolean; onClose: () => void }) {
  const addPrice = useApp((s) => s.addPrice)
  const toast = useApp((s) => s.toast)
  const [kind, setKind] = useState<PriceKind>('sold')
  const [source, setSource] = useState<SourceId>('discogs')
  const [value, setValue] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [cond, setCond] = useState<Condition | undefined>(rec.mediaCondition)
  const [url, setUrl] = useState('')

  const save = () => {
    const v = Number(value.replace(',', '.'))
    if (!v || v <= 0) {
      toast('Indiquez un montant valide', 'warn')
      return
    }
    const safeUrl = /^https:\/\//.test(url.trim()) ? url.trim() : undefined
    const obs: Omit<PriceObservation, 'id'> = {
      recordId: rec.id,
      at: new Date(date + 'T12:00:00').getTime(),
      kind,
      source: kind === 'manual' ? 'manual' : source,
      value: v,
      currency: 'EUR',
      condition: cond,
      url: safeUrl,
    }
    addPrice(obs)
    toast('Observation ajoutée')
    setValue('')
    setUrl('')
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title="Ajouter une observation de prix">
      <div className="form-stack">
        <Segmented
          value={kind}
          onChange={setKind}
          options={[
            { value: 'sold', label: 'Vente réelle' },
            { value: 'asking', label: 'Annonce' },
            { value: 'manual', label: 'Estimation' },
          ]}
        />
        <p className="fine">
          {kind === 'sold' && 'Prix effectivement payé lors d’une vente conclue (ex. historique Discogs, vente eBay terminée).'}
          {kind === 'asking' && 'Prix demandé dans une annonce en cours. Il n’est pas utilisé comme estimation principale.'}
          {kind === 'manual' && 'Votre propre estimation, utilisée faute de ventes ou de suggestion.'}
        </p>
        <div className="form-row">
          <Field label="Montant (€)">
            <input inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder="0,00" autoFocus />
          </Field>
          <Field label="Date">
            <input type="date" value={date} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>
        {kind !== 'manual' && (
          <div className="form-group">
            <div className="form-label">Source</div>
            <div className="chip-wrap">
              {(['discogs', 'ebay', 'leboncoin', 'manual'] as SourceId[]).map((s) => (
                <Chip key={s} active={source === s} onClick={() => setSource(s)}>
                  {s === 'manual' ? 'Autre' : SOURCE_LABEL[s]}
                </Chip>
              ))}
            </div>
          </div>
        )}
        <div className="form-group">
          <div className="form-label">État concerné</div>
          <div className="chip-wrap">
            {CONDITIONS.slice(0, 6).map((c) => (
              <Chip key={c} active={cond === c} onClick={() => setCond(cond === c ? undefined : c)}>
                {c}
              </Chip>
            ))}
          </div>
        </div>
        {kind !== 'manual' && (
          <Field label="Lien vers la source (https)">
            <input type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
          </Field>
        )}
        <Button variant="accent" icon="check" onClick={save} className="btn-block">
          Enregistrer l’observation
        </Button>
      </div>
    </Sheet>
  )
}

function OtherEditions({ masterId, currentId, artist, title }: { masterId: number; currentId?: number; artist: string; title: string }) {
  const [show, setShow] = useState(false)
  const addWish = useApp((s) => s.addWish)
  const toast = useApp((s) => s.toast)
  return (
    <section className="panel">
      <div className="panel-head">
        <div className="kicker">Autres éditions vinyle</div>
        {!show && (
          <Button size="sm" variant="glass" onClick={() => setShow(true)}>
            Afficher
          </Button>
        )}
      </div>
      {show && (
        <VersionsList
          masterId={masterId}
          currentId={currentId}
          onWish={(v) => {
            addWish({ artist, title, edition: [v.released, v.country, v.format].filter(Boolean).join(' · '), discogsId: v.id, masterId, status: 'unknown', alert: true, reason: 'Édition alternative d’un disque possédé' })
            toast('Ajouté à la wishlist')
          }}
        />
      )}
    </section>
  )
}

function VersionsList({ masterId, currentId, onWish }: { masterId: number; currentId?: number; onWish: (v: { id: number; released: string; country: string; format: string }) => void }) {
  const { loading, error, data, reload } = useAsync(() => getMasterVersions(masterId), [masterId])
  if (loading)
    return (
      <div className="skeleton-list">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} h={44} r={10} />
        ))}
      </div>
    )
  if (error)
    return (
      <div className="note">
        <Icon name="alert" size={16} /> {describeError(error)}{' '}
        <button type="button" className="link" onClick={reload}>
          Réessayer
        </button>
      </div>
    )
  const versions = data?.versions ?? []
  return (
    <ul className="version-list">
      {versions.map((v) => (
        <li key={v.id} className={v.id === currentId ? 'is-current' : ''}>
          <div className="version-text">
            <span>
              {v.released || '—'} · {v.country || '—'}
            </span>
            <span className="muted">
              {v.label} · <span className="mono">{v.catno}</span>
            </span>
            <span className="muted small">{v.format}</span>
          </div>
          {v.id === currentId ? (
            <Badge tone="accent">La vôtre</Badge>
          ) : (
            <div className="version-actions">
              <a href={releaseUrl(v.id)} target="_blank" rel="noopener noreferrer" className="icon-link" aria-label="Voir sur Discogs">
                <Icon name="external" size={16} />
              </a>
              <button type="button" className="icon-link" aria-label="Ajouter à la wishlist" onClick={() => onWish(v)}>
                <Icon name="heart" size={16} />
              </button>
            </div>
          )}
        </li>
      ))}
      {versions.length === 0 && <li className="muted">Aucune autre édition vinyle référencée.</li>}
    </ul>
  )
}

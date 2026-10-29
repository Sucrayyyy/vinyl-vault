import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { CoverArt } from '../../components/CoverArt'
import { Icon, type IconName } from '../../components/Icon'
import { Badge, Button, Field, Sheet, Skeleton, softSpring, spring } from '../../components/ui'
import { putPhoto } from '../../lib/db'
import { compressImage } from '../../lib/image'
import { useApp } from '../../lib/store'
import { haptic, uid } from '../../lib/util'
import {
  describeFormat,
  getMaster,
  getRelease,
  releaseToDraft,
  searchReleases,
  splitTitle,
  type DgSearchResult,
} from '../../services/discogs'
import { describeError } from '../../services/http'
import { findArtwork } from '../../services/itunes'
import { refreshRecordPrices } from '../../services/market'
import { detectBarcode } from '../../services/recognition/barcode'
import { readCoverText } from '../../services/recognition/ocr'
import { BarcodeScanner } from './BarcodeScanner'
import { VinylDisc } from './RecordDetail'
import { emptyDraft, RecordForm, type Draft } from './RecordForm'

type Step = 'choose' | 'analyzing' | 'barcode' | 'results' | 'confirm' | 'done'

interface Guess {
  method: 'vision' | 'ocr' | 'barcode' | 'manual'
  artist: string
  title: string
  query: string
  confidence?: number
  barcode?: string
  catno?: string
}

const STAGES = ['Lecture de la pochette', 'Identification de l’album', 'Recherche des éditions']

export function AddFlow() {
  const open = useApp((s) => s.addOpen)
  const setOpen = useApp((s) => s.setAddOpen)
  return (
    <Sheet open={open} onClose={() => setOpen(false)} title="Ajouter un vinyle" full>
      {open && <Flow onClose={() => setOpen(false)} />}
    </Sheet>
  )
}

function Flow({ onClose }: { onClose: () => void }) {
  const settings = useApp((s) => s.settings)
  const privacy = useApp((s) => s.profile.privacy)
  const records = useApp((s) => s.records)
  const addRecord = useApp((s) => s.addRecord)
  const openRecord = useApp((s) => s.openRecord)
  const setTab = useApp((s) => s.setTab)
  const toast = useApp((s) => s.toast)

  const [step, setStep] = useState<Step>('choose')
  const [photo, setPhoto] = useState<Blob>()
  const [photoUrl, setPhotoUrl] = useState<string>()
  const [stage, setStage] = useState(0)
  const [progress, setProgress] = useState<number>()
  const [guess, setGuess] = useState<Guess>({ method: 'manual', artist: '', title: '', query: '' })
  const [results, setResults] = useState<DgSearchResult[]>([])
  const [page, setPage] = useState({ page: 1, pages: 1 })
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string>()
  const [draft, setDraft] = useState<Draft>(emptyDraft())
  const [loadingRelease, setLoadingRelease] = useState<number | null>(null)
  const [usePhotoCover, setUsePhotoCover] = useState(false)
  const [added, setAdded] = useState<string>()
  const runId = useRef(0)

  useEffect(() => () => {
    if (photoUrl) URL.revokeObjectURL(photoUrl)
  }, [photoUrl])

  const visionAvailable = !!settings.anthropicKey && privacy.sendPhotosToVision && settings.recognition !== 'ocr'

  const search = useCallback(async (g: Guess, p = 1) => {
    setSearching(true)
    setError(undefined)
    try {
      let res
      if (g.barcode) res = await searchReleases({ barcode: g.barcode }, p)
      else if (g.artist && g.title) {
        res = await searchReleases({ artist: g.artist, title: g.title }, p)
        if (!res.results.length) res = await searchReleases({ q: `${g.artist} ${g.title}` }, p)
      } else res = await searchReleases({ q: g.query }, p)
      if (!res.results.length && g.catno) res = await searchReleases({ catno: g.catno }, p)
      setResults((prev) => (p === 1 ? res.results : [...prev, ...res.results]))
      setPage({ page: res.pagination.page, pages: res.pagination.pages })
    } catch (e) {
      setError(describeError(e))
      if (p === 1) setResults([])
    } finally {
      setSearching(false)
    }
  }, [])

  const analyze = async (file?: File) => {
    if (!file) return
    const id = ++runId.current
    setError(undefined)
    setStep('analyzing')
    setStage(0)
    setProgress(undefined)
    try {
      const small = await compressImage(file, 1024, 0.85)
      if (id !== runId.current) return
      setPhoto(small)
      setPhotoUrl(URL.createObjectURL(small))
      setUsePhotoCover(false)
      setStage(1)

      let g: Guess | null = null
      // 1) Code-barres éventuellement visible sur la photo (dos de pochette).
      try {
        const bmp = await createImageBitmap(small)
        const code = await detectBarcode(bmp)
        bmp.close()
        if (code) g = { method: 'barcode', artist: '', title: '', query: code, barcode: code }
      } catch {
        /* pas de code-barres */
      }
      // 2) Vision (clé utilisateur) si disponible.
      if (!g && visionAvailable) {
        const vision = await import('../../services/recognition/vision')
        try {
          const v = await vision.identifyCover(small, settings.anthropicKey!)
          if (v.artist && v.title && v.confidence >= 0.3) g = { method: 'vision', artist: v.artist, title: v.title, query: `${v.artist} ${v.title}`, confidence: v.confidence, catno: v.catno }
        } catch (e) {
          toast(vision.describeVisionError(e), 'warn')
        }
      }
      // 3) OCR embarqué.
      if (!g) {
        const lines = await readCoverText(small, (p) => id === runId.current && setProgress(p))
        const q = lines.slice(0, 3).join(' ')
        g = { method: 'ocr', artist: '', title: '', query: q }
      }
      if (id !== runId.current) return
      setGuess(g)
      setStage(2)
      if (g.query.trim() || g.barcode) await search(g)
      if (id !== runId.current) return
      setStep('results')
    } catch (e) {
      if (id !== runId.current) return
      setError(e instanceof Error ? e.message : 'Analyse impossible')
      setStep('results')
    }
  }

  const onBarcode = useCallback(
    (code: string) => {
      const g: Guess = { method: 'barcode', artist: '', title: '', query: code, barcode: code }
      setGuess(g)
      setStep('results')
      void search(g)
    },
    [search],
  )

  const pick = async (r: DgSearchResult) => {
    setLoadingRelease(r.id)
    try {
      const rel = await getRelease(r.id)
      let masterYear: number | undefined
      if (rel.master_id) {
        try {
          masterYear = (await getMaster(rel.master_id)).year
        } catch {
          /* année d'origine facultative */
        }
      }
      const d = releaseToDraft(rel, masterYear)
      if (!d.coverUrl) d.coverUrl = r.cover_image || (await findArtwork(d.artist, d.title))
      setDraft(d)
      setUsePhotoCover(!d.coverUrl && !!photo)
      setStep('confirm')
    } catch (e) {
      toast(describeError(e), 'error')
    } finally {
      setLoadingRelease(null)
    }
  }

  const manualEntry = () => {
    const d = emptyDraft()
    d.artist = guess.artist
    d.title = guess.title || (guess.method === 'ocr' ? '' : guess.query)
    d.barcode = guess.barcode
    setDraft(d)
    setUsePhotoCover(!!photo)
    setStep('confirm')
  }

  const confirm = async () => {
    if (!draft.artist.trim() || !draft.title.trim()) {
      toast('Artiste et titre sont obligatoires', 'warn')
      return
    }
    let photoKey: string | undefined
    if (usePhotoCover && photo) {
      photoKey = uid()
      try {
        await putPhoto(photoKey, photo)
      } catch {
        photoKey = undefined
        toast('Photo non enregistrée (stockage plein ?)', 'warn')
      }
    }
    const rec = addRecord({ ...draft, photoKey, coverUrl: usePhotoCover ? undefined : draft.coverUrl })
    haptic(18)
    setAdded(rec.id)
    setStep('done')
    if (rec.discogsId && privacy.priceLookups) refreshRecordPrices(rec).catch(() => undefined)
  }

  const duplicate = draft.discogsId ? records.find((r) => r.discogsId === draft.discogsId) : undefined

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={step} className="flow" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={softSpring}>
        {step === 'choose' && (
          <div className="form-stack">
            <div className="scan-hero">
              <VinylDisc className="scan-hero-disc" />
              <div className="scan-hero-sleeve" />
            </div>
            <p className="lead">Photographiez la pochette : Vinyl Vault identifie l’album puis vous propose les éditions correspondantes.</p>
            <div className="action-grid">
              <label className="action-tile action-tile-primary">
                <Icon name="camera" size={26} />
                <span className="action-title">Photographier la pochette</span>
                <span className="action-sub">Appareil photo</span>
                <input type="file" accept="image/*" capture="environment" onChange={(e) => analyze(e.target.files?.[0])} />
              </label>
              <label className="action-tile">
                <Icon name="image" size={24} />
                <span className="action-title">Choisir une photo</span>
                <span className="action-sub">Photothèque</span>
                <input type="file" accept="image/*" onChange={(e) => analyze(e.target.files?.[0])} />
              </label>
              <ActionTile icon="barcode" title="Code-barres" sub="Lecture en direct" onClick={() => setStep('barcode')} />
              <ActionTile
                icon="search"
                title="Recherche manuelle"
                sub="Artiste, titre, réf."
                onClick={() => {
                  setGuess({ method: 'manual', artist: '', title: '', query: '' })
                  setResults([])
                  setStep('results')
                }}
              />
            </div>
            <div className="note">
              <Icon name={visionAvailable ? 'spark' : 'info'} size={16} />
              {visionAvailable
                ? 'Reconnaissance visuelle Claude activée (votre clé). La photo est envoyée à l’API Anthropic.'
                : 'Reconnaissance par lecture du texte de la pochette, sur l’appareil. Pour identifier aussi les pochettes sans texte, ajoutez une clé dans Profil › Connecteurs.'}
            </div>
          </div>
        )}

        {step === 'analyzing' && (
          <div className="analyzing">
            <div className="analyzing-photo">
              {photoUrl ? <img src={photoUrl} alt="Pochette photographiée" /> : <Skeleton h="100%" r={14} />}
              <motion.span className="scan-sweep" animate={{ y: ['-10%', '110%'] }} transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }} />
            </div>
            <ol className="stages">
              {STAGES.map((s, i) => (
                <li key={s} className={i < stage ? 'is-done' : i === stage ? 'is-active' : ''}>
                  <span className="stage-dot">{i < stage ? <Icon name="check" size={13} weight={2.4} /> : null}</span>
                  {s}
                  {i === stage && i === 1 && progress != null && <span className="mono muted"> {Math.round(progress * 100)} %</span>}
                </li>
              ))}
            </ol>
            <Button variant="ghost" onClick={() => { runId.current++; setStep('choose') }}>
              Annuler
            </Button>
          </div>
        )}

        {step === 'barcode' && (
          <div className="form-stack">
            <BackLink onClick={() => setStep('choose')} />
            <BarcodeScanner onCode={onBarcode} />
          </div>
        )}

        {step === 'results' && (
          <div className="form-stack">
            <BackLink onClick={() => setStep('choose')} />
            {guess.method !== 'manual' && (
              <div className="guess">
                {photoUrl && <img src={photoUrl} alt="" className="guess-thumb" />}
                <div>
                  <div className="kicker">
                    {guess.method === 'vision' && `Identifié par vision · confiance ${Math.round((guess.confidence ?? 0) * 100)} %`}
                    {guess.method === 'ocr' && (guess.query ? 'Texte lu sur la pochette' : 'Aucun texte lisible')}
                    {guess.method === 'barcode' && 'Code-barres détecté'}
                  </div>
                  <div className="guess-text">{guess.method === 'barcode' ? <span className="mono">{guess.barcode}</span> : guess.artist ? `${guess.artist} — ${guess.title}` : guess.query || 'Précisez la recherche ci-dessous'}</div>
                </div>
              </div>
            )}
            <form
              className="search-form"
              onSubmit={(e) => {
                e.preventDefault()
                const g: Guess = { ...guess, barcode: /^\d{8,14}$/.test(guess.query.trim()) ? guess.query.trim() : undefined, artist: '', title: '' }
                setGuess(g)
                void search(g)
              }}
            >
              <div className="search glass-soft">
                <Icon name="search" size={18} />
                <input
                  type="search"
                  value={guess.artist && guess.title ? `${guess.artist} ${guess.title}` : guess.query}
                  onChange={(e) => setGuess({ ...guess, artist: '', title: '', query: e.target.value })}
                  placeholder="Artiste, album, référence ou code-barres"
                  autoFocus={guess.method === 'manual'}
                  enterKeyHint="search"
                />
              </div>
              <Button type="submit" variant="accent" busy={searching} ariaLabel="Rechercher">
                OK
              </Button>
            </form>

            {error && (
              <div className="note note-error">
                <Icon name="alert" size={16} /> {error}
              </div>
            )}

            {searching && results.length === 0 ? (
              <div className="skeleton-list">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="result-skel">
                    <Skeleton w={56} h={56} r={8} />
                    <div style={{ flex: 1 }}>
                      <Skeleton h={14} w="70%" />
                      <Skeleton h={11} w="45%" className="mt-6" />
                    </div>
                  </div>
                ))}
              </div>
            ) : results.length > 0 ? (
              <>
                <div className="kicker">{results.length} édition{results.length > 1 ? 's' : ''} vinyle trouvée{results.length > 1 ? 's' : ''} sur Discogs</div>
                <ul className="results">
                  {results.map((r, i) => (
                    <ResultRow key={`${r.id}-${i}`} r={r} index={i} loading={loadingRelease === r.id} owned={records.some((x) => x.discogsId === r.id)} onPick={() => pick(r)} />
                  ))}
                </ul>
                {page.page < page.pages && (
                  <Button variant="glass" onClick={() => search(guess, page.page + 1)} busy={searching}>
                    Plus de résultats
                  </Button>
                )}
              </>
            ) : (
              !searching &&
              (guess.query || guess.barcode) && (
                <div className="note">
                  <Icon name="info" size={16} /> Aucune édition trouvée. Modifiez la recherche ou ajoutez le disque manuellement.
                </div>
              )
            )}
            <Button variant="ghost" icon="edit" onClick={manualEntry}>
              Ajouter sans correspondance
            </Button>
          </div>
        )}

        {step === 'confirm' && (
          <div className="form-stack">
            <BackLink onClick={() => setStep('results')} label="Résultats" />
            <div className="confirm-head">
              <motion.div className="confirm-cover" initial={{ rotate: -4, scale: 0.9 }} animate={{ rotate: 0, scale: 1 }} transition={spring}>
                <CoverArt src={{ artist: draft.artist || 'Artiste', title: draft.title || 'Titre', coverUrl: usePhotoCover ? photoUrl : draft.coverUrl }} eager />
              </motion.div>
              <div>
                <h2 className="display confirm-title">{draft.title || 'Nouveau disque'}</h2>
                <p className="detail-artist">{draft.artist}</p>
                <div className="badge-row">
                  {draft.pressing === 'original' && <Badge tone="accent">Original</Badge>}
                  {draft.pressing === 'reissue' && <Badge>Réédition</Badge>}
                  {draft.color && <Badge tone="info">{draft.color}</Badge>}
                  {draft.discogsId && <Badge>Discogs #{draft.discogsId}</Badge>}
                </div>
              </div>
            </div>
            {duplicate && (
              <div className="note note-warn">
                <Icon name="info" size={16} /> Cette édition est déjà dans votre collection. Vous pouvez l’ajouter à nouveau (second exemplaire).
              </div>
            )}
            {photo && (
              <label className="check-row">
                <input type="checkbox" checked={usePhotoCover} onChange={(e) => setUsePhotoCover(e.target.checked)} />
                <span>Utiliser ma photo comme pochette</span>
              </label>
            )}
            <Field label="Artiste">
              <input value={draft.artist} onChange={(e) => setDraft({ ...draft, artist: e.target.value })} />
            </Field>
            <Field label="Titre">
              <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            </Field>
            <RecordForm draft={draft} onChange={setDraft} compact />
            <div className="sticky-cta">
              <Button variant="accent" size="lg" icon="plus" onClick={confirm} className="btn-block">
                Ajouter à la collection
              </Button>
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="done">
            <div className="done-anim">
              <motion.div className="done-disc" initial={{ x: 90, rotate: 0 }} animate={{ x: 0, rotate: 200 }} transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}>
                <VinylDisc spin={false} />
              </motion.div>
              <motion.div className="done-sleeve" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={spring}>
                <CoverArt src={{ artist: draft.artist, title: draft.title, coverUrl: usePhotoCover ? photoUrl : draft.coverUrl }} eager />
              </motion.div>
              <motion.span className="done-check" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ ...spring, delay: 0.75 }}>
                <Icon name="check" size={22} weight={2.6} />
              </motion.span>
            </div>
            <h2 className="display">Ajouté au coffre</h2>
            <p className="fine center">
              {draft.artist} — {draft.title}
            </p>
            <div className="form-actions">
              <Button
                variant="glass"
                onClick={() => {
                  setDraft(emptyDraft())
                  setPhoto(undefined)
                  setPhotoUrl(undefined)
                  setResults([])
                  setStep('choose')
                }}
              >
                Ajouter un autre
              </Button>
              <Button
                variant="accent"
                onClick={() => {
                  onClose()
                  setTab('collection')
                  if (added) setTimeout(() => openRecord(added), 320)
                }}
              >
                Voir la fiche
              </Button>
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  )
}

function ActionTile({ icon, title, sub, onClick }: { icon: IconName; title: string; sub: string; onClick: () => void }) {
  return (
    <motion.button type="button" className="action-tile" onClick={onClick} whileTap={{ scale: 0.96 }} transition={spring}>
      <Icon name={icon} size={24} />
      <span className="action-title">{title}</span>
      <span className="action-sub">{sub}</span>
    </motion.button>
  )
}

function BackLink({ onClick, label = 'Retour' }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" className="back-link" onClick={onClick}>
      <Icon name="back" size={16} /> {label}
    </button>
  )
}

function ResultRow({ r, index, loading, owned, onPick }: { r: DgSearchResult; index: number; loading: boolean; owned: boolean; onPick: () => void }) {
  const { artist, title } = splitTitle(r.title)
  const f = describeFormat(r.formats)
  return (
    <motion.li initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: Math.min(index, 10) * 0.025 }}>
      <button type="button" className="result" onClick={onPick} disabled={loading}>
        <CoverArt src={{ artist, title, coverUrl: r.cover_image || r.thumb || undefined }} className="result-cover" lookup />
        <span className="result-text">
          <span className="record-title">{title}</span>
          <span className="record-artist">{artist}</span>
          <span className="record-meta mono">{[r.year, r.country, r.label?.[0], r.catno].filter(Boolean).join(' · ')}</span>
          <span className="result-tags">
            {f.color && <Badge tone="info">{f.color}</Badge>}
            {f.reissue && <Badge>Réédition</Badge>}
            {f.limited && <Badge tone="accent">Limitée</Badge>}
            {owned && <Badge tone="up">Possédé</Badge>}
          </span>
        </span>
        {loading ? <span className="spinner" /> : <Icon name="chevron" size={18} className="muted" />}
      </button>
    </motion.li>
  )
}

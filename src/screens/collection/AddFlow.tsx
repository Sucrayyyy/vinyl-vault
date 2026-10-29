import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { CoverArt } from '../../components/CoverArt'
import { Icon } from '../../components/Icon'
import { Previews } from '../../components/Previews'
import { Badge, Button, Chip, Field, Sheet, Skeleton, softSpring, spring } from '../../components/ui'
import { putPhoto } from '../../lib/db'
import { useDebounced } from '../../lib/hooks'
import { compressImage } from '../../lib/image'
import { useApp } from '../../lib/store'
import type { Condition } from '../../lib/types'
import { haptic, uid } from '../../lib/util'
import { bestCover } from '../../services/covers'
import { getMaster, getRelease, releaseToDraft, searchReleases, type DgSearchResult } from '../../services/discogs'
import { describeError } from '../../services/http'
import { refreshRecordPrices } from '../../services/market'
import { detectBarcode } from '../../services/recognition/barcode'
import { queriesFrom, rankAlbums, type AlbumCandidate } from '../../services/recognition/match'
import { readCover, warmUpOcr } from '../../services/recognition/ocr'
import { BarcodeScanner } from './BarcodeScanner'
import { EditionsList } from './EditionsList'
import { VinylDisc } from './RecordDetail'
import { emptyDraft, RecordForm, type Draft } from './RecordForm'

type Step = 'home' | 'analyzing' | 'albums' | 'editions' | 'confirm' | 'done' | 'barcode'

const STAGES = ['Lecture de la pochette', 'Recherche des albums', 'Comparaison des pochettes']

/** États simplifiés (échelle Goldmine en dessous). */
const QUICK_CONDITIONS: { value: Condition; label: string }[] = [
  { value: 'NM', label: 'Comme neuf' },
  { value: 'VG+', label: 'Très bon' },
  { value: 'VG', label: 'Bon' },
  { value: 'G', label: 'Usé' },
]

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

  const [step, setStep] = useState<Step>('home')
  const [query, setQuery] = useState('')
  const q = useDebounced(query.trim(), 550)
  const [results, setResults] = useState<DgSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string>()
  const [photo, setPhoto] = useState<Blob>()
  const [photoUrl, setPhotoUrl] = useState<string>()
  const [stage, setStage] = useState(0)
  const [albums, setAlbums] = useState<AlbumCandidate[]>([])
  const [album, setAlbum] = useState<{ artist: string; title: string; artwork?: string } | null>(null)
  const [draft, setDraft] = useState<Draft>(emptyDraft())
  const [loadingRelease, setLoadingRelease] = useState<number | null>(null)
  const [usePhotoCover, setUsePhotoCover] = useState(false)
  const [more, setMore] = useState(false)
  const [added, setAdded] = useState<string>()
  const runId = useRef(0)
  const searchId = useRef(0)

  useEffect(() => {
    warmUpOcr()
  }, [])
  useEffect(() => () => {
    if (photoUrl) URL.revokeObjectURL(photoUrl)
  }, [photoUrl])

  const runSearch = useCallback(async (params: { q?: string; artist?: string; title?: string; barcode?: string }) => {
    const id = ++searchId.current
    setSearching(true)
    setError(undefined)
    try {
      let res = await searchReleases(params)
      if (!res.results.length && params.artist && params.title) res = await searchReleases({ q: `${params.artist} ${params.title}` })
      if (id === searchId.current) setResults(res.results)
    } catch (e) {
      if (id === searchId.current) {
        setError(describeError(e))
        setResults([])
      }
    } finally {
      if (id === searchId.current) setSearching(false)
    }
  }, [])

  // Recherche en direct dès la saisie (accueil du parcours).
  useEffect(() => {
    if (step !== 'home') return
    if (q.length < 3) {
      setResults([])
      return
    }
    const digits = q.replace(/\s/g, '')
    void runSearch(/^\d{8,14}$/.test(digits) ? { barcode: digits } : { q })
  }, [q, step, runSearch])

  const analyze = async (file?: File) => {
    if (!file) return
    const id = ++runId.current
    setError(undefined)
    setStep('analyzing')
    setStage(0)
    try {
      const small = await compressImage(file, 1400, 0.88)
      if (id !== runId.current) return
      setPhoto(small)
      setPhotoUrl(URL.createObjectURL(small))

      // Code-barres visible sur la photo : identification directe de l'édition.
      try {
        const bmp = await createImageBitmap(small)
        const code = await detectBarcode(bmp)
        bmp.close()
        if (code) {
          setAlbum(null)
          setStep('editions')
          void runSearch({ barcode: code })
          return
        }
      } catch {
        /* pas de code-barres */
      }

      // Vision (clé de l'utilisateur), facultative.
      let hint: string | undefined
      if (settings.anthropicKey && privacy.sendPhotosToVision && settings.recognition !== 'ocr') {
        const vision = await import('../../services/recognition/vision')
        try {
          const v = await vision.identifyCover(small, settings.anthropicKey)
          if (v.artist && v.title) hint = `${v.artist} ${v.title}`
        } catch (e) {
          toast(vision.describeVisionError(e), 'warn')
        }
      }

      // Avec la vision, le texte identifié tient lieu de lecture ; sinon OCR embarqué.
      const ocr = hint ? { words: hint.split(' ').map((t) => ({ text: t, confidence: 99, size: 1 })), lines: [hint] } : await readCover(small)
      if (id !== runId.current) return
      setStage(1)
      const queries = queriesFrom(ocr, hint)
      setQuery(queries[0] ?? '')
      if (!queries.length) {
        setStep('home')
        toast(hint ? 'Album non identifié : tapez son nom.' : 'Pas de texte lisible sur cette pochette. Essayez le code-barres ou tapez le nom.', 'warn')
        return
      }
      const ranked = await rankAlbums(small, ocr, queries)
      if (id !== runId.current) return
      setStage(2)
      if (ranked.length) {
        setAlbums(ranked)
        setStep('albums')
      } else {
        // Lecture partielle : on affiche la recherche pré-remplie (résultats en direct, modifiables).
        setStep('home')
        toast('Lecture partielle de la pochette : vérifiez la recherche.', 'warn')
      }
    } catch (e) {
      if (id !== runId.current) return
      setError(e instanceof Error ? e.message : 'Analyse impossible')
      setStep('home')
    }
  }

  const onBarcode = useCallback(
    (code: string) => {
      setAlbum(null)
      setStep('editions')
      void runSearch({ barcode: code })
    },
    [runSearch],
  )

  const chooseAlbum = (a: AlbumCandidate) => {
    haptic()
    setAlbum({ artist: a.artist, title: a.title, artwork: a.artwork })
    setResults([])
    setStep('editions')
    void runSearch({ artist: a.artist, title: a.title })
  }

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
      if (d.coverUrl) {
        d.coverSource = 'discogs'
        d.coverChecked = true
      } else {
        const c = await bestCover(d)
        if (c) {
          d.coverUrl = c.url
          d.coverSource = c.source
          d.coverChecked = c.exact
        }
      }
      setDraft(d)
      setUsePhotoCover(false)
      setMore(false)
      setStep('confirm')
    } catch (e) {
      toast(describeError(e), 'error')
    } finally {
      setLoadingRelease(null)
    }
  }

  /** Ajout sans édition précise : on garde l'album et sa pochette. */
  const withoutEdition = () => {
    const d = emptyDraft()
    d.artist = album?.artist ?? ''
    d.title = album?.title ?? query
    d.coverUrl = album?.artwork
    d.coverSource = album?.artwork ? 'itunes' : undefined
    setDraft(d)
    setUsePhotoCover(!album?.artwork && !!photo)
    setMore(!d.artist)
    setStep('confirm')
  }

  const confirm = async () => {
    if (!draft.artist.trim() || !draft.title.trim()) {
      setMore(true)
      toast('Indiquez au moins l’artiste et le titre', 'warn')
      return
    }
    let photoKey: string | undefined
    if (usePhotoCover && photo) {
      photoKey = uid()
      try {
        await putPhoto(photoKey, photo)
      } catch {
        photoKey = undefined
      }
    }
    const rec = addRecord({ ...draft, photoKey, coverUrl: usePhotoCover ? undefined : draft.coverUrl, coverSource: usePhotoCover ? 'photo' : draft.coverSource })
    haptic(18)
    setAdded(rec.id)
    setStep('done')
    if (rec.discogsId && privacy.priceLookups) refreshRecordPrices(rec).catch(() => undefined)
  }

  const restart = () => {
    setDraft(emptyDraft())
    setPhoto(undefined)
    setPhotoUrl(undefined)
    setResults([])
    setAlbums([])
    setAlbum(null)
    setQuery('')
    setStep('home')
  }

  const owned = (id: number) => records.some((x) => x.discogsId === id)
  const duplicate = draft.discogsId ? owned(draft.discogsId) : false

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={step} className="flow" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={softSpring}>
        {step === 'home' && (
          <div className="form-stack">
            <div className="search glass-soft search-lg">
              <Icon name="search" size={19} />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Album, artiste, référence…"
                enterKeyHint="search"
                autoCorrect="off"
                aria-label="Rechercher un vinyle"
              />
              {searching && <span className="spinner" />}
              {query && !searching && (
                <button type="button" className="search-clear" onClick={() => setQuery('')} aria-label="Effacer">
                  <Icon name="close" size={14} />
                </button>
              )}
            </div>

            {query.trim().length >= 3 ? (
              <>
                {error && <div className="note note-error">{error}</div>}
                <EditionsList results={results} loading={searching} loadingId={loadingRelease} owned={owned} onPick={pick} />
                {!searching && q.length >= 3 && !results.length && !error && <p className="fine center">Aucune édition vinyle trouvée. Essayez d’autres mots.</p>}
              </>
            ) : (
              <>
                <label className="scan-cta">
                  <span className="scan-cta-icon">
                    <Icon name="camera" size={26} />
                  </span>
                  <span className="scan-cta-text">
                    <strong>Scanner une pochette</strong>
                    <span>Photographiez le recto, bien de face</span>
                  </span>
                  <input type="file" accept="image/*" capture="environment" onChange={(e) => analyze(e.target.files?.[0])} />
                </label>
                <div className="scan-alt">
                  <label className="scan-alt-btn">
                    <Icon name="image" size={19} />
                    <span>Photo</span>
                    <input type="file" accept="image/*" onChange={(e) => analyze(e.target.files?.[0])} />
                  </label>
                  <button type="button" className="scan-alt-btn" onClick={() => setStep('barcode')}>
                    <Icon name="barcode" size={19} />
                    <span>Code-barres</span>
                  </button>
                </div>
                <p className="fine center">Le code-barres au dos identifie l’édition exacte du premier coup.</p>
                {!settings.anthropicKey && <VisionKeyCard />}
              </>
            )}
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
                </li>
              ))}
            </ol>
            <Button variant="ghost" onClick={() => { runId.current++; setStep('home') }}>
              Annuler
            </Button>
          </div>
        )}

        {step === 'albums' && (
          <div className="form-stack">
            <BackLink onClick={() => setStep('home')} />
            <div className="albums-head">
              {photoUrl && <img src={photoUrl} alt="" className="guess-thumb" />}
              <div>
                <h2 className="display step-title">C’est lequel ?</h2>
                <p className="fine">Touchez votre album.</p>
              </div>
            </div>
            <div className="album-grid">
              {albums.map((a, i) => (
                <motion.button key={a.key} type="button" className={`album-card ${i === 0 ? 'is-best' : ''}`} onClick={() => chooseAlbum(a)} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: i * 0.04 }} whileTap={{ scale: 0.96 }}>
                  <CoverArt src={{ artist: a.artist, title: a.title, coverUrl: a.artwork }} eager />
                  <span className="record-title">{a.title}</span>
                  <span className="record-artist">
                    {a.artist}
                    {a.year ? ` · ${a.year}` : ''}
                  </span>
                  {i === 0 && <Badge tone="accent">Meilleure correspondance</Badge>}
                </motion.button>
              ))}
            </div>
            <Button variant="glass" icon="search" onClick={() => setStep('home')}>
              Aucun de ceux-là : chercher
            </Button>
          </div>
        )}

        {step === 'editions' && (
          <div className="form-stack">
            <BackLink onClick={() => setStep(albums.length ? 'albums' : 'home')} />
            {album ? (
              <div className="albums-head">
                <CoverArt src={{ artist: album.artist, title: album.title, coverUrl: album.artwork }} className="guess-thumb" />
                <div>
                  <h2 className="display step-title">{album.title}</h2>
                  <p className="fine">{album.artist} · choisissez votre édition</p>
                </div>
              </div>
            ) : (
              <h2 className="display step-title">Éditions trouvées</h2>
            )}
            {error && <div className="note note-error">{error}</div>}
            <EditionsList results={results} loading={searching} loadingId={loadingRelease} owned={owned} onPick={pick} />
            {!searching && !results.length && !error && <p className="fine center">Aucune édition vinyle référencée sur Discogs.</p>}
            <Button variant="ghost" onClick={withoutEdition}>
              Je ne sais pas : ajouter sans préciser l’édition
            </Button>
          </div>
        )}

        {step === 'barcode' && (
          <div className="form-stack">
            <BackLink onClick={() => setStep('home')} />
            <BarcodeScanner onCode={onBarcode} />
          </div>
        )}

        {step === 'confirm' && (
          <div className="form-stack">
            <BackLink onClick={() => setStep(results.length ? (album || albums.length ? 'editions' : 'home') : 'home')} />
            <div className="confirm-hero">
              <motion.div className="confirm-cover-lg" initial={{ rotate: -3, scale: 0.92 }} animate={{ rotate: 0, scale: 1 }} transition={spring}>
                <CoverArt src={{ artist: draft.artist || 'Artiste', title: draft.title || 'Titre', coverUrl: usePhotoCover ? photoUrl : draft.coverUrl }} eager />
              </motion.div>
              <h2 className="display confirm-title">{draft.title || 'Nouveau disque'}</h2>
              <p className="detail-artist">{draft.artist}</p>
              <p className="mono fine center">{[draft.year, draft.country, draft.label, draft.color].filter(Boolean).join(' · ') || 'Édition non précisée'}</p>
              {duplicate && <Badge tone="warn">Déjà dans votre collection</Badge>}
            </div>

            <div className="form-group">
              <div className="form-label">État du disque</div>
              <div className="chip-wrap">
                {QUICK_CONDITIONS.map((c) => (
                  <Chip key={c.value} active={draft.mediaCondition === c.value} onClick={() => setDraft({ ...draft, mediaCondition: draft.mediaCondition === c.value ? undefined : c.value })}>
                    {c.label}
                  </Chip>
                ))}
              </div>
            </div>
            <Field label="Prix payé (facultatif)">
              <input inputMode="decimal" value={draft.purchasePrice ?? ''} onChange={(e) => setDraft({ ...draft, purchasePrice: e.target.value.trim() ? Number(e.target.value.replace(',', '.')) : undefined })} placeholder="€" />
            </Field>

            {draft.artist && draft.title && <Previews artist={draft.artist} title={draft.title} compact />}

            <button type="button" className="more-toggle" onClick={() => setMore((m) => !m)}>
              <Icon name={more ? 'down' : 'chevron'} size={16} /> {more ? 'Moins de détails' : 'Plus de détails (facultatif)'}
            </button>
            {more && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="form-stack">
                <Field label="Artiste">
                  <input value={draft.artist} onChange={(e) => setDraft({ ...draft, artist: e.target.value })} />
                </Field>
                <Field label="Titre">
                  <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
                </Field>
                {photo && (
                  <label className="check-row">
                    <input type="checkbox" checked={usePhotoCover} onChange={(e) => setUsePhotoCover(e.target.checked)} />
                    <span>Utiliser ma photo comme pochette</span>
                  </label>
                )}
                <RecordForm draft={draft} onChange={setDraft} compact />
              </motion.div>
            )}

            <div className="sticky-cta">
              <Button variant="accent" size="lg" icon="plus" onClick={confirm} className="btn-block">
                Ajouter à ma collection
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
              <Button variant="glass" onClick={restart}>
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

/** Activation de la reconnaissance visuelle (clé Anthropic de l'utilisateur). */
function VisionKeyCard() {
  const setSettings = useApp((s) => s.setSettings)
  const toast = useApp((s) => s.toast)
  const [open, setOpen] = useState(false)
  const [key, setKey] = useState('')
  return (
    <div className="vision-card">
      <div className="vision-card-head">
        <Icon name="spark" size={18} />
        <strong>Reconnaissance visuelle</strong>
      </div>
      <p>
        Sans clé, l’app lit seulement le texte des pochettes. Pour reconnaître aussi les pochettes graphiques (sans texte), ajoutez une clé API Anthropic (≈ 0,5 centime par scan,
        stockée uniquement sur ce téléphone).
      </p>
      {open ? (
        <form
          className="search-form"
          onSubmit={(e) => {
            e.preventDefault()
            if (!key.trim().startsWith('sk-')) return toast('Clé invalide (elle commence par sk-ant-)', 'warn')
            setSettings({ anthropicKey: key.trim(), recognition: 'auto' })
            toast('Reconnaissance visuelle activée')
          }}
        >
          <div className="search glass-soft">
            <Icon name="key" size={17} />
            <input type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} placeholder="sk-ant-…" aria-label="Clé API Anthropic" />
          </div>
          <Button type="submit" variant="accent">
            OK
          </Button>
        </form>
      ) : (
        <div className="btn-row">
          <Button size="sm" variant="glass" icon="key" onClick={() => setOpen(true)}>
            J’ai une clé
          </Button>
          <a className="btn btn-ghost btn-sm" href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer">
            Obtenir une clé
          </a>
        </div>
      )}
    </div>
  )
}

function BackLink({ onClick, label = 'Retour' }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" className="back-link" onClick={onClick}>
      <Icon name="back" size={16} /> {label}
    </button>
  )
}

import { motion } from 'motion/react'
import { Icon } from '../../components/Icon'
import { Badge, Sheet, Skeleton, spring } from '../../components/ui'
import { deletePhoto, putPhoto } from '../../lib/db'
import { useAsync } from '../../lib/hooks'
import { compressImage } from '../../lib/image'
import { useApp } from '../../lib/store'
import type { VinylRecord } from '../../lib/types'
import { uid } from '../../lib/util'
import { coverCandidates, type CoverCandidate } from '../../services/covers'
import { describeError } from '../../services/http'

/** Choix de la pochette : édition exacte, album, ou photo de votre propre exemplaire. */
export function CoverPicker({ rec, open, onClose }: { rec: VinylRecord; open: boolean; onClose: () => void }) {
  const updateRecord = useApp((s) => s.updateRecord)
  const toast = useApp((s) => s.toast)
  const { loading, error, data, reload } = useAsync(() => (open && !rec.demo ? coverCandidates(rec) : Promise.resolve([] as CoverCandidate[])), [open, rec.id])

  const choose = async (c: CoverCandidate) => {
    if (rec.photoKey) await deletePhoto(rec.photoKey)
    updateRecord(rec.id, { coverUrl: c.url, coverSource: 'manual', coverChecked: true, photoKey: undefined })
    toast('Pochette mise à jour')
    onClose()
  }

  const usePhoto = async (file?: File) => {
    if (!file) return
    try {
      const blob = await compressImage(file, 1200, 0.85)
      const key = uid()
      await putPhoto(key, blob)
      if (rec.photoKey) await deletePhoto(rec.photoKey)
      updateRecord(rec.id, { photoKey: key, coverSource: 'photo', coverChecked: true })
      toast('Photo de votre exemplaire enregistrée')
      onClose()
    } catch {
      toast('Photo non enregistrée', 'error')
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Pochette" full>
      <div className="form-stack">
        <p className="fine">Les pochettes marquées « Édition exacte » correspondent à votre pressage précis. Vous pouvez aussi photographier votre propre exemplaire.</p>
        <div className="action-grid two">
          <label className="action-tile">
            <Icon name="camera" size={22} />
            <span className="action-title">Photographier</span>
            <span className="action-sub">Mon exemplaire</span>
            <input type="file" accept="image/*" capture="environment" onChange={(e) => usePhoto(e.target.files?.[0])} />
          </label>
          <label className="action-tile">
            <Icon name="image" size={22} />
            <span className="action-title">Photothèque</span>
            <span className="action-sub">Choisir une image</span>
            <input type="file" accept="image/*" onChange={(e) => usePhoto(e.target.files?.[0])} />
          </label>
        </div>

        {rec.demo ? (
          <p className="fine">Disque de démonstration fictif : aucune pochette en ligne.</p>
        ) : loading ? (
          <div className="cover-grid">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} h={0} className="skel-square" />
            ))}
          </div>
        ) : error ? (
          <p className="fine">
            {describeError(error)}
            <button type="button" className="link" onClick={reload}>
              Réessayer
            </button>
          </p>
        ) : !data?.length ? (
          <p className="fine">Aucune pochette trouvée en ligne pour ce disque. Photographiez votre exemplaire.</p>
        ) : (
          <div className="cover-grid">
            {data.map((c, i) => {
              const current = !rec.photoKey && rec.coverUrl === c.url
              return (
                <motion.button
                  key={c.url}
                  type="button"
                  className={`cover-option ${current ? 'is-current' : ''}`}
                  onClick={() => choose(c)}
                  initial={{ opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ ...spring, delay: i * 0.04 }}
                  whileTap={{ scale: 0.96 }}
                >
                  <span className="cover-option-img">
                    <img src={c.thumb} alt={c.label} loading="lazy" referrerPolicy="no-referrer" />
                    {current && (
                      <span className="cover-option-check">
                        <Icon name="check" size={14} weight={2.4} />
                      </span>
                    )}
                  </span>
                  <span className="cover-option-label">{c.label}</span>
                  {c.exact ? <Badge tone="accent">Édition exacte</Badge> : c.source === 'itunes' ? <Badge>Album (numérique)</Badge> : <Badge>Autre visuel</Badge>}
                </motion.button>
              )
            })}
          </div>
        )}
      </div>
    </Sheet>
  )
}

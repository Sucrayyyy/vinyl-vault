import { AnimatePresence, motion } from 'motion/react'
import { useEffect } from 'react'
import { usePlayer } from '../lib/player'
import { useApp } from '../lib/store'
import { Icon } from './Icon'
import { Equalizer } from './Previews'
import { spring } from './ui'

/** Mini-lecteur flottant en verre, au-dessus de la barre d'onglets. */
export function MiniPlayer() {
  const { track, playing, loading, progress, error, toggle, next, stop, queue } = usePlayer()
  const toast = useApp((s) => s.toast)
  useEffect(() => {
    if (error) toast(error, 'warn')
  }, [error, toast])
  useEffect(() => {
    document.body.classList.toggle('has-player', !!track)
  }, [track])
  const hasNext = !!track && queue.findIndex((q) => q.id === track.id) < queue.length - 1

  return (
    <AnimatePresence>
      {track && (
        <motion.div className="mini-player" initial={{ y: 40, opacity: 0, scale: 0.96 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 40, opacity: 0, scale: 0.96 }} transition={spring} role="region" aria-label="Lecteur d’extraits">
          <div className="mini-art">
            {track.artwork ? <img src={track.artwork} alt="" /> : <Icon name="disc" size={20} />}
          </div>
          <div className="mini-meta">
            <span className="mini-title">{track.title}</span>
            <span className="mini-sub">
              {track.artist} · <span className="mono">extrait</span>
            </span>
          </div>
          <Equalizer active={playing} />
          <button type="button" className="mini-btn" onClick={toggle} aria-label={playing ? 'Pause' : 'Lecture'}>
            {loading ? <span className="spinner" /> : <Icon name={playing ? 'pause' : 'play'} size={18} weight={2} />}
          </button>
          {hasNext && (
            <button type="button" className="mini-btn ghost" onClick={next} aria-label="Extrait suivant">
              <Icon name="next" size={18} />
            </button>
          )}
          <button type="button" className="mini-btn ghost" onClick={stop} aria-label="Fermer le lecteur">
            <Icon name="close" size={16} />
          </button>
          <span className="mini-progress" style={{ transform: `scaleX(${progress})` }} />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

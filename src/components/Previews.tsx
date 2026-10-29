import { motion } from 'motion/react'
import { useAsync } from '../lib/hooks'
import { usePlayer, type PlayerTrack } from '../lib/player'
import { findAlbumPreviews } from '../services/itunes'
import { describeError } from '../services/http'
import { Icon } from './Icon'
import { ExternalLink, Skeleton, spring } from './ui'

const mmss = (ms?: number) => (ms ? `${Math.floor(ms / 60000)}:${String(Math.round((ms % 60000) / 1000)).padStart(2, '0')}` : '')

/** Égaliseur animé (piste en cours de lecture). */
export function Equalizer({ active }: { active: boolean }) {
  return (
    <span className={`eq ${active ? 'is-on' : ''}`} aria-hidden>
      <i />
      <i />
      <i />
    </span>
  )
}

/** Liste des extraits d'un album, lus dans le mini-lecteur. */
export function Previews({ artist, title, demo }: { artist: string; title: string; demo?: boolean }) {
  const { loading, error, data, reload } = useAsync(() => (demo ? Promise.resolve(null) : findAlbumPreviews(artist, title)), [artist, title, demo])
  const current = usePlayer((s) => s.track)
  const playing = usePlayer((s) => s.playing)
  const busy = usePlayer((s) => s.loading)
  const play = usePlayer((s) => s.play)

  return (
    <section className="panel previews">
      <div className="panel-head">
        <div className="kicker">
          <Icon name="play" size={13} /> Écouter des extraits
        </div>
        {data && <span className="mono muted small">{data.tracks.length} extraits · 30 s</span>}
      </div>

      {demo ? (
        <p className="fine">Disque de démonstration fictif : aucun extrait disponible.</p>
      ) : loading ? (
        <div className="skeleton-list">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} h={40} r={12} />
          ))}
        </div>
      ) : error ? (
        <p className="fine">
          {describeError(error)}
          <button type="button" className="link" onClick={reload}>
            Réessayer
          </button>
        </p>
      ) : !data || data.tracks.length === 0 ? (
        <p className="fine">Aucun extrait trouvé pour cet album dans le catalogue Apple Music.</p>
      ) : (
        <>
          <ol className="preview-list">
            {data.tracks.map((t, i) => {
              const pt: PlayerTrack = { id: t.id, title: t.title, artist: t.artist, album: data.album, artwork: t.artwork ?? data.artwork, previewUrl: t.previewUrl }
              const isCur = current?.id === t.id
              const queue = data.tracks.map<PlayerTrack>((x) => ({ id: x.id, title: x.title, artist: x.artist, album: data.album, artwork: x.artwork ?? data.artwork, previewUrl: x.previewUrl }))
              return (
                <motion.li key={t.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: Math.min(i, 12) * 0.02 }}>
                  <button type="button" className={`preview-row ${isCur ? 'is-current' : ''}`} onClick={() => play(pt, queue)} aria-label={`${isCur && playing ? 'Pause' : 'Écouter'} : ${t.title}`}>
                    <span className="preview-btn">
                      {isCur && busy ? <span className="spinner" /> : <Icon name={isCur && playing ? 'pause' : 'play'} size={14} weight={2} />}
                    </span>
                    <span className="preview-num mono">{data.tracks.some((x) => x.disc > 1) ? `${t.disc}.${t.number}` : t.number}</span>
                    <span className="preview-title">{t.title}</span>
                    {isCur ? <Equalizer active={playing} /> : <span className="mono muted small">{mmss(t.durationMs)}</span>}
                  </button>
                </motion.li>
              )
            })}
          </ol>
          <p className="fine">
            Extraits de 30 s fournis par Apple Music, d’après l’édition numérique : l’ordre peut différer de votre pressage.{' '}
            {data.url && <ExternalLink href={data.url}>Album complet</ExternalLink>}
          </p>
        </>
      )}
    </section>
  )
}

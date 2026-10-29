// Lecteur d'extraits : un seul élément audio pour toute l'app.
import { create } from 'zustand'

export interface PlayerTrack {
  id: number
  title: string
  artist: string
  album: string
  artwork?: string
  previewUrl: string
}

interface PlayerState {
  track: PlayerTrack | null
  queue: PlayerTrack[]
  playing: boolean
  loading: boolean
  progress: number
  error?: string
  play: (t: PlayerTrack, queue?: PlayerTrack[]) => void
  toggle: () => void
  next: () => void
  stop: () => void
}

let audio: HTMLAudioElement | null = null

function el(): HTMLAudioElement {
  if (audio) return audio
  audio = new Audio()
  audio.preload = 'auto'
  audio.setAttribute('playsinline', 'true')
  audio.addEventListener('timeupdate', () => {
    const d = audio!.duration
    usePlayer.setState({ progress: d ? audio!.currentTime / d : 0 })
  })
  audio.addEventListener('playing', () => usePlayer.setState({ playing: true, loading: false, error: undefined }))
  audio.addEventListener('pause', () => usePlayer.setState({ playing: false }))
  audio.addEventListener('waiting', () => usePlayer.setState({ loading: true }))
  audio.addEventListener('ended', () => usePlayer.getState().next())
  audio.addEventListener('error', () => usePlayer.setState({ playing: false, loading: false, error: 'Extrait indisponible' }))
  return audio
}

function mediaSession(t: PlayerTrack) {
  if (!('mediaSession' in navigator)) return
  navigator.mediaSession.metadata = new MediaMetadata({
    title: t.title,
    artist: t.artist,
    album: `${t.album} · extrait`,
    artwork: t.artwork ? [{ src: t.artwork, sizes: '300x300', type: 'image/jpeg' }] : [],
  })
  navigator.mediaSession.setActionHandler('play', () => usePlayer.getState().toggle())
  navigator.mediaSession.setActionHandler('pause', () => usePlayer.getState().toggle())
  navigator.mediaSession.setActionHandler('nexttrack', () => usePlayer.getState().next())
}

export const usePlayer = create<PlayerState>()((set, get) => ({
  track: null,
  queue: [],
  playing: false,
  loading: false,
  progress: 0,

  // Appelé directement dans un geste utilisateur (exigence de Safari iOS).
  play(t, queue) {
    const a = el()
    const cur = get().track
    if (cur?.id === t.id) return get().toggle()
    set({ track: t, queue: queue ?? get().queue, loading: true, progress: 0, error: undefined })
    a.src = t.previewUrl
    a.play().catch(() => set({ playing: false, loading: false, error: 'Lecture bloquée par le navigateur' }))
    mediaSession(t)
  },
  toggle() {
    const a = el()
    if (!get().track) return
    if (a.paused) a.play().catch(() => undefined)
    else a.pause()
  },
  next() {
    const { queue, track } = get()
    const i = queue.findIndex((q) => q.id === track?.id)
    const n = i >= 0 ? queue[i + 1] : undefined
    if (n) get().play(n)
    else set({ playing: false, progress: 0 })
  },
  stop() {
    const a = el()
    a.pause()
    a.removeAttribute('src')
    a.load()
    set({ track: null, playing: false, loading: false, progress: 0 })
  },
}))

// Apple iTunes Search API : public, sans clé, CORS autorisé. Utilisée pour les pochettes HD.
import { cacheGet, cacheSet } from '../lib/db'
import { normalize } from '../lib/util'
import { getJSON, queued } from './http'

interface ItunesAlbum {
  artistName: string
  collectionName: string
  artworkUrl100?: string
  releaseDate?: string
  primaryGenreName?: string
  collectionViewUrl?: string
  collectionId: number
}

export function hiRes(url: string, size = 600) {
  return url.replace(/\/\d+x\d+bb\./, `/${size}x${size}bb.`)
}

export async function searchAlbums(term: string, limit = 12): Promise<ItunesAlbum[]> {
  const url = `https://itunes.apple.com/search?media=music&entity=album&country=FR&limit=${limit}&term=${encodeURIComponent(term)}`
  const data = await queued('itunes', 400, () => getJSON<{ results: ItunesAlbum[] }>(url))
  return data.results ?? []
}

/** Trouve la pochette la plus probable pour un couple artiste/titre (avec cache 30 j). */
export async function findArtwork(artist: string, title: string): Promise<string | undefined> {
  const key = `art:${normalize(artist)}|${normalize(title)}`
  const cached = await cacheGet<string | null>(key)
  if (cached !== undefined) return cached ?? undefined
  try {
    const results = await searchAlbums(`${artist} ${title}`, 8)
    const na = normalize(artist)
    const nt = normalize(title)
    const best =
      results.find((r) => normalize(r.artistName) === na && normalize(r.collectionName).startsWith(nt)) ??
      results.find((r) => normalize(r.artistName).includes(na) && normalize(r.collectionName).includes(nt))
    const url = best?.artworkUrl100 ? hiRes(best.artworkUrl100) : undefined
    await cacheSet(key, url ?? null, 30 * 86400000)
    return url
  } catch {
    return undefined
  }
}

export interface PreviewTrack {
  id: number
  title: string
  artist: string
  disc: number
  number: number
  durationMs?: number
  previewUrl: string
  artwork?: string
}

export interface AlbumPreviews {
  album: string
  artist: string
  url?: string
  artwork?: string
  tracks: PreviewTrack[]
}

interface ItunesTrack {
  wrapperType: string
  trackId: number
  trackName: string
  artistName: string
  discNumber?: number
  trackNumber?: number
  trackTimeMillis?: number
  previewUrl?: string
  artworkUrl100?: string
}

/**
 * Extraits audio (30 s) fournis par Apple pour l'album correspondant.
 * Renvoie null si l'album n'est pas trouvé dans le catalogue Apple Music.
 */
export async function findAlbumPreviews(artist: string, title: string): Promise<AlbumPreviews | null> {
  const key = `previews:${normalize(artist)}|${normalize(title)}`
  const cached = await cacheGet<AlbumPreviews | null>(key)
  if (cached !== undefined) return cached

  const results = await searchAlbums(`${artist} ${title}`, 10)
  const na = normalize(artist)
  const nt = normalize(title)
  const album =
    results.find((r) => normalize(r.artistName) === na && normalize(r.collectionName) === nt) ??
    results.find((r) => normalize(r.artistName) === na && normalize(r.collectionName).startsWith(nt)) ??
    results.find((r) => normalize(r.artistName).includes(na) && normalize(r.collectionName).includes(nt))
  if (!album) {
    await cacheSet(key, null, 3 * 86400000)
    return null
  }
  const url = `https://itunes.apple.com/lookup?id=${album.collectionId}&entity=song&country=FR&limit=200`
  const data = await queued('itunes', 400, () => getJSON<{ results: ItunesTrack[] }>(url))
  const tracks = (data.results ?? [])
    .filter((t) => t.wrapperType === 'track' && t.previewUrl)
    .map<PreviewTrack>((t) => ({
      id: t.trackId,
      title: t.trackName,
      artist: t.artistName,
      disc: t.discNumber ?? 1,
      number: t.trackNumber ?? 0,
      durationMs: t.trackTimeMillis,
      previewUrl: t.previewUrl!,
      artwork: t.artworkUrl100 ? hiRes(t.artworkUrl100, 300) : undefined,
    }))
    .sort((a, b) => a.disc - b.disc || a.number - b.number)
  const out: AlbumPreviews = {
    album: album.collectionName,
    artist: album.artistName,
    url: album.collectionViewUrl,
    artwork: album.artworkUrl100 ? hiRes(album.artworkUrl100, 300) : undefined,
    tracks,
  }
  // Les URL d'extraits sont stables quelques jours : cache 3 jours.
  await cacheSet(key, out, 3 * 86400000)
  return out
}

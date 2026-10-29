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

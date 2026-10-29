// Résolution de la pochette d'un disque, de la source la plus exacte à la plus générique :
// 1. Discogs (images de l'édition précise)
// 2. Cover Art Archive pour l'édition MusicBrainz liée à la fiche Discogs (édition précise)
// 3. Cover Art Archive pour l'édition trouvée par code-barres (édition précise)
// 4. Apple Music, uniquement si l'artiste ET le titre correspondent exactement (pochette de l'album)
import { cacheGet, cacheSet } from '../lib/db'
import type { VinylRecord } from '../lib/types'
import { getRelease } from './discogs'
import { getJSON, queued, withRetry } from './http'
import { findArtwork } from './itunes'

export type CoverSource = 'discogs' | 'caa' | 'itunes' | 'photo' | 'manual'

export interface CoverCandidate {
  url: string
  thumb: string
  source: CoverSource
  label: string
  exact: boolean
}

type Rec = Pick<VinylRecord, 'artist' | 'title' | 'discogsId' | 'barcode'>

const https = (u: string) => u.replace(/^http:\/\//, 'https://')

async function mb<T>(path: string): Promise<T> {
  const url = `https://musicbrainz.org/ws/2${path}${path.includes('?') ? '&' : '?'}fmt=json`
  const hit = await cacheGet<T>(`mb:${url}`)
  if (hit !== undefined) return hit
  const data = await withRetry(() => queued('mb', 1100, () => getJSON<T>(url)), 2500)
  await cacheSet(`mb:${url}`, data, 14 * 86400000)
  return data
}

/** Identifiant MusicBrainz de l'édition liée à une fiche Discogs. */
async function mbidFromDiscogs(discogsId: number): Promise<string | undefined> {
  try {
    const d = await mb<{ relations?: { release?: { id: string } }[] }>(
      `/url?resource=${encodeURIComponent(`https://www.discogs.com/release/${discogsId}`)}&inc=release-rels`,
    )
    return d.relations?.find((r) => r.release)?.release?.id
  } catch {
    return undefined
  }
}

async function mbidFromBarcode(barcode: string): Promise<string | undefined> {
  try {
    const d = await mb<{ releases?: { id: string; score: number }[] }>(`/release?query=barcode:${encodeURIComponent(barcode)}&limit=3`)
    return d.releases?.find((r) => r.score >= 90)?.id
  } catch {
    return undefined
  }
}

async function caaImages(mbid: string, label: string): Promise<CoverCandidate[]> {
  const key = `caa:${mbid}`
  const hit = await cacheGet<CoverCandidate[]>(key)
  if (hit) return hit
  try {
    const d = await getJSON<{ images: { front: boolean; image: string; thumbnails: Record<string, string> }[] }>(`https://coverartarchive.org/release/${mbid}`)
    const out = d.images
      .sort((a, b) => Number(b.front) - Number(a.front))
      .slice(0, 4)
      .map<CoverCandidate>((i) => ({
        url: https(i.thumbnails['1200'] ?? i.thumbnails.large ?? i.image),
        thumb: https(i.thumbnails['250'] ?? i.thumbnails.small ?? i.image),
        source: 'caa',
        label: i.front ? label : `${label} · verso, rond central…`,
        exact: i.front,
      }))
    await cacheSet(key, out, 14 * 86400000)
    return out
  } catch {
    await cacheSet(key, [], 2 * 86400000)
    return []
  }
}

/** Toutes les pochettes candidates, les plus fiables d'abord. */
export async function coverCandidates(rec: Rec): Promise<CoverCandidate[]> {
  const out: CoverCandidate[] = []
  if (rec.discogsId) {
    try {
      const r = await getRelease(rec.discogsId)
      for (const img of r.images ?? []) {
        out.push({ url: img.uri, thumb: img.uri150, source: 'discogs', label: img.type === 'primary' ? 'Discogs · cette édition' : 'Discogs · autre visuel', exact: img.type === 'primary' })
      }
    } catch {
      /* on continue avec les autres sources */
    }
  }
  if (rec.discogsId) {
    const id = await mbidFromDiscogs(rec.discogsId)
    if (id) out.push(...(await caaImages(id, 'Cover Art Archive · cette édition')))
  }
  if (rec.barcode && !out.some((c) => c.source === 'caa')) {
    const id = await mbidFromBarcode(rec.barcode)
    if (id) out.push(...(await caaImages(id, 'Cover Art Archive · code-barres')))
  }
  const apple = await findArtwork(rec.artist, rec.title)
  if (apple) out.push({ url: apple, thumb: apple.replace(/\/\d+x\d+bb\./, '/300x300bb.'), source: 'itunes', label: 'Apple Music · album', exact: false })
  const seen = new Set<string>()
  return out.filter((c) => !seen.has(c.url) && seen.add(c.url))
}

/** Meilleure pochette disponible (la première candidate exacte, sinon l'album). */
export async function bestCover(rec: Rec): Promise<CoverCandidate | undefined> {
  const all = await coverCandidates(rec)
  return all.find((c) => c.exact) ?? all[0]
}

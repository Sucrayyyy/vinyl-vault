// MusicBrainz — base musicale ouverte, sans clé, CORS autorisé (1 requête/s).
// Utilisée pour les sorties datées (futures sorties, rééditions) des artistes et labels suivis.
import { getJSON, queued, withRetry } from './http'
import { cacheGet, cacheSet } from '../lib/db'

const API = 'https://musicbrainz.org/ws/2'

function mb<T>(path: string, params: Record<string, string>, ttl = 6 * 3600000): Promise<T> {
  const qs = new URLSearchParams({ ...params, fmt: 'json' })
  const url = `${API}${path}?${qs}`
  return (async () => {
    const hit = await cacheGet<T>(`mb:${url}`)
    if (hit !== undefined) return hit
    const data = await withRetry(() => queued('mb', 1100, () => getJSON<T>(url, { headers: { Accept: 'application/json' } })), 2500)
    await cacheSet(`mb:${url}`, data, ttl)
    return data
  })()
}

export interface MbRelease {
  id: string
  title: string
  date?: string
  country?: string
  status?: string
  disambiguation?: string
  'artist-credit'?: { name: string; artist: { id: string; name: string } }[]
  'release-group'?: { id: string; 'primary-type'?: string; title: string }
  'label-info'?: { 'catalog-number'?: string; label?: { name: string } }[]
  media?: { format?: string; 'disc-count'?: number; 'track-count'?: number }[]
  barcode?: string
}

export interface FeedRelease {
  id: string
  artist: string
  title: string
  date: string
  country?: string
  label?: string
  catno?: string
  format: string
  releaseGroupId?: string
  firstReleaseDate?: string
  kind: 'new' | 'reissue'
  limited: boolean
  barcode?: string
  url: string
  coverUrl: string
}

const esc = (s: string) => s.replace(/(["\\])/g, '\\$1')
const iso = (d: Date) => d.toISOString().slice(0, 10)

/**
 * Sorties vinyles datées dans une fenêtre, filtrées par artistes/labels suivis
 * ou par tags de genre. Les rééditions sont identifiées en comparant la date de
 * sortie à la première sortie du groupe (release-group).
 */
export async function datedVinylReleases(opts: {
  artists?: string[]
  labels?: string[]
  tags?: string[]
  fromDays?: number
  toDays?: number
  limit?: number
}): Promise<FeedRelease[]> {
  const now = new Date()
  const from = new Date(now.getTime() + (opts.fromDays ?? 0) * 86400000)
  const to = new Date(now.getTime() + (opts.toDays ?? 180) * 86400000)
  const scope: string[] = []
  if (opts.artists?.length) scope.push(...opts.artists.slice(0, 12).map((a) => `artist:"${esc(a)}"`))
  if (opts.labels?.length) scope.push(...opts.labels.slice(0, 8).map((l) => `label:"${esc(l)}"`))
  if (opts.tags?.length) scope.push(...opts.tags.slice(0, 6).map((t) => `tag:"${esc(t.toLowerCase())}"`))
  const query = [`date:[${iso(from)} TO ${iso(to)}]`, 'format:*vinyl*', 'status:official', scope.length ? `(${scope.join(' OR ')})` : '']
    .filter(Boolean)
    .join(' AND ')
  const data = await mb<{ releases: MbRelease[] }>('/release', { query, limit: String(opts.limit ?? 60) })
  const rels = (data.releases ?? []).filter((r) => r.date && r.date.length >= 7)

  // Première date de chaque release-group, en une requête groupée.
  const rgIds = [...new Set(rels.map((r) => r['release-group']?.id).filter(Boolean))] as string[]
  const firsts = new Map<string, string>()
  for (let i = 0; i < rgIds.length; i += 25) {
    const chunk = rgIds.slice(i, i + 25)
    try {
      const rg = await mb<{ 'release-groups': { id: string; 'first-release-date'?: string }[] }>('/release-group', {
        query: chunk.map((id) => `rgid:${id}`).join(' OR '),
        limit: '25',
      })
      for (const g of rg['release-groups'] ?? []) if (g['first-release-date']) firsts.set(g.id, g['first-release-date'])
    } catch {
      /* la qualification réédition est facultative */
    }
  }

  const seen = new Set<string>()
  const out: FeedRelease[] = []
  for (const r of rels) {
    const artist = r['artist-credit']?.map((c) => c.name).join(', ') ?? 'Artiste inconnu'
    const key = `${artist}|${r.title}|${r.date}`.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    const rg = r['release-group']?.id
    const first = rg ? firsts.get(rg) : undefined
    const kind: FeedRelease['kind'] = first && r.date && first.slice(0, 4) < r.date.slice(0, 4) ? 'reissue' : 'new'
    const fmt = r.media?.map((m) => m.format).filter(Boolean).join(' + ') || 'Vinyl'
    out.push({
      id: r.id,
      artist,
      title: r.title,
      date: r.date!,
      country: r.country,
      label: r['label-info']?.[0]?.label?.name,
      catno: r['label-info']?.[0]?.['catalog-number'],
      format: fmt,
      releaseGroupId: rg,
      firstReleaseDate: first,
      kind,
      limited: /limited|numbered|exclusive|edition/i.test(r.disambiguation ?? ''),
      barcode: r.barcode || undefined,
      url: `https://musicbrainz.org/release/${r.id}`,
      coverUrl: `https://coverartarchive.org/release/${r.id}/front-250`,
    })
  }
  return out.sort((a, b) => a.date.localeCompare(b.date))
}

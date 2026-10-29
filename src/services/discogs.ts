// Connecteur Discogs — https://www.discogs.com/developers
// Sans jeton : recherche, fiches, versions et statistiques marketplace (25 req/min, sans images).
// Avec un jeton personnel (saisi par l'utilisateur, stocké sur l'appareil) : images,
// 60 req/min et suggestions de prix par état.
import { cacheGet, cacheSet } from '../lib/db'
import { useApp } from '../lib/store'
import type { Condition, Pressing, Track, VinylRecord } from '../lib/types'
import { DISCOGS_CONDITION } from '../lib/types'
import { getJSON, windowed, withRetry } from './http'

const API = 'https://api.discogs.com'

function token() {
  return useApp.getState().settings.discogsToken?.trim() || undefined
}

function call<T>(path: string, params: Record<string, string | number | undefined> = {}, ttl = 0): Promise<T> {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') qs.set(k, String(v))
  const url = `${API}${path}${qs.size ? `?${qs}` : ''}`
  const tk = token()
  const exec = async () => {
    if (ttl) {
      const hit = await cacheGet<T>(`dg:${tk ? 'a' : 'p'}:${url}`)
      if (hit !== undefined) return hit
    }
    const data = await withRetry(() =>
      // Quotas Discogs : 25 requêtes/min sans jeton, 60 avec (marge de sécurité incluse).
      windowed('discogs', tk ? 55 : 23, 60000, () =>
        getJSON<T>(url, tk ? { headers: { Authorization: `Discogs token=${tk}` } } : {}),
      ),
    )
    if (ttl) await cacheSet(`dg:${tk ? 'a' : 'p'}:${url}`, data, ttl)
    return data
  }
  return exec()
}

export const hasDiscogsToken = () => !!token()

export interface DgSearchResult {
  id: number
  type: 'release' | 'master' | 'artist' | 'label'
  title: string
  year?: string
  country?: string
  format?: string[]
  label?: string[]
  catno?: string
  barcode?: string[]
  genre?: string[]
  style?: string[]
  thumb?: string
  cover_image?: string
  master_id?: number
  uri?: string
  formats?: { name: string; qty: string; text?: string; descriptions?: string[] }[]
  community?: { have: number; want: number }
}

interface Paged<T> {
  pagination: { page: number; pages: number; items: number }
  results: T[]
}

export function splitTitle(t: string): { artist: string; title: string } {
  const i = t.indexOf(' - ')
  if (i < 0) return { artist: '', title: t }
  return { artist: cleanName(t.slice(0, i)), title: t.slice(i + 3) }
}

/** Discogs suffixe les homonymes par « (2) », « (3) »… */
export const cleanName = (n: string) => n.replace(/\s\(\d+\)$/, '').replace(/\*$/, '')

export async function searchReleases(
  q: { q?: string; artist?: string; title?: string; barcode?: string; catno?: string },
  page = 1,
): Promise<Paged<DgSearchResult>> {
  return call<Paged<DgSearchResult>>(
    '/database/search',
    {
      type: 'release',
      format: 'Vinyl',
      q: q.q,
      artist: q.artist,
      release_title: q.title,
      barcode: q.barcode,
      catno: q.catno,
      per_page: 25,
      page,
    },
    6 * 3600000,
  )
}

export async function searchMasters(params: { style?: string; genre?: string; q?: string; year?: string }, page = 1) {
  return call<Paged<DgSearchResult>>(
    '/database/search',
    { type: 'master', format: 'Vinyl', ...params, per_page: 30, page },
    24 * 3600000,
  )
}

export interface DgRelease {
  id: number
  title: string
  year?: number
  released?: string
  country?: string
  master_id?: number
  uri: string
  artists: { name: string; id: number }[]
  labels: { name: string; catno: string }[]
  formats: { name: string; qty: string; text?: string; descriptions?: string[] }[]
  identifiers?: { type: string; value: string }[]
  genres?: string[]
  styles?: string[]
  tracklist?: { position: string; title: string; duration?: string; type_?: string }[]
  images?: { type: string; uri: string; uri150: string }[]
  lowest_price?: number | null
  num_for_sale?: number
  community?: { have: number; want: number }
  notes?: string
}

export const getRelease = (id: number) => call<DgRelease>(`/releases/${id}`, { curr_abbr: 'EUR' }, 24 * 3600000)

export interface DgMaster {
  id: number
  title: string
  year: number
  main_release: number
  lowest_price?: number | null
  num_for_sale?: number
  artists: { name: string; id: number }[]
  images?: { uri: string }[]
  genres?: string[]
  styles?: string[]
}
export const getMaster = (id: number) => call<DgMaster>(`/masters/${id}`, {}, 24 * 3600000)

export interface DgVersion {
  id: number
  title: string
  format: string
  label: string
  catno: string
  country: string
  released: string
  thumb?: string
  major_formats?: string[]
  stats?: { community?: { in_collection: number; in_wantlist: number } }
}
export function getMasterVersions(masterId: number, page = 1) {
  return call<{ pagination: Paged<unknown>['pagination']; versions: DgVersion[] }>(
    `/masters/${masterId}/versions`,
    { format: 'Vinyl', per_page: 50, page, sort: 'released', sort_order: 'asc' },
    24 * 3600000,
  )
}

export interface DgArtistRelease {
  id: number
  type: 'master' | 'release'
  title: string
  year?: number
  role: string
  main_release?: number
  thumb?: string
  artist: string
  format?: string
  stats?: { community?: { in_collection: number; in_wantlist: number } }
}
export function getArtistReleases(artistId: number) {
  return call<{ releases: DgArtistRelease[] }>(
    `/artists/${artistId}/releases`,
    { sort: 'year', sort_order: 'asc', per_page: 100 },
    3 * 86400000,
  )
}

export interface MarketStats {
  lowest?: number
  currency: string
  numForSale: number
  blocked: boolean
}
export async function getMarketStats(releaseId: number, fresh = false): Promise<MarketStats> {
  const d = await call<{ num_for_sale: number; lowest_price: { value: number; currency: string } | null; blocked_from_sale: boolean }>(
    `/marketplace/stats/${releaseId}`,
    { curr_abbr: 'EUR' },
    fresh ? 0 : 3 * 3600000,
  )
  return {
    lowest: d.lowest_price?.value,
    currency: d.lowest_price?.currency ?? 'EUR',
    numForSale: d.num_for_sale ?? 0,
    blocked: d.blocked_from_sale,
  }
}

/** Nécessite un jeton et des paramètres vendeur renseignés sur Discogs. */
export async function getPriceSuggestions(releaseId: number): Promise<Partial<Record<Condition, { value: number; currency: string }>>> {
  if (!token()) return {}
  const d = await call<Record<string, { value: number; currency: string }>>(`/marketplace/price_suggestions/${releaseId}`, {}, 0)
  const out: Partial<Record<Condition, { value: number; currency: string }>> = {}
  for (const [c, label] of Object.entries(DISCOGS_CONDITION) as [Condition, string][]) {
    if (d[label]) out[c] = d[label]
  }
  return out
}

export const releaseUrl = (id: number) => `https://www.discogs.com/release/${id}`
export const masterUrl = (id: number) => `https://www.discogs.com/master/${id}`
export const sellUrl = (id: number) => `https://www.discogs.com/sell/release/${id}?currency=EUR`
export const historyUrl = (id: number) => `https://www.discogs.com/sell/history/${id}`

const COLOR_WORDS =
  /(black|white|clear|red|blue|green|yellow|orange|pink|purple|gold|silver|grey|gray|transparent|translucent|marbled|splatter|swirl|smoke|opaque|picture disc|bone|cream|violet|teal|coke bottle)/i

export function describeFormat(formats: DgRelease['formats'] | DgSearchResult['formats'] = []) {
  const vinyl = formats.find((f) => f.name === 'Vinyl') ?? formats[0]
  const descriptions = formats.flatMap((f) => f.descriptions ?? [])
  const text = formats.map((f) => f.text).filter(Boolean).join(', ')
  const color = text && COLOR_WORDS.test(text) ? text : undefined
  const discs = vinyl ? parseInt(vinyl.qty, 10) || 1 : undefined
  const reissue = descriptions.some((d) => /reissue|repress|remastered/i.test(d))
  const limited = descriptions.some((d) => /limited|numbered/i.test(d)) || /limited|numbered|\d+\s*copies/i.test(text)
  return { color, discs, descriptions, text, reissue, limited }
}

/** Convertit une fiche Discogs en brouillon de disque (sans prix ni état). */
export function releaseToDraft(r: DgRelease, masterYear?: number): Omit<VinylRecord, 'id' | 'createdAt' | 'updatedAt'> {
  const f = describeFormat(r.formats)
  let pressing: Pressing = 'unknown'
  if (f.reissue) pressing = 'reissue'
  else if (masterYear && r.year) pressing = r.year > masterYear ? 'reissue' : 'original'
  const barcode = r.identifiers?.find((i) => i.type === 'Barcode')?.value?.replace(/\s/g, '')
  const tracklist: Track[] | undefined = r.tracklist
    ?.filter((t) => !t.type_ || t.type_ === 'track')
    .map((t) => ({ position: t.position, title: t.title, duration: t.duration || undefined }))
  return {
    artist: r.artists?.map((a) => cleanName(a.name)).join(', ') || 'Artiste inconnu',
    title: r.title,
    year: r.year || undefined,
    label: r.labels?.[0]?.name ? cleanName(r.labels[0].name) : undefined,
    catno: r.labels?.[0]?.catno,
    barcode,
    country: r.country,
    pressing,
    color: f.color,
    discs: f.discs,
    formatText: [...(r.formats?.map((x) => [x.qty !== '1' ? `${x.qty}×` : '', x.name].join('')) ?? []), ...f.descriptions].join(', '),
    genres: r.genres ?? [],
    styles: r.styles ?? [],
    coverUrl: r.images?.find((i) => i.type === 'primary')?.uri ?? r.images?.[0]?.uri,
    discogsId: r.id,
    masterId: r.master_id,
    discogsArtistId: r.artists?.[0]?.id,
    tracklist,
  }
}

/**
 * Pochettes des éditions d'une liste de résultats, sans jeton :
 * 1. vignettes des versions de chaque album (une requête par album, couvre la plupart des éditions) ;
 * 2. pour les éditions restantes, la fiche de l'édition (une requête chacune, à la demande).
 */
export async function versionThumbs(masterIds: number[]): Promise<Map<number, string>> {
  const out = new Map<number, string>()
  for (const id of [...new Set(masterIds)].slice(0, 6)) {
    try {
      const v = await call<{ versions: DgVersion[] }>(`/masters/${id}/versions`, { per_page: 100, format: 'Vinyl' }, 24 * 3600000)
      for (const x of v.versions) if (x.thumb) out.set(x.id, x.thumb)
    } catch {
      /* on passera par la fiche de l'édition */
    }
  }
  return out
}

export async function releaseCover(id: number): Promise<string | undefined> {
  const r = await getRelease(id)
  const img = r.images?.find((i) => i.type === 'primary') ?? r.images?.[0]
  return img?.uri150 || img?.uri
}

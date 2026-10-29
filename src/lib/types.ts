// Modèle de données Vinyl Vault. Toutes les entités sont sérialisables en JSON
// pour pouvoir être synchronisées telles quelles vers un backend.

/** Échelle Goldmine utilisée par Discogs. */
export const CONDITIONS = ['M', 'NM', 'VG+', 'VG', 'G+', 'G', 'F', 'P'] as const
export type Condition = (typeof CONDITIONS)[number]

export const CONDITION_LABELS: Record<Condition, string> = {
  M: 'Mint',
  NM: 'Near Mint',
  'VG+': 'Very Good Plus',
  VG: 'Very Good',
  'G+': 'Good Plus',
  G: 'Good',
  F: 'Fair',
  P: 'Poor',
}

/** Correspondance avec les libellés attendus par l'API Discogs. */
export const DISCOGS_CONDITION: Record<Condition, string> = {
  M: 'Mint (M)',
  NM: 'Near Mint (NM or M-)',
  'VG+': 'Very Good Plus (VG+)',
  VG: 'Very Good (VG)',
  'G+': 'Good Plus (G+)',
  G: 'Good (G)',
  F: 'Fair (F)',
  P: 'Poor (P)',
}

export type Pressing = 'original' | 'reissue' | 'unknown'

export interface Track {
  position: string
  title: string
  duration?: string
}

export interface VinylRecord {
  id: string
  createdAt: number
  updatedAt: number
  artist: string
  title: string
  year?: number
  label?: string
  catno?: string
  barcode?: string
  country?: string
  pressing: Pressing
  color?: string
  discs?: number
  formatText?: string
  genres: string[]
  styles: string[]
  mediaCondition?: Condition
  sleeveCondition?: Condition
  purchasePrice?: number
  purchaseDate?: string
  purchasePlace?: string
  notes?: string
  shelf?: string
  favorite?: boolean
  /** URL d'une pochette distante (Discogs, Apple, CAA). */
  coverUrl?: string
  /** Clé IndexedDB d'une photo prise par l'utilisateur. */
  photoKey?: string
  /** Origine de la pochette : discogs, caa (Cover Art Archive), itunes, photo, manual. */
  coverSource?: string
  /** Résolution automatique de la pochette déjà tentée. */
  coverChecked?: boolean
  /** Graine pour une pochette générée (données de démo). */
  coverSeed?: number
  discogsId?: number
  masterId?: number
  discogsArtistId?: number
  tracklist?: Track[]
  /** Données fictives de démonstration. */
  demo?: boolean
}

export type PriceKind =
  /** Prix le plus bas actuellement affiché (annonces) */
  | 'asking-low'
  /** Prix affiché d'une annonce précise */
  | 'asking'
  /** Prix réellement payé lors d'une vente */
  | 'sold'
  /** Suggestion de prix d'une source (ex. Discogs, par état) */
  | 'suggested'
  /** Estimation saisie par l'utilisateur */
  | 'manual'

export type SourceId = 'discogs' | 'ebay' | 'leboncoin' | 'manual' | 'demo'

export interface PriceObservation {
  id: string
  recordId: string
  at: number
  kind: PriceKind
  source: SourceId
  value: number
  currency: string
  condition?: Condition
  url?: string
  /** Nombre d'annonces concernées (pour asking-low). */
  count?: number
  note?: string
  demo?: boolean
}

export type WishStatus = 'upcoming' | 'preorder' | 'available' | 'unavailable' | 'unknown'

export interface WishItem {
  id: string
  createdAt: number
  artist: string
  title: string
  edition?: string
  year?: number
  coverUrl?: string
  coverSeed?: number
  targetPrice?: number
  releaseDate?: string
  status: WishStatus
  alert: boolean
  discogsId?: number
  masterId?: number
  mbReleaseId?: string
  /** Dernier prix bas observé sur Discogs. */
  lastSeen?: { value: number; currency: string; count: number; at: number }
  reason?: string
  demo?: boolean
}

export interface AppAlert {
  id: string
  at: number
  title: string
  body: string
  kind: 'price' | 'release' | 'info'
  read: boolean
  url?: string
  wishId?: string
  /** Clé de déduplication (évite les alertes répétées). */
  key: string
}

export interface Follow {
  kind: 'artist' | 'label'
  name: string
  mbid?: string
}

export interface Profile {
  displayName: string
  genres: string[]
  favoriteArtists: string[]
  follows: Follow[]
  notifications: {
    priceDrops: boolean
    releases: boolean
    systemNotifications: boolean
  }
  privacy: {
    hideValues: boolean
    sendPhotosToVision: boolean
    priceLookups: boolean
  }
}

export interface Settings {
  discogsToken?: string
  anthropicKey?: string
  recognition: 'auto' | 'ocr' | 'vision'
  motion: 'system' | 'reduced' | 'full'
  theme: 'system' | 'light' | 'dark'
  onboarded: boolean
  lastAlertCheck?: number
}

export type SortKey = 'added' | 'artist' | 'title' | 'year' | 'value'

export interface PersistedState {
  version: 1
  records: VinylRecord[]
  prices: PriceObservation[]
  wishlist: WishItem[]
  alerts: AppAlert[]
  profile: Profile
  settings: Settings
}

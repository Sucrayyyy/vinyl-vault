// Données de DÉMONSTRATION — entièrement fictives (artistes, labels, prix).
// Chaque entité porte `demo: true` et est signalée comme telle dans l'interface.
import type { Condition, PriceObservation, VinylRecord, WishItem } from './types'
import { uid } from './util'

interface DemoSeed {
  artist: string
  title: string
  year: number
  label: string
  catno: string
  country: string
  pressing: 'original' | 'reissue'
  color?: string
  discs?: number
  genres: string[]
  styles: string[]
  media: Condition
  sleeve: Condition
  paid: number
  /** Valeurs fictives successives (du plus ancien au plus récent). */
  values: number[]
  kind: 'sold' | 'asking-low'
  addedDaysAgo: number
  favorite?: boolean
}

const SEEDS: DemoSeed[] = [
  { artist: 'Nadia Okoro', title: 'Glass Hours', year: 1979, label: 'Meridian Soul', catno: 'MS-1102', country: 'US', pressing: 'original', genres: ['Funk / Soul'], styles: ['Soul', 'Jazz-Funk'], media: 'VG+', sleeve: 'VG', paid: 42, values: [58, 61, 64, 66], kind: 'sold', addedDaysAgo: 340, favorite: true },
  { artist: 'The Velvet Static', title: 'Low Signal', year: 1994, label: 'Fieldnote', catno: 'FN 027', country: 'UK', pressing: 'original', genres: ['Rock'], styles: ['Shoegaze', 'Dream Pop'], media: 'NM', sleeve: 'VG+', paid: 85, values: [110, 118, 126, 131], kind: 'sold', addedDaysAgo: 320 },
  { artist: 'Kōji Haru', title: 'Midnight Arcade', year: 1983, label: 'Tokai Sound', catno: 'TS-28-114', country: 'Japan', pressing: 'original', genres: ['Pop'], styles: ['City Pop', 'Synth-pop'], media: 'NM', sleeve: 'NM', paid: 120, values: [150, 158, 149, 162], kind: 'sold', addedDaysAgo: 300, favorite: true },
  { artist: 'Marée Basse', title: 'Littoral', year: 2019, label: 'Écume Records', catno: 'ECU004', country: 'France', pressing: 'original', color: 'Bleu translucide', genres: ['Electronic'], styles: ['Ambient', 'Downtempo'], media: 'M', sleeve: 'M', paid: 24, values: [28, 30, 31], kind: 'asking-low', addedDaysAgo: 260 },
  { artist: 'Orchid Theory', title: 'Neon Psalms', year: 2021, label: 'Hollow Sun', catno: 'HS-210', country: 'US', pressing: 'original', color: 'Rose néon', discs: 2, genres: ['Electronic', 'Pop'], styles: ['Synthwave'], media: 'NM', sleeve: 'NM', paid: 34, values: [32, 29, 27], kind: 'asking-low', addedDaysAgo: 220 },
  { artist: 'Lune Rouge Ensemble', title: 'Saturne en Hiver', year: 1972, label: 'Orbe', catno: 'ORB 33.019', country: 'France', pressing: 'original', genres: ['Jazz'], styles: ['Jazz-Funk', 'Spiritual Jazz'], media: 'VG', sleeve: 'VG', paid: 95, values: [140, 146, 152, 175], kind: 'sold', addedDaysAgo: 200 },
  { artist: 'Dusty Meridian', title: 'Westbound Tapes', year: 1988, label: 'Mesa Line', catno: 'ML-8803', country: 'US', pressing: 'reissue', genres: ['Rock', 'Folk, World, & Country'], styles: ['Country Rock'], media: 'VG+', sleeve: 'VG+', paid: 18, values: [21, 22, 22], kind: 'asking-low', addedDaysAgo: 180 },
  { artist: 'Polar Ghosts', title: 'Aurora Machine', year: 2003, label: 'Kelvin', catno: 'KLV 12', country: 'Germany', pressing: 'original', discs: 2, genres: ['Electronic'], styles: ['IDM', 'Ambient'], media: 'NM', sleeve: 'VG+', paid: 55, values: [72, 79, 84], kind: 'sold', addedDaysAgo: 150 },
  { artist: 'Sable & Fontaine', title: 'Rive Gauche', year: 1966, label: 'Pavé', catno: 'PV 7014', country: 'France', pressing: 'original', genres: ['Pop'], styles: ['Chanson', 'Yé-Yé'], media: 'VG', sleeve: 'G+', paid: 30, values: [38, 40], kind: 'sold', addedDaysAgo: 120 },
  { artist: 'Hydra Club', title: 'Bassline Theory', year: 1997, label: 'Night Shift Dubs', catno: 'NSD-009', country: 'UK', pressing: 'original', genres: ['Electronic'], styles: ['Deep House'], media: 'VG+', sleeve: 'VG', paid: 28, values: [45, 47, 52], kind: 'sold', addedDaysAgo: 95 },
  { artist: 'Ivory Wren', title: 'Paper Moons', year: 2015, label: 'Thistle', catno: 'TH-031', country: 'Canada', pressing: 'reissue', color: 'Crème marbré', genres: ['Folk, World, & Country'], styles: ['Indie Folk'], media: 'M', sleeve: 'M', paid: 27, values: [26, 26], kind: 'asking-low', addedDaysAgo: 60 },
  { artist: 'Cobalt Youth', title: 'Static Bloom', year: 2008, label: 'Paper Planes', catno: 'PP-112', country: 'US', pressing: 'original', genres: ['Rock'], styles: ['Indie Rock'], media: 'VG+', sleeve: 'VG+', paid: 22, values: [35, 38], kind: 'sold', addedDaysAgo: 40 },
  { artist: 'Tamsin Vale', title: 'Velour', year: 2023, label: 'Satin Room', catno: 'SR-003', country: 'UK', pressing: 'original', color: 'Bordeaux', genres: ['Funk / Soul'], styles: ['Contemporary R&B'], media: 'M', sleeve: 'NM', paid: 31, values: [33], kind: 'asking-low', addedDaysAgo: 20 },
  { artist: 'Grand Orbite', title: 'Gravité', year: 1977, label: 'Zénith', catno: 'ZN 30.441', country: 'France', pressing: 'original', discs: 2, genres: ['Rock'], styles: ['Prog Rock', 'Space Rock'], media: 'VG+', sleeve: 'VG', paid: 60, values: [88, 94], kind: 'sold', addedDaysAgo: 10 },
]

const DAY = 86400000

export function buildDemo(now = Date.now()): { records: VinylRecord[]; prices: PriceObservation[]; wishlist: WishItem[] } {
  const records: VinylRecord[] = []
  const prices: PriceObservation[] = []
  SEEDS.forEach((s, i) => {
    const id = uid()
    const createdAt = now - s.addedDaysAgo * DAY
    records.push({
      id,
      createdAt,
      updatedAt: createdAt,
      artist: s.artist,
      title: s.title,
      year: s.year,
      label: s.label,
      catno: s.catno,
      country: s.country,
      pressing: s.pressing,
      color: s.color,
      discs: s.discs ?? 1,
      formatText: `Vinyl, LP${s.discs && s.discs > 1 ? `, ${s.discs}×` : ''}`,
      genres: s.genres,
      styles: s.styles,
      mediaCondition: s.media,
      sleeveCondition: s.sleeve,
      purchasePrice: s.paid,
      purchaseDate: new Date(createdAt).toISOString().slice(0, 10),
      favorite: s.favorite,
      coverSeed: i * 7919 + 13,
      demo: true,
    })
    // Observations réparties entre la date d'ajout et aujourd'hui.
    const n = s.values.length
    s.values.forEach((v, k) => {
      const at = n === 1 ? now - 2 * DAY : createdAt + ((now - 2 * DAY - createdAt) * k) / (n - 1)
      prices.push({
        id: uid(),
        recordId: id,
        at: Math.round(at),
        kind: s.kind,
        source: 'demo',
        value: v,
        currency: 'EUR',
        condition: s.kind === 'sold' ? s.media : undefined,
        count: s.kind === 'asking-low' ? 3 + ((i + k) % 9) : undefined,
        note: 'Donnée fictive de démonstration',
        demo: true,
      })
    })
  })

  const wishlist: WishItem[] = [
    { id: uid(), createdAt: now - 30 * DAY, artist: 'Nadia Okoro', title: 'Second Light', edition: 'Pressage original 1981', year: 1981, coverSeed: 911, targetPrice: 70, status: 'available', alert: true, lastSeen: { value: 84, currency: 'EUR', count: 4, at: now - 3 * DAY }, reason: 'Album manquant d’une artiste de votre collection', demo: true },
    { id: uid(), createdAt: now - 12 * DAY, artist: 'Marée Basse', title: 'Contre-Courant', edition: 'Vinyle vert, 500 ex.', year: 2027, coverSeed: 4441, targetPrice: 28, status: 'preorder', releaseDate: new Date(now + 41 * DAY).toISOString().slice(0, 10), alert: true, reason: 'Nouvel album annoncé', demo: true },
    { id: uid(), createdAt: now - 5 * DAY, artist: 'Kōji Haru', title: 'Pacific Drive', edition: 'Réédition 2026, obi', year: 2026, coverSeed: 2027, targetPrice: 35, status: 'upcoming', releaseDate: new Date(now + 18 * DAY).toISOString().slice(0, 10), alert: false, reason: 'Réédition annoncée', demo: true },
  ]
  return { records, prices, wishlist }
}

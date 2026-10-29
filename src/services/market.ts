// Architecture des connecteurs de marché.
// Chaque source déclare honnêtement ce qu'elle permet réellement depuis l'application.
import { useApp } from '../lib/store'
import type { PriceObservation, SourceId, VinylRecord } from '../lib/types'
import { getMarketStats, getPriceSuggestions, hasDiscogsToken, historyUrl, sellUrl } from './discogs'

export type ConnectorStatus = 'active' | 'token' | 'backend' | 'links'

export interface MarketConnector {
  id: SourceId
  name: string
  status: () => ConnectorStatus
  summary: string
  provides: string[]
  limits: string
  /** Lien de recherche d'annonces comparables. */
  listingsUrl: (r: Pick<VinylRecord, 'artist' | 'title' | 'catno' | 'discogsId'>) => string
  /** Lien vers des ventes conclues, si la source les publie. */
  soldUrl?: (r: Pick<VinylRecord, 'artist' | 'title' | 'catno' | 'discogsId'>) => string | undefined
}

const q = (r: Pick<VinylRecord, 'artist' | 'title' | 'catno'>) =>
  encodeURIComponent([r.artist, r.title, r.catno].filter(Boolean).join(' ') + ' vinyle')

export const CONNECTORS: MarketConnector[] = [
  {
    id: 'discogs',
    name: 'Discogs',
    status: () => (hasDiscogsToken() ? 'active' : 'token'),
    summary: 'Base de référence des pressages et place de marché mondiale.',
    provides: [
      'Identification des éditions exactes (référence, pays, couleur)',
      'Prix affiché le plus bas et nombre d’annonces (sans jeton)',
      'Suggestions de prix par état (avec jeton personnel)',
    ],
    limits:
      "L'API ne publie pas l'historique des ventes : il reste consultable sur le site via le lien « Ventes ». Sans jeton : 25 requêtes/min et pas d'images.",
    listingsUrl: (r) => (r.discogsId ? sellUrl(r.discogsId) : `https://www.discogs.com/search/?q=${q(r)}&type=release&format=Vinyl`),
    soldUrl: (r) => (r.discogsId ? historyUrl(r.discogsId) : undefined),
  },
  {
    id: 'ebay',
    name: 'eBay',
    status: () => 'backend',
    summary: 'Annonces et ventes terminées.',
    provides: ['Recherche des ventes réussies (lien)', 'Annonces en cours (lien)'],
    limits:
      "L'API Browse exige un secret d'application (donc un backend) et l'API des ventes conclues (Marketplace Insights) est réservée aux partenaires agréés. Connecteur prêt à brancher via une fonction serveur.",
    listingsUrl: (r) => `https://www.ebay.fr/sch/i.html?_nkw=${q(r)}&_sacat=176985`,
    soldUrl: (r) => `https://www.ebay.fr/sch/i.html?_nkw=${q(r)}&_sacat=176985&LH_Sold=1&LH_Complete=1`,
  },
  {
    id: 'leboncoin',
    name: 'Leboncoin',
    status: () => 'links',
    summary: 'Petites annonces entre particuliers en France.',
    provides: ['Recherche d’annonces (lien)'],
    limits: "Aucune API publique : seules des recherches pré-remplies sont proposées. Les prix y sont des prix demandés, pas des ventes.",
    listingsUrl: (r) => `https://www.leboncoin.fr/recherche?text=${q(r)}`,
  },
]

const DAY = 86400000

/**
 * Interroge les sources actives et enregistre de nouvelles observations datées.
 * N'ajoute rien si la source ne renvoie pas de prix.
 */
export async function refreshRecordPrices(rec: VinylRecord): Promise<{ added: number; message: string }> {
  if (!rec.discogsId) return { added: 0, message: 'Associez ce disque à une édition Discogs pour suivre son prix.' }
  const { prices, addPrices, profile } = useApp.getState()
  if (!profile.privacy.priceLookups) return { added: 0, message: 'Recherche de prix désactivée dans Confidentialité.' }
  const now = Date.now()
  const recent = (kind: PriceObservation['kind']) =>
    prices.find((p) => p.recordId === rec.id && p.kind === kind && p.source === 'discogs' && now - p.at < DAY / 2)

  const out: Omit<PriceObservation, 'id'>[] = []
  const stats = await getMarketStats(rec.discogsId, true)
  if (stats.lowest != null && !recent('asking-low')) {
    out.push({
      recordId: rec.id,
      at: now,
      kind: 'asking-low',
      source: 'discogs',
      value: stats.lowest,
      currency: stats.currency,
      count: stats.numForSale,
      url: sellUrl(rec.discogsId),
      note: 'Prix le plus bas affiché, tous états confondus',
    })
  }
  if (hasDiscogsToken() && !recent('suggested')) {
    try {
      const sug = await getPriceSuggestions(rec.discogsId)
      const c = rec.mediaCondition ?? 'VG+'
      const s = sug[c]
      if (s) {
        out.push({
          recordId: rec.id,
          at: now,
          kind: 'suggested',
          source: 'discogs',
          value: Math.round(s.value * 100) / 100,
          currency: s.currency,
          condition: c,
          url: historyUrl(rec.discogsId),
          note: `Suggestion Discogs pour l'état ${c}`,
        })
      }
    } catch {
      /* suggestions indisponibles (paramètres vendeur non renseignés) */
    }
  }
  if (out.length) addPrices(out)
  if (!out.length && stats.lowest == null)
    return { added: 0, message: `Aucune annonce en cours sur Discogs${stats.numForSale ? '' : ' pour cette édition'}.` }
  return { added: out.length, message: out.length ? 'Prix actualisés.' : 'Prix déjà à jour (moins de 12 h).' }
}

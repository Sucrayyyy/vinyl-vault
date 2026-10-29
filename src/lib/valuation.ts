// Estimation de valeur — règles explicites et vérifiables.
// Priorité : ventes réelles > suggestion par état > estimation manuelle > prix affiché le plus bas.
// Aucune valeur n'est extrapolée : sans observation, la valeur est « indisponible ».
import type { PriceObservation, VinylRecord } from './types'

export type Basis = 'sold' | 'suggested' | 'manual' | 'asking-low' | 'none'

export interface Estimate {
  value?: number
  basis: Basis
  confidence: 'élevée' | 'moyenne' | 'indicative' | 'aucune'
  at?: number
  sampleSize: number
  demo: boolean
}

export const BASIS_LABEL: Record<Basis, string> = {
  sold: 'Ventes réelles',
  suggested: 'Suggestion par état',
  manual: 'Estimation personnelle',
  'asking-low': 'Prix affiché le plus bas',
  none: 'Indisponible',
}

const DAY = 86400000
const SOLD_WINDOW = 365 * DAY

function median(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/** Estimation d'un disque à une date donnée (par défaut : maintenant). */
export function estimate(rec: VinylRecord, obs: PriceObservation[], asOf = Date.now()): Estimate {
  const mine = obs.filter((o) => o.recordId === rec.id && o.at <= asOf && o.currency === 'EUR')
  return estimateFrom(rec, mine, asOf)
}

export function groupByRecord(obs: PriceObservation[]): Map<string, PriceObservation[]> {
  const m = new Map<string, PriceObservation[]>()
  for (const o of obs) {
    const l = m.get(o.recordId)
    if (l) l.push(o)
    else m.set(o.recordId, [o])
  }
  return m
}

function estimateFrom(rec: VinylRecord, mine: PriceObservation[], asOf = Date.now()): Estimate {
  const demo = mine.some((o) => o.demo)
  const cond = rec.mediaCondition

  const sold = mine.filter((o) => o.kind === 'sold' && asOf - o.at <= SOLD_WINDOW)
  if (sold.length) {
    const sameCond = cond ? sold.filter((o) => o.condition === cond) : []
    const pool = sameCond.length >= 2 ? sameCond : sold
    return {
      value: median(pool.map((o) => o.value)),
      basis: 'sold',
      confidence: pool.length >= 3 ? 'élevée' : 'moyenne',
      at: Math.max(...pool.map((o) => o.at)),
      sampleSize: pool.length,
      demo,
    }
  }

  const latest = (kind: PriceObservation['kind'], filter?: (o: PriceObservation) => boolean) =>
    mine
      .filter((o) => o.kind === kind && (!filter || filter(o)))
      .sort((a, b) => b.at - a.at)[0]

  const sug = latest('suggested', (o) => !cond || !o.condition || o.condition === cond)
  if (sug) return { value: sug.value, basis: 'suggested', confidence: 'moyenne', at: sug.at, sampleSize: 1, demo }

  const man = latest('manual')
  if (man) return { value: man.value, basis: 'manual', confidence: 'indicative', at: man.at, sampleSize: 1, demo }

  const ask = latest('asking-low')
  if (ask) return { value: ask.value, basis: 'asking-low', confidence: 'indicative', at: ask.at, sampleSize: ask.count ?? 1, demo }

  return { basis: 'none', confidence: 'aucune', sampleSize: 0, demo }
}

export interface CollectionPoint {
  at: number
  value: number
  covered: number
}

/**
 * Historique de la valeur de collection, reconstruit uniquement à partir des
 * observations enregistrées : un point par jour où au moins une observation existe.
 * Seuls les disques possédés à cette date et disposant d'une estimation sont comptés.
 */
export function collectionHistory(records: VinylRecord[], obs: PriceObservation[], since = 0): CollectionPoint[] {
  const days = new Set<number>()
  for (const o of obs) {
    if (o.at >= since) days.add(Math.floor(o.at / DAY))
  }
  const sorted = [...days].sort((a, b) => a - b)
  const grouped = groupByRecord(obs.filter((o) => o.currency === 'EUR'))
  const points: CollectionPoint[] = []
  for (const d of sorted) {
    const asOf = (d + 1) * DAY - 1
    let value = 0
    let covered = 0
    for (const r of records) {
      if (r.createdAt > asOf) continue
      const own = grouped.get(r.id)
      if (!own) continue
      const e = estimateFrom(r, own.filter((o) => o.at <= asOf), asOf)
      if (e.value != null) {
        value += e.value
        covered++
      }
    }
    if (covered) points.push({ at: asOf, value, covered })
  }
  return points
}

export interface CollectionSummary {
  total: number
  covered: number
  purchaseTotal: number
  purchaseCovered: number
  byBasis: Record<Basis, number>
  demo: boolean
}

export function summarize(records: VinylRecord[], obs: PriceObservation[]): CollectionSummary {
  const byBasis: Record<Basis, number> = { sold: 0, suggested: 0, manual: 0, 'asking-low': 0, none: 0 }
  let total = 0
  let covered = 0
  let purchaseTotal = 0
  let purchaseCovered = 0
  let demo = false
  const grouped = groupByRecord(obs)
  for (const r of records) {
    const e = estimate(r, grouped.get(r.id) ?? [])
    byBasis[e.basis]++
    if (e.value != null) {
      total += e.value
      covered++
    }
    if (r.purchasePrice != null) {
      purchaseTotal += r.purchasePrice
      purchaseCovered++
    }
    if (r.demo) demo = true
  }
  return { total, covered, purchaseTotal, purchaseCovered, byBasis, demo }
}

/**
 * Variation « à périmètre constant » : uniquement les disques qui avaient déjà
 * une estimation au début de la période, comparés à leur estimation actuelle.
 * Évite qu'un ajout de disques soit présenté comme une hausse de valeur.
 */
export function periodChange(records: VinylRecord[], obs: PriceObservation[], since: number): { pct: number; count: number } | undefined {
  const grouped = groupByRecord(obs.filter((o) => o.currency === 'EUR'))
  let before = 0
  let after = 0
  let count = 0
  for (const r of records) {
    const own = grouped.get(r.id)
    if (!own) continue
    const a = estimateFrom(r, own.filter((o) => o.at <= since), since)
    const b = estimateFrom(r, own)
    if (a.value == null || b.value == null) continue
    before += a.value
    after += b.value
    count++
  }
  if (!count || !before) return undefined
  return { pct: ((after - before) / before) * 100, count }
}

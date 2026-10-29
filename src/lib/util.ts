export const uid = () =>
  (crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`)

const eur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
const eur2 = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function money(v: number | undefined | null, currency = 'EUR', precise = false): string {
  if (v == null || Number.isNaN(v)) return '—'
  if (currency !== 'EUR') {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency, maximumFractionDigits: precise ? 2 : 0 }).format(v)
  }
  return (precise ? eur2 : eur).format(v)
}

export function pct(v: number): string {
  const s = v >= 0 ? '+' : '−'
  return `${s}${Math.abs(v).toFixed(1).replace('.', ',')} %`
}

export const dateFmt = (t: number | string | Date, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) =>
  new Intl.DateTimeFormat('fr-FR', opts).format(t instanceof Date ? t : new Date(t))

export function relativeDays(t: number): string {
  const d = Math.round((Date.now() - t) / 86400000)
  if (d <= 0) return "aujourd'hui"
  if (d === 1) return 'hier'
  if (d < 30) return `il y a ${d} j`
  if (d < 365) return `il y a ${Math.round(d / 30)} mois`
  return `il y a ${Math.round(d / 365)} an${d >= 730 ? 's' : ''}`
}

export function daysUntil(iso: string): number {
  const t = new Date(iso + (iso.length === 10 ? 'T00:00:00' : '')).getTime()
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((t - today.getTime()) / 86400000)
}

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/^the\s+/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v))
}

/** Hash déterministe (pour les pochettes générées). */
export function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function haptic(ms = 8) {
  try {
    navigator.vibrate?.(ms)
  } catch {
    /* non supporté sur iOS */
  }
}

import { useEffect, useMemo, useState } from 'react'
import { useApp } from './store'
import { estimate, groupByRecord, type Estimate } from './valuation'
import { money } from './util'

export function useEstimates(): Map<string, Estimate> {
  const records = useApp((s) => s.records)
  const prices = useApp((s) => s.prices)
  return useMemo(() => {
    const g = groupByRecord(prices)
    const m = new Map<string, Estimate>()
    for (const r of records) m.set(r.id, estimate(r, g.get(r.id) ?? []))
    return m
  }, [records, prices])
}

/** Formatage monétaire qui respecte l'option « Masquer les valeurs ». */
export function useMoney() {
  const hide = useApp((s) => s.profile.privacy.hideValues)
  return (v: number | undefined | null, currency = 'EUR', precise = false) => (hide && v != null ? '•••' : money(v, currency, precise))
}

export function useOnline() {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return online
}

export function useDebounced<T>(value: T, ms = 200): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

/** Charge une ressource asynchrone avec état (chargement / erreur / données). */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [state, set] = useState<{ loading: boolean; error?: unknown; data?: T }>({ loading: true })
  const [nonce, setNonce] = useState(0)
  useEffect(() => {
    let alive = true
    set((s) => ({ ...s, loading: true, error: undefined }))
    fn().then(
      (data) => alive && set({ loading: false, data }),
      (error) => alive && set({ loading: false, error }),
    )
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce])
  return { ...state, reload: () => setNonce((n) => n + 1) }
}

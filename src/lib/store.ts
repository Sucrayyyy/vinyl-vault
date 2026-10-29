import { create } from 'zustand'
import { loadState, saveState, deletePhoto, flush } from './db'
import { buildDemo } from './demo'
import type {
  AppAlert,
  PersistedState,
  PriceObservation,
  Profile,
  Settings,
  VinylRecord,
  WishItem,
} from './types'
import { uid } from './util'

export type Tab = 'collection' | 'discover' | 'releases' | 'profile'

const defaultProfile: Profile = {
  displayName: '',
  genres: [],
  favoriteArtists: [],
  follows: [],
  notifications: { priceDrops: true, releases: true, systemNotifications: false },
  privacy: { hideValues: false, sendPhotosToVision: true, priceLookups: true },
}

const defaultSettings: Settings = {
  recognition: 'auto',
  motion: 'system',
  theme: 'system',
  onboarded: false,
}

interface Toast {
  id: string
  text: string
  tone?: 'ok' | 'warn' | 'error'
  action?: { label: string; run: () => void }
}

interface AppState extends PersistedState {
  ready: boolean
  tab: Tab
  openRecordId: string | null
  addOpen: boolean
  toasts: Toast[]

  init: () => Promise<void>
  setTab: (t: Tab) => void
  openRecord: (id: string | null) => void
  setAddOpen: (v: boolean) => void
  toast: (text: string, tone?: Toast['tone'], action?: Toast['action']) => void
  dismissToast: (id: string) => void

  addRecord: (r: Omit<VinylRecord, 'id' | 'createdAt' | 'updatedAt'>) => VinylRecord
  updateRecord: (id: string, patch: Partial<VinylRecord>) => void
  removeRecord: (id: string) => VinylRecord | undefined
  restoreRecord: (r: VinylRecord, prices: PriceObservation[]) => void

  addPrice: (p: Omit<PriceObservation, 'id'>) => void
  addPrices: (ps: Omit<PriceObservation, 'id'>[]) => void
  removePrice: (id: string) => void

  addWish: (w: Omit<WishItem, 'id' | 'createdAt'>) => WishItem
  updateWish: (id: string, patch: Partial<WishItem>) => void
  removeWish: (id: string) => void

  pushAlert: (a: Omit<AppAlert, 'id' | 'at' | 'read'>) => boolean
  markAlertsRead: () => void
  clearAlerts: () => void

  setProfile: (patch: Partial<Profile>) => void
  setSettings: (patch: Partial<Settings>) => void

  finishOnboarding: (name: string) => void
  loadDemo: () => void
  clearDemo: () => void
  importData: (data: PersistedState) => void
  resetAll: () => Promise<void>
}

function snapshot(s: AppState): PersistedState {
  return {
    version: 1,
    records: s.records,
    prices: s.prices,
    wishlist: s.wishlist,
    alerts: s.alerts,
    profile: s.profile,
    settings: s.settings,
  }
}

export const useApp = create<AppState>()((set, get) => ({
  version: 1,
  records: [],
  prices: [],
  wishlist: [],
  alerts: [],
  profile: defaultProfile,
  settings: defaultSettings,
  ready: false,
  tab: 'collection',
  openRecordId: null,
  addOpen: false,
  toasts: [],

  async init() {
    const saved = await loadState()
    if (saved && saved.version === 1) {
      set({
        ...saved,
        profile: { ...defaultProfile, ...saved.profile, notifications: { ...defaultProfile.notifications, ...saved.profile?.notifications }, privacy: { ...defaultProfile.privacy, ...saved.profile?.privacy } },
        settings: { ...defaultSettings, ...saved.settings },
        ready: true,
      })
    } else {
      // Premier lancement : coffre vide, l'écran d'accueil prend le relais.
      set({ ready: true })
    }
    const tab = sessionStorage.getItem('vv-tab') as Tab | null
    if (tab) set({ tab })
  },

  setTab(tab) {
    try {
      sessionStorage.setItem('vv-tab', tab)
    } catch {
      /* stockage indisponible */
    }
    set({ tab, openRecordId: null })
  },
  openRecord: (openRecordId) => set({ openRecordId }),
  setAddOpen: (addOpen) => set({ addOpen }),
  toast(text, tone = 'ok', action) {
    const id = uid()
    set((s) => ({ toasts: [...s.toasts.slice(-2), { id, text, tone, action }] }))
    setTimeout(() => get().dismissToast(id), action ? 5200 : 2800)
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  addRecord(r) {
    const now = Date.now()
    const rec: VinylRecord = { ...r, id: uid(), createdAt: now, updatedAt: now }
    set((s) => ({ records: [rec, ...s.records] }))
    return rec
  },
  updateRecord(id, patch) {
    set((s) => ({ records: s.records.map((r) => (r.id === id ? { ...r, ...patch, updatedAt: Date.now() } : r)) }))
  },
  removeRecord(id) {
    const rec = get().records.find((r) => r.id === id)
    set((s) => ({
      records: s.records.filter((r) => r.id !== id),
      openRecordId: s.openRecordId === id ? null : s.openRecordId,
    }))
    return rec
  },
  restoreRecord(r, prices) {
    set((s) => ({ records: [r, ...s.records], prices: [...s.prices, ...prices] }))
  },

  addPrice: (p) => set((s) => ({ prices: [...s.prices, { ...p, id: uid() }] })),
  addPrices: (ps) => set((s) => ({ prices: [...s.prices, ...ps.map((p) => ({ ...p, id: uid() }))] })),
  removePrice: (id) => set((s) => ({ prices: s.prices.filter((p) => p.id !== id) })),

  addWish(w) {
    const item: WishItem = { ...w, id: uid(), createdAt: Date.now() }
    set((s) => ({ wishlist: [item, ...s.wishlist] }))
    return item
  },
  updateWish: (id, patch) => set((s) => ({ wishlist: s.wishlist.map((w) => (w.id === id ? { ...w, ...patch } : w)) })),
  removeWish: (id) => set((s) => ({ wishlist: s.wishlist.filter((w) => w.id !== id) })),

  pushAlert(a) {
    if (get().alerts.some((x) => x.key === a.key)) return false
    set((s) => ({ alerts: [{ ...a, id: uid(), at: Date.now(), read: false }, ...s.alerts].slice(0, 100) }))
    return true
  },
  markAlertsRead: () => set((s) => ({ alerts: s.alerts.map((a) => ({ ...a, read: true })) })),
  clearAlerts: () => set({ alerts: [] }),

  setProfile: (patch) => set((s) => ({ profile: { ...s.profile, ...patch } })),
  setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

  finishOnboarding(name) {
    const s = get()
    // La démo des versions précédentes n'est pas conservée dans le nouvel espace.
    if (s.records.length && s.records.every((r) => r.demo)) s.clearDemo()
    set((st) => ({ profile: { ...st.profile, displayName: name.trim() }, settings: { ...st.settings, onboarded: true } }))
  },
  loadDemo() {
    const demo = buildDemo()
    set((s) => ({
      records: [...s.records.filter((r) => !r.demo), ...demo.records],
      prices: [...s.prices.filter((p) => !p.demo), ...demo.prices],
      wishlist: [...s.wishlist.filter((w) => !w.demo), ...demo.wishlist],
    }))
  },
  clearDemo() {
    set((s) => {
      const demoIds = new Set(s.records.filter((r) => r.demo).map((r) => r.id))
      return {
        records: s.records.filter((r) => !r.demo),
        prices: s.prices.filter((p) => !p.demo && !demoIds.has(p.recordId)),
        wishlist: s.wishlist.filter((w) => !w.demo),
      }
    })
  },
  importData(data) {
    set({
      records: data.records ?? [],
      prices: data.prices ?? [],
      wishlist: data.wishlist ?? [],
      alerts: data.alerts ?? [],
      profile: { ...defaultProfile, ...data.profile },
      // Les clés d'API ne sont jamais importées depuis un fichier.
      settings: { ...get().settings, recognition: data.settings?.recognition ?? 'auto', onboarded: true },
    })
  },
  async resetAll() {
    for (const r of get().records) if (r.photoKey) await deletePhoto(r.photoKey)
    set({ records: [], prices: [], wishlist: [], alerts: [], profile: defaultProfile, settings: { ...defaultSettings, theme: get().settings.theme } })
    await flush()
  },
}))

// Persistance automatique de la partie sérialisable.
let last: PersistedState | null = null
useApp.subscribe((s) => {
  if (!s.ready) return
  const snap = snapshot(s)
  if (
    last &&
    last.records === snap.records &&
    last.prices === snap.prices &&
    last.wishlist === snap.wishlist &&
    last.alerts === snap.alerts &&
    last.profile === snap.profile &&
    last.settings === snap.settings
  )
    return
  last = snap
  saveState(snap)
})

export function exportData(): PersistedState {
  const s = useApp.getState()
  const snap = snapshot(s)
  // Les secrets restent sur l'appareil.
  return { ...snap, settings: { ...snap.settings, discogsToken: undefined, anthropicKey: undefined } }
}

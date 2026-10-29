// Vérification des alertes à partir de données vérifiées (Discogs, dates saisies ou MusicBrainz).
import { notify } from '../lib/notify'
import { useApp } from '../lib/store'
import { daysUntil, money } from '../lib/util'
import { getMarketStats, sellUrl } from './discogs'

export async function checkAlerts(force = false) {
  const st = useApp.getState()
  const { profile, settings, wishlist } = st
  const last = settings.lastAlertCheck ?? 0
  if (!force && Date.now() - last < 6 * 3600000) return 0
  st.setSettings({ lastAlertCheck: Date.now() })
  let created = 0

  for (const w of wishlist) {
    if (!w.alert || w.demo) continue

    if (profile.notifications.releases && w.releaseDate) {
      const d = daysUntil(w.releaseDate)
      if (d <= 0 && d > -7 && (w.status === 'upcoming' || w.status === 'preorder')) {
        const ok = st.pushAlert({
          kind: 'release',
          title: `${w.title} est sorti`,
          body: `${w.artist} — date de sortie atteinte (${w.releaseDate}).`,
          key: `rel:${w.id}:${w.releaseDate}`,
          wishId: w.id,
        })
        if (ok) {
          created++
          st.updateWish(w.id, { status: 'available' })
          if (profile.notifications.systemNotifications) void notify(`${w.title} est sorti`, w.artist)
        }
      }
    }

    if (profile.notifications.priceDrops && profile.privacy.priceLookups && w.discogsId) {
      try {
        const s = await getMarketStats(w.discogsId, true)
        if (s.lowest != null) {
          st.updateWish(w.id, { lastSeen: { value: s.lowest, currency: s.currency, count: s.numForSale, at: Date.now() } })
          if (w.targetPrice != null && s.lowest <= w.targetPrice) {
            const ok = st.pushAlert({
              kind: 'price',
              title: `${w.title} sous votre prix cible`,
              body: `Annonce Discogs à ${money(s.lowest, s.currency, true)} (cible ${money(w.targetPrice)}), ${s.numForSale} en vente.`,
              key: `price:${w.id}:${Math.round(s.lowest)}`,
              url: sellUrl(w.discogsId),
              wishId: w.id,
            })
            if (ok) {
              created++
              if (profile.notifications.systemNotifications) void notify('Prix cible atteint', `${w.artist} — ${w.title} : ${money(s.lowest, s.currency, true)}`)
            }
          }
        }
      } catch {
        /* réseau : on réessaiera au prochain passage */
      }
    }
  }
  return created
}

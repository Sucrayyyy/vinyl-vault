// Notifications système (iOS 16.4+ : uniquement depuis l'app installée sur l'écran d'accueil).
export const notificationsSupported = () => typeof Notification !== 'undefined' && 'serviceWorker' in navigator

export async function requestNotifications(): Promise<NotificationPermission | 'unsupported'> {
  if (!notificationsSupported()) return 'unsupported'
  return Notification.requestPermission()
}

export async function notify(title: string, body: string) {
  if (!notificationsSupported() || Notification.permission !== 'granted') return
  try {
    const reg = await navigator.serviceWorker.ready
    await reg.showNotification(title, { body, icon: `${import.meta.env.BASE_URL}icon-192.png`, badge: `${import.meta.env.BASE_URL}icon-192.png` })
  } catch {
    /* ignoré */
  }
}

export const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true

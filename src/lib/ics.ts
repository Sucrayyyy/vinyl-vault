// Rappels calendrier (.ics) : fonctionne sur iPhone sans serveur de notifications.
const pad = (n: number) => String(n).padStart(2, '0')
const stamp = (d: Date) =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`
const esc = (s: string) => s.replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n')

export function buildIcs(opts: { title: string; date: string; description?: string; url?: string }) {
  const day = opts.date.slice(0, 10).replace(/-/g, '')
  const next = new Date(opts.date.slice(0, 10) + 'T00:00:00')
  next.setDate(next.getDate() + 1)
  const end = `${next.getFullYear()}${pad(next.getMonth() + 1)}${pad(next.getDate())}`
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Vinyl Vault//FR',
    'BEGIN:VEVENT',
    `UID:${crypto.randomUUID?.() ?? Date.now()}@vinylvault`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART;VALUE=DATE:${day}`,
    `DTEND;VALUE=DATE:${end}`,
    `SUMMARY:${esc(opts.title)}`,
    opts.description ? `DESCRIPTION:${esc(opts.description)}` : '',
    opts.url ? `URL:${opts.url}` : '',
    'BEGIN:VALARM',
    'TRIGGER:-PT15H',
    'ACTION:DISPLAY',
    `DESCRIPTION:${esc(opts.title)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n')
}

export async function addToCalendar(opts: { title: string; date: string; description?: string; url?: string }) {
  const ics = buildIcs(opts)
  const file = new File([ics], 'sortie-vinyl-vault.ics', { type: 'text/calendar' })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: opts.title })
      return
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
    }
  }
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export function downloadJson(name: string, data: unknown) {
  const file = new File([JSON.stringify(data, null, 2)], name, { type: 'application/json' })
  if (navigator.canShare?.({ files: [file] })) {
    navigator.share({ files: [file] }).catch(() => undefined)
    return
  }
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

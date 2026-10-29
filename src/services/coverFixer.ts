// Vérifie en arrière-plan les pochettes des disques réels et les remplace
// par la pochette exacte de l'édition lorsqu'elle est trouvée.
import { useApp } from '../lib/store'
import { bestCover } from './covers'

let running = false

export async function fixCovers() {
  if (running || !navigator.onLine) return
  running = true
  try {
    const todo = useApp.getState().records.filter((r) => !r.demo && !r.photoKey && !r.coverChecked && r.coverSource !== 'manual')
    for (const r of todo) {
      try {
        const c = await bestCover(r)
        const current = useApp.getState().records.find((x) => x.id === r.id)
        if (!current || current.photoKey || current.coverSource === 'manual') continue
        const patch: Parameters<ReturnType<typeof useApp.getState>['updateRecord']>[1] = { coverChecked: true }
        // On ne remplace une pochette existante que par une pochette d'édition exacte.
        if (c && (!current.coverUrl || c.exact)) {
          patch.coverUrl = c.url
          patch.coverSource = c.source
        }
        useApp.getState().updateRecord(r.id, patch)
      } catch {
        /* réseau : nouvel essai au prochain lancement */
      }
    }
  } finally {
    running = false
  }
}

import { motion } from 'motion/react'
import { useApp, type Tab } from '../lib/store'
import { haptic } from '../lib/util'
import { Icon, type IconName } from './Icon'
import { spring } from './ui'

const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'collection', label: 'Collection', icon: 'collection' },
  { id: 'discover', label: 'Découvrir', icon: 'discover' },
  { id: 'releases', label: 'Sorties', icon: 'releases' },
  { id: 'profile', label: 'Profil', icon: 'profile' },
]

export function TabBar() {
  const tab = useApp((s) => s.tab)
  const setTab = useApp((s) => s.setTab)
  const unread = useApp((s) => s.alerts.filter((a) => !a.read).length)
  return (
    <nav className="tabbar glass" aria-label="Navigation principale">
      {TABS.map((t) => {
        const active = tab === t.id
        return (
          <button
            key={t.id}
            type="button"
            className={`tab ${active ? 'is-active' : ''}`}
            aria-current={active ? 'page' : undefined}
            onClick={() => {
              if (!active) haptic()
              if (active) window.scrollTo({ top: 0, behavior: 'smooth' })
              else setTab(t.id)
            }}
          >
            {active && <motion.span layoutId="tab-pill" className="tab-pill" transition={spring} />}
            <motion.span className="tab-icon" animate={{ y: active ? -1 : 0, scale: active ? 1.06 : 1 }} transition={spring}>
              <Icon name={t.icon} size={22} weight={active ? 1.9 : 1.6} />
              {t.id === 'releases' && unread > 0 && <span className="tab-dot" />}
            </motion.span>
            <span className="tab-label">{t.label}</span>
          </button>
        )
      })}
    </nav>
  )
}

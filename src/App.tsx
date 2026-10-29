import { AnimatePresence, LayoutGroup, motion, MotionConfig } from 'motion/react'
import { useEffect, useRef } from 'react'
import { LogoMark } from './components/Logo'
import { MiniPlayer } from './components/MiniPlayer'
import { TabBar } from './components/TabBar'
import { Onboarding } from './screens/onboarding/Onboarding'
import { Toasts } from './components/ui'
import { requestPersistence } from './lib/db'
import { useOnline } from './lib/hooks'
import { useApp, type Tab } from './lib/store'
import { checkAlerts } from './services/alerts'
import { fixCovers } from './services/coverFixer'
import { captureSessionFromUrl } from './services/sync'
import { AddFlow } from './screens/collection/AddFlow'
import { CollectionScreen } from './screens/collection/CollectionScreen'
import { RecordDetail } from './screens/collection/RecordDetail'
import { DiscoverScreen } from './screens/discover/DiscoverScreen'
import { ProfileScreen } from './screens/profile/ProfileScreen'
import { ReleasesScreen } from './screens/releases/ReleasesScreen'

const ORDER: Tab[] = ['collection', 'discover', 'releases', 'profile']

export default function App() {
  const ready = useApp((s) => s.ready)
  const tab = useApp((s) => s.tab)
  const openRecordId = useApp((s) => s.openRecordId)
  const motionPref = useApp((s) => s.settings.motion)
  const themePref = useApp((s) => s.settings.theme)
  const onboarded = useApp((s) => s.settings.onboarded)
  const online = useOnline()
  const prev = useRef(tab)
  const dir = ORDER.indexOf(tab) >= ORDER.indexOf(prev.current) ? 1 : -1
  useEffect(() => {
    prev.current = tab
  }, [tab])

  useEffect(() => {
    if (captureSessionFromUrl()) setTimeout(() => useApp.getState().toast('Connecté à la synchronisation'), 800)
    useApp
      .getState()
      .init()
      .then(() => {
        void requestPersistence()
        setTimeout(() => void checkAlerts(), 2500)
        setTimeout(() => void fixCovers(), 4000)
      })
  }, [])

  useEffect(() => {
    const reduce = motionPref === 'reduced' || (motionPref === 'system' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    document.documentElement.dataset.motion = reduce ? 'reduced' : 'full'
  }, [motionPref])

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [tab])

  // Thème clair / sombre (préférence ou réglage système, suivi en direct)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    const apply = () => {
      const theme = themePref === 'system' ? (mq.matches ? 'light' : 'dark') : themePref
      document.documentElement.dataset.theme = theme
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#f4f2ee' : '#09090a')
    }
    apply()
    try {
      localStorage.setItem('vv-theme', themePref)
    } catch {
      /* stockage indisponible */
    }
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [themePref])

  if (!ready)
    return (
      <div className="splash">
        <LogoMark size={72} spin />
      </div>
    )

  return (
    <MotionConfig reducedMotion={motionPref === 'system' ? 'user' : motionPref === 'reduced' ? 'always' : 'never'}>
      <LayoutGroup>
        <div className="app">
          <div className="ambient" aria-hidden />
          <AnimatePresence>
            {!online && (
              <motion.div className="offline-pill" initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -40, opacity: 0 }}>
                Hors connexion — votre collection reste disponible
              </motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence mode="popLayout" initial={false} custom={dir}>
            <motion.main
              key={tab}
              className="main"
              custom={dir}
              variants={{
                enter: (d: number) => ({ opacity: 0, x: 28 * d }),
                center: { opacity: 1, x: 0, transitionEnd: { transform: 'none' } },
                exit: (d: number) => ({ opacity: 0, x: -28 * d }),
              }}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: 'spring', stiffness: 380, damping: 38 }}
            >
              {tab === 'collection' && <CollectionScreen />}
              {tab === 'discover' && <DiscoverScreen />}
              {tab === 'releases' && <ReleasesScreen />}
              {tab === 'profile' && <ProfileScreen />}
            </motion.main>
          </AnimatePresence>
          <AnimatePresence>{openRecordId && <RecordDetail key={openRecordId} id={openRecordId} />}</AnimatePresence>
          <div className="status-scrim" aria-hidden />
          <MiniPlayer />
          <TabBar />
          <AddFlow />
          <AnimatePresence>{!onboarded && <Onboarding key="onb" />}</AnimatePresence>
          <Toasts />
        </div>
      </LayoutGroup>
    </MotionConfig>
  )
}

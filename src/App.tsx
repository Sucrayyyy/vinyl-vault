import { AnimatePresence, LayoutGroup, motion, MotionConfig } from 'motion/react'
import { useEffect, useRef } from 'react'
import { LogoMark } from './components/Logo'
import { TabBar } from './components/TabBar'
import { Toasts } from './components/ui'
import { requestPersistence } from './lib/db'
import { useOnline } from './lib/hooks'
import { useApp, type Tab } from './lib/store'
import { checkAlerts } from './services/alerts'
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
      })
  }, [])

  useEffect(() => {
    const reduce = motionPref === 'reduced' || (motionPref === 'system' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    document.documentElement.dataset.motion = reduce ? 'reduced' : 'full'
  }, [motionPref])

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [tab])

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
                enter: (d: number) => ({ opacity: 0, x: 28 * d, filter: 'blur(4px)' }),
                center: { opacity: 1, x: 0, filter: 'blur(0px)' },
                exit: (d: number) => ({ opacity: 0, x: -28 * d, filter: 'blur(4px)' }),
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
          <TabBar />
          <AddFlow />
          <Toasts />
        </div>
      </LayoutGroup>
    </MotionConfig>
  )
}

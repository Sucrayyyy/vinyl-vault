import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import '@fontsource/instrument-serif/400.css'
import '@fontsource/instrument-serif/400-italic.css'
import '@fontsource-variable/inter-tight'
import '@fontsource-variable/geist-mono'
import './styles/tokens.css'
import './styles/base.css'
import './styles/components.css'
import './styles/screens.css'
import './styles/glass.css'
import App from './App'
import { useApp } from './lib/store'

const updateSW = registerSW({
  onNeedRefresh() {
    useApp.getState().toast('Nouvelle version disponible', 'ok', { label: 'Mettre à jour', run: () => updateSW(true) })
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

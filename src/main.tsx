import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router'
import App from './App'
import { PwaUpdater } from './components/PwaUpdater'
import './index.css'
import { applyFocusMode, applyTheme } from './lib/theme'

applyTheme()
applyFocusMode()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App />
      <PwaUpdater />
    </HashRouter>
  </StrictMode>,
)

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/index.css'
import { useCircuitStore } from '@stores/circuitStore'
import { useLiveSimStore } from '@stores/liveSimStore'
import { useUIStore } from '@stores/uiStore'
import { useGameStore } from '@stores/gameStore'
import { ALL_LEVELS } from './game/levels'

// Dev-only handle for end-to-end tests and debugging from the console.
if (import.meta.env.DEV) {
  ;(window as unknown as Record<string, unknown>).__volt = {
    circuit: useCircuitStore,
    live: useLiveSimStore,
    ui: useUIStore,
    game: useGameStore,
    levels: ALL_LEVELS
  }
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

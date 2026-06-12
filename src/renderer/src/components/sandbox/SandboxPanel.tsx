import { useCallback, useState } from 'react'
import { useCircuitStore } from '@stores/circuitStore'
import { useSimulation } from '../../hooks/useSimulation'
import {
  deleteCircuit,
  listCircuits,
  loadCircuit,
  saveCircuit
} from '../../lib/circuitFiles'
import type { ComponentType } from '../../sim/elements'
import Palette from './Palette'
import CircuitCanvas from './CircuitCanvas'
import Inspector from './Inspector'

export default function SandboxPanel(): JSX.Element {
  useSimulation()

  const [pendingType, setPendingType] = useState<ComponentType | null>(null)
  const [circuitName, setCircuitName] = useState('')
  const [saved, setSaved] = useState(() => listCircuits())

  const components = useCircuitStore((s) => s.components)
  const wires = useCircuitStore((s) => s.wires)
  const simResult = useCircuitStore((s) => s.simResult)
  const clearCircuit = useCircuitStore((s) => s.clearCircuit)
  const loadCircuitData = useCircuitStore((s) => s.loadCircuitData)

  const onPlaced = useCallback(() => setPendingType(null), [])

  const handleSave = (): void => {
    const name = circuitName.trim()
    if (!name || components.length === 0) return
    saveCircuit(name, components, wires)
    setSaved(listCircuits())
  }

  const handleLoad = (name: string): void => {
    if (!name) return
    const data = loadCircuit(name)
    if (data) {
      loadCircuitData(data.components, data.wires)
      setCircuitName(name)
    }
  }

  const handleDeleteSaved = (): void => {
    const name = circuitName.trim()
    if (!name) return
    deleteCircuit(name)
    setSaved(listCircuits())
  }

  // ── status line ──
  let status: { text: string; tone: 'ok' | 'warn' | 'error' | 'idle' }
  if (components.length === 0) {
    status = { text: 'Place components to start building', tone: 'idle' }
  } else if (!simResult) {
    status = { text: 'Simulating…', tone: 'idle' }
  } else if (!simResult.solved) {
    status = { text: simResult.error ?? 'Cannot solve circuit', tone: 'error' }
  } else if (simResult.warnings.length > 0) {
    status = { text: `Solved · ${simResult.warnings[0]}`, tone: 'warn' }
  } else {
    status = {
      text: `Solved · ${components.length} components · ${wires.length} wires`,
      tone: 'ok'
    }
  }
  const toneClass = {
    ok: 'text-green-600 dark:text-green-400',
    warn: 'text-amber-600 dark:text-amber-400',
    error: 'text-red-600 dark:text-red-400',
    idle: 'text-gray-400 dark:text-gray-500'
  }[status.tone]

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="h-11 shrink-0 flex items-center gap-2 px-3 border-b border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-brand-navy/40">
        <input
          type="text"
          placeholder="Circuit name"
          value={circuitName}
          onChange={(e) => setCircuitName(e.target.value)}
          aria-label="Circuit name"
          className="w-40 px-2 py-1 text-sm rounded border border-gray-300 dark:border-white/20 bg-white dark:bg-brand-dark text-gray-900 dark:text-gray-100"
        />
        <button
          onClick={handleSave}
          disabled={!circuitName.trim() || components.length === 0}
          className="px-3 py-1 text-sm rounded bg-brand-yellow/20 text-brand-yellow font-medium hover:bg-brand-yellow/30 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Save
        </button>
        <select
          value=""
          onChange={(e) => handleLoad(e.target.value)}
          aria-label="Load circuit"
          className="px-2 py-1 text-sm rounded border border-gray-300 dark:border-white/20 bg-white dark:bg-brand-dark text-gray-900 dark:text-gray-100"
        >
          <option value="">Load…</option>
          {saved.map((s) => (
            <option key={s.name} value={s.name}>
              {s.name} ({s.componentCount})
            </option>
          ))}
        </select>
        <button
          onClick={handleDeleteSaved}
          disabled={!saved.some((s) => s.name === circuitName.trim())}
          title="Delete the saved circuit with this name"
          className="px-2 py-1 text-sm rounded text-red-500 hover:bg-red-500/10 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Delete
        </button>
        <div className="flex-1" />
        <button
          onClick={clearCircuit}
          disabled={components.length === 0}
          className="px-3 py-1 text-sm rounded bg-gray-200 dark:bg-white/10 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Clear
        </button>
      </div>

      {/* Main area */}
      <div className="flex flex-1 min-h-0">
        <Palette pendingType={pendingType} onPick={setPendingType} />
        <div className="flex-1 min-w-0 relative">
          <CircuitCanvas pendingType={pendingType} onPlaced={onPlaced} />
        </div>
        <Inspector />
      </div>

      {/* Status bar */}
      <div className="h-7 shrink-0 flex items-center px-3 border-t border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-brand-navy/40">
        <span className={`text-xs ${toneClass}`} data-testid="sim-status">
          {status.text}
        </span>
      </div>
    </div>
  )
}

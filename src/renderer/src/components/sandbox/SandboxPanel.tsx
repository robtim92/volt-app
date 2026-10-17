import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
import { useCircuitStore } from '@stores/circuitStore'
import { useLessonStore } from '@stores/lessonStore'
import { useUIStore } from '@stores/uiStore'
import { useSimulation } from '../../hooks/useSimulation'
import { useLiveSimulation } from '../../hooks/useLiveSimulation'
import { useLevelRunner } from '../../hooks/useLevelRunner'
import LevelHUD from '../campaign/LevelHUD'
import LevelComplete from '../campaign/LevelComplete'
import BadgeToast from '../campaign/BadgeToast'
import { getLevel } from '../../game/levels'
import { useIsMobile } from '../../hooks/useIsMobile'
import {
  deleteCircuit,
  exportCircuitJSON,
  importCircuitJSON,
  listCircuits,
  loadCircuit,
  saveCircuit
} from '../../lib/circuitFiles'
import type { ComponentType } from '../../sim/elements'
import { validateCircuitQuiz } from '../../lessons/validation'
import Palette from './Palette'
import CircuitCanvas from './CircuitCanvas'
import Inspector from './Inspector'
import Oscilloscope from './Oscilloscope'
import SimControls from './SimControls'
import FailureToast from './FailureToast'
import WireZoom from './WireZoom'
import ViewToggle from './ViewToggle'
import ExamplesGallery from '../examples/ExamplesGallery'
import ExampleGuide from '../examples/ExampleGuide'

const Bench3D = lazy(() => import('../bench/Bench3D'))

export default function SandboxPanel(): JSX.Element {
  // Steady-state analysis handles AC (phasor) circuits; the live time-domain
  // engine owns the result for everything else.
  useSimulation({ steadyDC: false })
  useLiveSimulation()
  useLevelRunner()

  const [pendingType, setPendingType] = useState<ComponentType | null>(null)
  const [circuitName, setCircuitName] = useState('')
  const [saved, setSaved] = useState(() => listCircuits())
  const [notice, setNotice] = useState<string | null>(null)
  const canvasElRef = useRef<HTMLCanvasElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const components = useCircuitStore((s) => s.components)
  const wires = useCircuitStore((s) => s.wires)
  const simResult = useCircuitStore((s) => s.simResult)
  const clearCircuit = useCircuitStore((s) => s.clearCircuit)
  const loadCircuitData = useCircuitStore((s) => s.loadCircuitData)
  const undo = useCircuitStore((s) => s.undo)
  const redo = useCircuitStore((s) => s.redo)
  const canUndo = useCircuitStore((s) => s.past.length > 0)
  const canRedo = useCircuitStore((s) => s.future.length > 0)
  const scopeOpen = useUIStore((s) => s.scopeOpen)
  const toggleScope = useUIStore((s) => s.toggleScope)
  const benchView = useUIStore((s) => s.benchView)
  const mobile = useIsMobile()
  const activeLevelId = useUIStore((s) => s.activeLevelId)
  const activeLevel = activeLevelId ? getLevel(activeLevelId) : undefined
  const setExamplesOpen = useUIStore((s) => s.setExamplesOpen)

  const activeCircuitQuiz = useUIStore((s) => s.activeCircuitQuiz)
  const setCircuitQuizResult = useUIStore((s) => s.setCircuitQuizResult)
  const clearCircuitQuiz = useUIStore((s) => s.clearCircuitQuiz)
  const setActivePanel = useUIStore((s) => s.setActivePanel)
  const recordCircuitQuizResult = useLessonStore((s) => s.recordCircuitQuizResult)

  // When a circuit quiz starts, load the starter circuit (if any) into the canvas.
  useEffect(() => {
    if (activeCircuitQuiz) {
      const starter = activeCircuitQuiz.card.starterCircuit
      if (starter) {
        loadCircuitData(starter.components, starter.wires)
      } else {
        clearCircuit()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCircuitQuiz?.card])

  const handleCheckAnswer = (): void => {
    if (!activeCircuitQuiz) return
    const { passed, failures } = validateCircuitQuiz(
      components,
      wires,
      activeCircuitQuiz.card.conditions
    )
    setCircuitQuizResult(passed, failures)
    recordCircuitQuizResult(activeCircuitQuiz.lessonId, activeCircuitQuiz.cardIndex, passed)
  }

  const handleReturnToLesson = (): void => {
    clearCircuitQuiz()
    setActivePanel('lessons')
  }

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

  const flashNotice = (text: string): void => {
    setNotice(text)
    setTimeout(() => setNotice(null), 4000)
  }

  const downloadBlob = (blob: Blob, filename: string): void => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleExportPNG = (): void => {
    const canvas = canvasElRef.current
    if (!canvas) return
    canvas.toBlob((blob) => {
      if (blob) downloadBlob(blob, `${circuitName.trim() || 'circuit'}.png`)
    }, 'image/png')
  }

  const handleExportJSON = (): void => {
    if (components.length === 0) return
    const json = exportCircuitJSON(circuitName.trim() || 'circuit', components, wires)
    downloadBlob(
      new Blob([json], { type: 'application/json' }),
      `${circuitName.trim() || 'circuit'}.volt.json`
    )
  }

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const result = importCircuitJSON(String(reader.result))
      if ('error' in result) {
        flashNotice(`Import failed: ${result.error}`)
      } else {
        loadCircuitData(result.components, result.wires)
        flashNotice(`Imported ${file.name}`)
      }
    }
    reader.readAsText(file)
  }

  const handleDeleteSaved = (): void => {
    const name = circuitName.trim()
    if (!name) return
    deleteCircuit(name)
    setSaved(listCircuits())
  }

  // ── status line ──
  const acHz =
    simResult?.ac && simResult.omega ? Math.round(simResult.omega / (2 * Math.PI)) : null
  const solvedPrefix = acHz !== null ? `AC @ ${acHz} Hz` : simResult?.live ? 'Live' : 'Solved'
  let status: { text: string; tone: 'ok' | 'warn' | 'error' | 'idle' }
  if (components.length === 0) {
    status = { text: 'Place components to start building', tone: 'idle' }
  } else if (!simResult) {
    status = { text: 'Simulating…', tone: 'idle' }
  } else if (!simResult.solved) {
    const text = simResult.error ?? 'Cannot solve circuit'
    status = { text, tone: text.startsWith('Nothing is connected') ? 'idle' : 'error' }
  } else if (simResult.warnings.length > 0) {
    status = { text: `${solvedPrefix} · ${simResult.warnings[0]}`, tone: 'warn' }
  } else {
    status = {
      text: `${solvedPrefix} · ${components.length} components · ${wires.length} wires`,
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
      <div className="h-11 shrink-0 flex items-center gap-2 px-3 overflow-x-auto [&>*]:shrink-0 [&_button]:whitespace-nowrap border-b border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-brand-navy/40">
        <input
          type="text"
          placeholder="Circuit name"
          value={circuitName}
          onChange={(e) => setCircuitName(e.target.value)}
          aria-label="Circuit name"
          className="hidden md:inline-block w-40 px-2 py-1 text-sm rounded border border-gray-300 dark:border-white/20 bg-white dark:bg-brand-dark text-gray-900 dark:text-gray-100"
        />
        <button
          onClick={handleSave}
          disabled={!circuitName.trim() || components.length === 0}
          className="hidden md:inline-block px-3 py-1 text-sm rounded bg-brand-yellow/20 text-brand-yellow font-medium hover:bg-brand-yellow/30 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Save
        </button>
        <select
          value=""
          onChange={(e) => handleLoad(e.target.value)}
          aria-label="Load circuit"
          className="hidden md:inline-block px-2 py-1 text-sm rounded border border-gray-300 dark:border-white/20 bg-white dark:bg-brand-dark text-gray-900 dark:text-gray-100"
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
          className="hidden md:inline-block px-2 py-1 text-sm rounded text-red-500 hover:bg-red-500/10 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Delete
        </button>
        {!activeLevel && (
          <button
            onClick={() => setExamplesOpen(true)}
            title="Browse example circuits"
            className="px-2 py-1 text-sm rounded bg-sky-500/15 text-sky-700 dark:text-sky-300 hover:bg-sky-500/25 font-medium"
          >
            📚<span className="hidden md:inline"> Examples</span>
          </button>
        )}
        <div className="flex-1" />
        <ViewToggle />
        <button
          onClick={handleExportPNG}
          disabled={components.length === 0}
          title="Export the canvas as a PNG image"
          className="hidden md:inline-block px-2 py-1 text-sm rounded bg-gray-200 dark:bg-white/10 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          PNG
        </button>
        <button
          onClick={handleExportJSON}
          disabled={components.length === 0}
          title="Export the circuit as a JSON file"
          className="hidden md:inline-block px-2 py-1 text-sm rounded bg-gray-200 dark:bg-white/10 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Export
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          title="Import a circuit from a JSON file"
          className="hidden md:inline-block px-2 py-1 text-sm rounded bg-gray-200 dark:bg-white/10 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-white/20"
        >
          Import
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          onChange={handleImportFile}
          className="hidden"
          aria-label="Import circuit file"
        />
        <button
          onClick={toggleScope}
          title="Toggle the oscilloscope"
          aria-label="Toggle oscilloscope"
          className={`px-2 py-1 text-sm rounded ${
            scopeOpen
              ? 'bg-brand-yellow/20 text-brand-yellow'
              : 'bg-gray-200 dark:bg-white/10 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-white/20'
          }`}
        >
          ∿<span className="hidden md:inline"> Scope</span>
        </button>
        <button
          onClick={undo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          aria-label="Undo"
          className="px-2 py-1 text-sm rounded bg-gray-200 dark:bg-white/10 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ↶<span className="hidden md:inline"> Undo</span>
        </button>
        <button
          onClick={redo}
          disabled={!canRedo}
          title="Redo (Ctrl+Shift+Z)"
          aria-label="Redo"
          className="px-2 py-1 text-sm rounded bg-gray-200 dark:bg-white/10 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ↷<span className="hidden md:inline"> Redo</span>
        </button>
        <button
          onClick={clearCircuit}
          disabled={components.length === 0}
          className="px-3 py-1 text-sm rounded bg-gray-200 dark:bg-white/10 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Clear
        </button>
      </div>

      {activeLevel && <LevelHUD />}
      {!activeLevel && !activeCircuitQuiz && <ExampleGuide />}
      <ExamplesGallery />

      {/* Quiz Mode Banner */}
      {activeCircuitQuiz && (
        <div className="shrink-0 border-b border-brand-yellow/40 bg-brand-yellow/5 dark:bg-brand-yellow/10 px-4 py-3 flex flex-col gap-2">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {activeCircuitQuiz.card.question}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {activeCircuitQuiz.card.instructions}
              </p>
            </div>
            <button
              onClick={handleReturnToLesson}
              className="shrink-0 text-xs px-2 py-1 rounded text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10"
            >
              ← Return to lesson
            </button>
          </div>

          {/* Result feedback */}
          {activeCircuitQuiz.attempts > 0 && (
            <div>
              {activeCircuitQuiz.passed ? (
                <p className="text-sm font-semibold text-green-600 dark:text-green-400">
                  ✓ Circuit looks good! {activeCircuitQuiz.card.explanation}
                </p>
              ) : (
                <div className="flex flex-col gap-1">
                  {activeCircuitQuiz.failures.map((f) => (
                    <p key={f} className="text-xs text-red-600 dark:text-red-400">
                      ✗ {f}
                    </p>
                  ))}
                </div>
              )}
              {!activeCircuitQuiz.passed &&
                activeCircuitQuiz.card.hints &&
                activeCircuitQuiz.card.hints
                  .slice(0, activeCircuitQuiz.attempts)
                  .map((hint, i) => (
                    <p key={i} className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                      💡 {hint}
                    </p>
                  ))}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleCheckAnswer}
              disabled={activeCircuitQuiz.passed}
              className="px-4 py-1.5 text-sm font-medium rounded bg-brand-yellow text-brand-dark hover:bg-brand-yellow/90 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {activeCircuitQuiz.passed ? 'Passed ✓' : 'Check Answer'}
            </button>
          </div>
        </div>
      )}

      {/* Main area */}
      <div className="flex flex-col md:flex-row flex-1 min-h-0">
        <Palette
          horizontal={mobile}
          pendingType={pendingType}
          onPick={setPendingType}
          allowedTypes={activeLevel?.palette ?? activeCircuitQuiz?.card.allowedComponents}
        />
        <div className={`flex-1 min-w-0 min-h-0 relative flex flex-col md:flex-row ${mobile ? 'order-first' : ''}`}>
          <FailureToast />
          <WireZoom />
          <BadgeToast />
          {components.length === 0 && !pendingType && !activeLevel && !activeCircuitQuiz && (
            <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none p-4">
              <div className="pointer-events-auto text-center max-w-xs rounded-2xl border border-dashed border-gray-300 dark:border-white/15 bg-white/80 dark:bg-brand-dark/80 px-5 py-4">
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Empty board</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Pick a part to start building, or load a ready-made circuit with a guided walkthrough.
                </p>
                <button
                  onClick={() => setExamplesOpen(true)}
                  className="mt-3 px-3 py-1.5 text-sm rounded-lg bg-sky-500 text-white font-medium hover:bg-sky-600"
                >
                  Browse example circuits
                </button>
              </div>
            </div>
          )}
          <LevelComplete />
          {benchView !== '3d' && (
            <div className={`relative min-w-0 min-h-0 ${benchView === 'split' ? 'h-1/2 md:h-auto md:w-1/2 border-b md:border-b-0 md:border-r border-gray-200 dark:border-white/10' : 'flex-1'}`}>
              <CircuitCanvas
                pendingType={pendingType}
                onPlaced={onPlaced}
                canvasElRef={canvasElRef}
              />
            </div>
          )}
          {benchView !== '2d' && (
            <div className={`relative min-w-0 min-h-0 ${benchView === 'split' ? 'h-1/2 md:h-auto md:w-1/2' : 'flex-1'}`}>
              <Suspense
                fallback={
                  <div className="h-full flex items-center justify-center text-sm text-gray-400">
                    Loading 3D bench…
                  </div>
                }
              >
                <Bench3D />
              </Suspense>
            </div>
          )}
        </div>
        <Inspector sheet={mobile} />
      </div>

      {scopeOpen && <Oscilloscope />}

      {/* Status bar */}
      <div className="h-7 shrink-0 flex items-center px-3 border-t border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-brand-navy/40">
        <span className={`flex-1 truncate text-xs ${toneClass}`} data-testid="sim-status">
          {notice ?? status.text}
        </span>
        <SimControls />
      </div>
    </div>
  )
}

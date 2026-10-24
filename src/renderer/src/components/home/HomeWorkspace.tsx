/**
 * Volt — Home workspace (Phase H1): a whole-house power system.
 * Panel on the left, one-line diagram or 3D house in the middle, circuit card
 * on the right. On phones the three are tabs.
 */
import { Suspense, lazy, useEffect, useState } from 'react'
import { homeLive, SPEEDS, useHomeStore } from '@stores/homeStore'
import { HOME_EXAMPLES, blankHome } from '../../home/examples'
import { useIsMobile } from '../../hooks/useIsMobile'
import PanelView from './PanelView'
import OneLineDiagram from './OneLineDiagram'
import CircuitCard from './CircuitCard'
import { fmtClock, fmtW, useHomeClock } from './useHomeClock'
import { useUIStore } from '@stores/uiStore'
import { getLevel } from '../../game/levels'
import { useHomeLevelRunner } from '../../hooks/useLevelRunner'
import LevelHUD from '../campaign/LevelHUD'
import LevelComplete from '../campaign/LevelComplete'

const House3D = lazy(() => import('./House3D'))

function ClockBar(): JSX.Element {
  useHomeStore((s) => s.tick)
  const playing = useHomeStore((s) => s.playing)
  const speed = useHomeStore((s) => s.speed)
  const setPlaying = useHomeStore((s) => s.setPlaying)
  const setSpeed = useHomeStore((s) => s.setSpeed)
  const resetClock = useHomeStore((s) => s.resetClock)
  const rt = homeLive.runtime
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <button
        onClick={() => setPlaying(!playing)}
        aria-label={playing ? 'Pause' : 'Play'}
        className="px-2 py-1 text-xs rounded bg-gray-200 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-white/20"
      >
        {playing ? '❚❚' : '▶'}
      </button>
      <div className="flex rounded overflow-hidden border border-gray-300 dark:border-white/15" role="group" aria-label="Clock speed">
        {SPEEDS.map((s) => (
          <button
            key={s}
            onClick={() => setSpeed(s)}
            aria-pressed={speed === s}
            className={`px-2 py-1 text-xs ${speed === s ? 'bg-brand-yellow/25 text-gray-900 dark:text-gray-100 font-semibold' : 'text-gray-600 dark:text-gray-300'}`}
          >
            {s}×
          </button>
        ))}
      </div>
      <span className="font-mono text-xs text-gray-600 dark:text-gray-300 w-28">{fmtClock(rt.t)}</span>
      <button onClick={resetClock} title="Restart the clock" className="px-1.5 py-1 text-xs rounded hover:bg-gray-200 dark:hover:bg-white/10">
        ⟲
      </button>
      <span className="ml-1 px-2 py-0.5 rounded-full text-xs font-mono bg-amber-400/15 text-amber-700 dark:text-amber-300">{fmtW(rt.totalWatts)}</span>
    </div>
  )
}

function ExampleMenu(): JSX.Element {
  const loadExample = useHomeStore((s) => s.loadExample)
  const setDesign = useHomeStore((s) => s.setDesign)
  const closeExample = useHomeStore((s) => s.closeExample)
  return (
    <select
      value=""
      onChange={(e) => {
        const v = e.target.value
        if (v === 'blank') {
          closeExample()
          setDesign(blankHome())
        } else if (v) loadExample(v)
      }}
      aria-label="Load a home"
      className="px-2 py-1 text-xs rounded border border-gray-300 dark:border-white/20 bg-white dark:bg-brand-dark"
    >
      <option value="">🏠 Load a home…</option>
      {HOME_EXAMPLES.map((ex) => (
        <option key={ex.id} value={ex.id}>{ex.title}</option>
      ))}
      <option value="blank">Empty panel</option>
    </select>
  )
}

function Guide(): JSX.Element | null {
  const id = useHomeStore((s) => s.activeExampleId)
  const step = useHomeStore((s) => s.exampleStep)
  const setStep = useHomeStore((s) => s.setExampleStep)
  const close = useHomeStore((s) => s.closeExample)
  const ex = HOME_EXAMPLES.find((e) => e.id === id)
  if (!ex) return null
  return (
    <div className="px-4 py-2 border-b border-sky-200 dark:border-sky-500/20 bg-sky-50 dark:bg-sky-500/5" data-testid="home-guide">
      <div className="flex items-baseline gap-2">
        <span className="text-[10px] font-semibold tracking-wider text-sky-700 dark:text-sky-300">EXAMPLE</span>
        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{ex.title}</span>
        <button onClick={close} className="ml-auto text-xs text-gray-500 hover:text-gray-800 dark:hover:text-gray-200">×</button>
      </div>
      <p className="text-xs italic text-gray-600 dark:text-gray-400">{ex.concept}</p>
      <p className="mt-1 text-sm text-gray-800 dark:text-gray-200">
        <span className="inline-flex items-center justify-center w-5 h-5 mr-1.5 rounded-full bg-sky-500 text-white text-[11px] font-bold">{step + 1}</span>
        {ex.steps[step]}
      </p>
      <div className="mt-1 flex items-center gap-2">
        <button disabled={step === 0} onClick={() => setStep(step - 1)} className="px-2 py-0.5 text-xs rounded bg-white/70 dark:bg-white/10 disabled:opacity-40">← Back</button>
        <button disabled={step >= ex.steps.length - 1} onClick={() => setStep(step + 1)} className="px-2 py-0.5 text-xs rounded bg-sky-500/20 text-sky-800 dark:text-sky-200 disabled:opacity-40">Next step →</button>
        <span className="text-[11px] text-gray-500">{step + 1} / {ex.steps.length}</span>
      </div>
    </div>
  )
}

function TripToasts(): JSX.Element {
  const trips = useHomeStore((s) => s.trips)
  const dismiss = useHomeStore((s) => s.dismissTrip)
  useEffect(() => {
    if (!trips.length) return
    const t = setTimeout(() => dismiss(trips[0].key), 9000)
    return () => clearTimeout(t)
  }, [trips, dismiss])
  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex flex-col gap-2 w-[min(92%,34rem)] pointer-events-none">
      {trips.map((t) => (
        <div key={t.key} className="pointer-events-auto rounded-lg shadow-lg bg-gray-900/95 text-white text-sm px-3 py-2 flex gap-2 animate-card-in" role="alert">
          <span className="flex-1">{t.message}</span>
          <button onClick={() => dismiss(t.key)} className="text-white/60 hover:text-white">×</button>
        </div>
      ))}
    </div>
  )
}

export default function HomeWorkspace(): JSX.Element {
  useHomeClock()
  useHomeLevelRunner()
  const levelId = useUIStore((s) => s.activeLevelId)
  const inMission = !!(levelId && getLevel(levelId)?.home)
  const mobile = useIsMobile()
  const [view, setView] = useState<'diagram' | 'house'>('diagram')
  const [tab, setTab] = useState<'panel' | 'diagram' | 'house' | 'circuit'>('panel')
  const selected = useHomeStore((s) => s.selectedCircuitId)
  useEffect(() => {
    if (mobile && selected) setTab('circuit')
  }, [selected, mobile])

  const center =
    view === 'house' ? (
      <Suspense fallback={<div className="p-4 text-sm text-gray-500">Loading the 3D house…</div>}>
        <House3D />
      </Suspense>
    ) : (
      <OneLineDiagram />
    )

  return (
    <div className="h-full flex flex-col relative" data-testid="home-workspace">
      <div className="px-3 md:px-4 py-2 border-b border-gray-200 dark:border-white/10 flex items-center gap-2 flex-wrap">
        {!inMission && <ExampleMenu />}
        <ClockBar />
      </div>
      {inMission ? <LevelHUD /> : <Guide />}
      <TripToasts />
      {inMission && <LevelComplete />}
      {mobile ? (
        <>
          <div className="flex border-b border-gray-200 dark:border-white/10" role="tablist">
            {(['panel', 'diagram', 'house', 'circuit'] as const).map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={`flex-1 py-2 text-xs font-medium capitalize ${tab === t ? 'border-b-2 border-brand-yellow text-gray-900 dark:text-gray-100' : 'text-gray-500'}`}
              >
                {t === 'circuit' ? (selected ? 'Circuit' : 'House info') : t}
              </button>
            ))}
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto p-3">
            {tab === 'panel' && <PanelView />}
            {tab === 'diagram' && <OneLineDiagram />}
            {tab === 'house' && (
              <div className="h-[60vh]">
                <Suspense fallback={<div className="p-4 text-sm text-gray-500">Loading the 3D house…</div>}>
                  <House3D />
                </Suspense>
              </div>
            )}
            {tab === 'circuit' && <CircuitCard />}
          </div>
        </>
      ) : (
        <div className="flex-1 min-h-0 grid grid-cols-[minmax(280px,340px)_1fr_minmax(280px,340px)]">
          <div className="min-h-0 overflow-y-auto p-3 border-r border-gray-200 dark:border-white/10">
            <PanelView />
          </div>
          <div className="min-h-0 flex flex-col">
            <div className="px-3 pt-2 flex gap-1" role="tablist">
              {(['diagram', 'house'] as const).map((v) => (
                <button
                  key={v}
                  role="tab"
                  aria-selected={view === v}
                  onClick={() => setView(v)}
                  className={`px-3 py-1 text-xs rounded ${view === v ? 'bg-brand-yellow/25 font-semibold text-gray-900 dark:text-gray-100' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10'}`}
                >
                  {v === 'diagram' ? 'One-line diagram' : '3D house'}
                </button>
              ))}
            </div>
            <div className={`flex-1 min-h-0 p-3 ${view === 'house' ? '' : 'overflow-y-auto'}`}>{center}</div>
          </div>
          <div className="min-h-0 overflow-y-auto p-3 border-l border-gray-200 dark:border-white/10">
            <CircuitCard />
          </div>
        </div>
      )}
    </div>
  )
}

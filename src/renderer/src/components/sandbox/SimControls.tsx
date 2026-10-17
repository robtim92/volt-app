/**
 * Live-simulation transport: play/pause, time scale, reset, and the sim clock.
 */
import { useLiveSimStore, TIME_SCALES } from '@stores/liveSimStore'

function formatTime(t: number): string {
  if (t < 1e-3) return `${(t * 1e6).toFixed(0)} µs`
  if (t < 1) return `${(t * 1e3).toFixed(1)} ms`
  return `${t.toFixed(2)} s`
}

const scaleLabel = (s: number): string => (s >= 1 ? `${s}×` : `1/${Math.round(1 / s)}×`)

export default function SimControls(): JSX.Element {
  const running = useLiveSimStore((s) => s.running)
  const toggleRunning = useLiveSimStore((s) => s.toggleRunning)
  const timeScale = useLiveSimStore((s) => s.timeScale)
  const setTimeScale = useLiveSimStore((s) => s.setTimeScale)
  const requestReset = useLiveSimStore((s) => s.requestReset)
  const simTime = useLiveSimStore((s) => s.simTime)
  const speedRatio = useLiveSimStore((s) => s.speedRatio)

  const btn =
    'px-1.5 py-0.5 text-xs rounded bg-gray-200 dark:bg-white/10 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-white/20'

  return (
    <div className="flex items-center gap-1.5" data-testid="sim-controls">
      <button onClick={toggleRunning} className={btn} aria-label={running ? 'Pause simulation' : 'Run simulation'} title={running ? 'Pause' : 'Run'}>
        {running ? '❚❚' : '▶'}
      </button>
      <select
        value={timeScale}
        onChange={(e) => setTimeScale(Number(e.target.value))}
        aria-label="Simulation speed"
        title="Simulation speed (simulated seconds per real second)"
        className="px-1 py-0.5 text-xs rounded border border-gray-300 dark:border-white/20 bg-white dark:bg-brand-dark text-gray-700 dark:text-gray-200"
      >
        {TIME_SCALES.map((s) => (
          <option key={s} value={s}>
            {scaleLabel(s)}
          </option>
        ))}
      </select>
      <button onClick={requestReset} className={btn} title="Reset: time to zero, discharge, cool down and repair parts" aria-label="Reset simulation">
        ⟲
      </button>
      <span className="text-xs font-mono text-gray-500 dark:text-gray-400 w-24 text-right whitespace-nowrap" data-testid="sim-clock">
        t = {formatTime(simTime)}
      </span>
      {running && speedRatio < 0.9 && (
        <span className="text-[10px] text-amber-500" title="The circuit is too heavy to simulate at the requested speed">
          {Math.round(speedRatio * 100)}% speed
        </span>
      )}
    </div>
  )
}

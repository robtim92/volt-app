/**
 * In-sandbox mission HUD: brief, live goal checklist with a hold meter, star
 * criteria, progressive hints, restart / exit.
 */
import { useState } from 'react'
import { useGameStore } from '@stores/gameStore'
import { useUIStore } from '@stores/uiStore'
import { getLevel } from '../../game/levels'
import { loadLevel } from '../../hooks/useLevelRunner'
import Stars from './Stars'

export default function LevelHUD(): JSX.Element | null {
  const levelId = useUIStore((s) => s.activeLevelId)
  const exitLevel = useUIStore((s) => s.exitLevel)
  const setActivePanel = useUIStore((s) => s.setActivePanel)
  const progress = useGameStore((s) => s.progress)
  const hintsShown = useGameStore((s) => s.hintsShown)
  const showHint = useGameStore((s) => s.showHint)
  const [briefOpen, setBriefOpen] = useState(true)
  const level = levelId ? getLevel(levelId) : undefined
  if (!level) return null
  const hold = level.holdSeconds ?? 0.5
  const heldPct = Math.min(100, ((progress?.held ?? 0) / hold) * 100)
  const allGoals = progress?.goals.every(Boolean) ?? false

  return (
    <div className="shrink-0 border-b border-brand-yellow/40 bg-brand-yellow/5 dark:bg-brand-yellow/[0.07] px-4 py-2.5" data-testid="level-hud">
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-brand-yellow">Mission</span>
            <h2 className="text-sm font-bold text-gray-900 dark:text-white truncate">{level.title}</h2>
            <button onClick={() => setBriefOpen((o) => !o)} className="text-xs text-gray-500 hover:text-gray-800 dark:hover:text-gray-200">
              {briefOpen ? 'hide brief' : 'show brief'}
            </button>
          </div>
          {briefOpen && <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 leading-relaxed max-w-3xl">{level.brief}</p>}
          {hintsShown > 0 && (
            <ul className="mt-1.5 space-y-0.5">
              {level.hints.slice(0, hintsShown).map((h, i) => (
                <li key={i} className="text-xs text-amber-700 dark:text-amber-300">💡 {h}</li>
              ))}
            </ul>
          )}
        </div>

        <div className="w-72 shrink-0">
          <ul className="space-y-0.5" aria-label="Goals">
            {level.goals.map((g, i) => {
              const ok = progress?.goals[i] ?? false
              return (
                <li key={g.label} className={`text-xs flex items-center gap-1.5 ${ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-600 dark:text-gray-300'}`}>
                  <span className={`inline-flex w-4 h-4 rounded-full items-center justify-center text-[10px] ${ok ? 'bg-emerald-500 text-white' : 'border border-gray-400'}`}>
                    {ok ? '✓' : ''}
                  </span>
                  {g.label}
                </li>
              )
            })}
          </ul>
          <div className="mt-1.5 h-1.5 rounded bg-gray-200 dark:bg-white/10 overflow-hidden" title="Hold all goals to complete">
            <div className={`h-full ${allGoals ? 'bg-emerald-500' : 'bg-gray-400'} transition-[width] duration-150`} style={{ width: `${allGoals ? heldPct : 0}%` }} />
          </div>
          <div className="mt-1.5 text-[11px] text-gray-500 dark:text-gray-400 space-y-0.5">
            <p className="flex items-center gap-1"><Stars count={2} size={10} /> {level.stars[0].label}</p>
            <p className="flex items-center gap-1"><Stars count={3} size={10} /> {level.stars[1].label}</p>
            {(progress?.burnouts ?? 0) > 0 && <p className="text-red-500">💥 {progress?.burnouts} part(s) burned this attempt</p>}
          </div>
        </div>

        <div className="flex flex-col gap-1.5 shrink-0">
          <button
            onClick={showHint}
            disabled={hintsShown >= level.hints.length}
            className="px-3 py-1 text-xs rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 hover:bg-amber-500/25 disabled:opacity-40"
          >
            Hint ({level.hints.length - hintsShown})
          </button>
          <button onClick={() => loadLevel(level.id)} className="px-3 py-1 text-xs rounded bg-gray-200 dark:bg-white/10 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-white/20">
            Restart
          </button>
          <button
            onClick={() => {
              exitLevel()
              setActivePanel('campaign')
            }}
            className="px-3 py-1 text-xs rounded text-gray-500 hover:bg-gray-200 dark:hover:bg-white/10"
          >
            Exit
          </button>
        </div>
      </div>
    </div>
  )
}

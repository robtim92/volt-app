/** Completion card: stars, XP, the "why it worked" debrief, new badges, next level. */
import { useGameStore } from '@stores/gameStore'
import { useUIStore } from '@stores/uiStore'
import { getLevel, nextLevel } from '../../game/levels'
import { BADGES, rankFor } from '../../game/progression'
import { levelPanel, loadLevel } from '../../hooks/useLevelRunner'
import Stars from './Stars'

export default function LevelComplete(): JSX.Element | null {
  const result = useGameStore((s) => s.lastCompletion)
  const xp = useGameStore((s) => s.xp)
  const dismiss = useGameStore((s) => s.dismissCompletion)
  const prediction = useGameStore((s) => s.prediction)
  const measured = useGameStore((s) => s.progress?.measured)
  const startLevel = useUIStore((s) => s.startLevel)
  const exitLevel = useUIStore((s) => s.exitLevel)
  const setActivePanel = useUIStore((s) => s.setActivePanel)
  if (!result) return null
  const level = getLevel(result.levelId)
  if (!level) return null
  const next = nextLevel(level.id)
  const { rank } = rankFor(xp)
  const rows: [string, boolean][] = [
    ['Goals complete', true],
    [level.stars[0].label, result.starChecks[0]],
    [level.stars[1].label, result.starChecks[1]]
  ]

  return (
    <div className="fixed md:absolute inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-3 md:p-6 overflow-y-auto" data-testid="level-complete">
      <div className="w-full max-w-lg max-h-full overflow-y-auto rounded-2xl bg-white dark:bg-brand-navy border border-brand-yellow/50 shadow-2xl p-4 md:p-6 animate-card-in">
        <p className="text-xs uppercase tracking-wider text-brand-yellow text-center">Mission complete</p>
        <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white">{level.title}</h2>
        <div className="flex justify-center my-4 text-gray-300 dark:text-white/20">
          <Stars count={result.stars} size={44} animate />
        </div>
        <ul className="space-y-1 mb-4">
          {rows.map(([label, ok], i) => (
            <li key={i} className={`text-sm flex items-center gap-2 ${ok ? 'text-gray-800 dark:text-gray-100' : 'text-gray-400 line-through'}`}>
              <span>{ok ? '⭐' : '☆'}</span> {label}
            </li>
          ))}
        </ul>
        {level.predict && measured !== undefined && (
          <p className="mb-3 text-sm rounded-lg bg-sky-500/10 text-sky-800 dark:text-sky-200 px-3 py-2">
            🎯 You predicted <strong>{prediction !== null ? `${prediction} ${level.predict.unit}` : 'nothing'}</strong>; the bench measured{' '}
            <strong>{measured.toFixed(2)} {level.predict.unit}</strong>
            {prediction !== null && ` (${Math.abs(((prediction - measured) / (measured || 1)) * 100).toFixed(0)}% off)`}.
          </p>
        )}
        <div className="flex items-center justify-between rounded-lg bg-brand-yellow/10 px-3 py-2 mb-4">
          <span className="text-sm font-semibold text-brand-yellow">+{result.xpGained} XP</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {rank.icon} {rank.title} · {xp} XP
          </span>
        </div>
        {result.newBadges.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {result.newBadges.map((id) => {
              const b = BADGES.find((x) => x.id === id)!
              return (
                <span key={id} className="px-2.5 py-1 rounded-full text-xs bg-brand-yellow/15 text-gray-800 dark:text-gray-100 border border-brand-yellow/40">
                  {b.icon} New badge: <strong>{b.title}</strong>
                </span>
              )
            })}
          </div>
        )}
        <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mb-5">
          <span className="font-semibold text-gray-900 dark:text-white">Why it works: </span>
          {level.debrief}
        </p>
        <div className="flex flex-wrap gap-2 justify-end">
          <button
            onClick={() => {
              dismiss()
              exitLevel()
              setActivePanel('campaign')
            }}
            className="px-3 py-2 text-sm rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10"
          >
            Campaign map
          </button>
          <button
            onClick={() => {
              dismiss()
              loadLevel(level.id)
            }}
            className="px-3 py-2 text-sm rounded-lg bg-gray-200 dark:bg-white/10 text-gray-800 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-white/20"
          >
            Replay
          </button>
          {next ? (
            <button
              onClick={() => {
                dismiss()
                startLevel(next.id, levelPanel(next))
              }}
              className="px-4 py-2 text-sm rounded-lg bg-brand-yellow text-brand-dark font-semibold hover:bg-brand-yellow/90"
            >
              Next: {next.title} ▶
            </button>
          ) : (
            <button
              onClick={() => {
                dismiss()
                exitLevel()
                setActivePanel('campaign')
              }}
              className="px-4 py-2 text-sm rounded-lg bg-brand-yellow text-brand-dark font-semibold hover:bg-brand-yellow/90"
            >
              Chapter complete 🏅
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

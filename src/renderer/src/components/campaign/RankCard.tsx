import { useGameStore } from '@stores/gameStore'
import { BADGES, rankFor } from '../../game/progression'

export default function RankCard(): JSX.Element {
  const xp = useGameStore((s) => s.xp)
  const badges = useGameStore((s) => s.badges)
  const { rank, next, progress } = rankFor(xp)
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-gradient-to-br from-white to-gray-50 dark:from-brand-navy dark:to-[#141428] p-5 flex flex-wrap items-center gap-5">
      <div className="text-4xl w-14 h-14 rounded-xl bg-brand-yellow/15 flex items-center justify-center" aria-hidden>
        {rank.icon}
      </div>
      <div className="flex-1 min-w-[220px]">
        <p className="text-xs uppercase tracking-wider text-gray-400">Rank</p>
        <p className="text-xl font-bold text-gray-900 dark:text-white">{rank.title}</p>
        <div className="mt-2 h-2 rounded-full bg-gray-200 dark:bg-white/10 overflow-hidden" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full bg-brand-yellow transition-all duration-700" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400" data-testid="xp-total">
          {xp} XP{next ? ` · ${next.minXp - xp} XP to ${next.title}` : ' · max rank'}
        </p>
      </div>
      <div className="flex gap-2 flex-wrap">
        {BADGES.map((b) => {
          const has = badges.includes(b.id)
          return (
            <div
              key={b.id}
              title={`${b.title} — ${b.description}${has ? '' : ' (locked)'}`}
              className={`w-11 h-11 rounded-full flex items-center justify-center text-xl border ${
                has ? 'border-brand-yellow/60 bg-brand-yellow/10' : 'border-gray-300 dark:border-white/10 grayscale opacity-30'
              }`}
            >
              {b.icon}
            </div>
          )
        })}
      </div>
    </div>
  )
}

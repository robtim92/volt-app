/**
 * Volt — Campaign map
 *
 * Rank + XP + badges up top, then each chapter as a winding path of level
 * nodes. Levels unlock in order; each shows its best stars. Selecting a node
 * opens its mission card with the goals and star criteria.
 */
import { useState } from 'react'
import { useGameStore, isLevelUnlocked } from '@stores/gameStore'
import { useUIStore } from '@stores/uiStore'
import { CHAPTERS, getLevel } from '../../game/levels'
import { ELEMENTS } from '../../sim/elements'
import type { Level } from '../../game/types'
import Stars from './Stars'
import RankCard from './RankCard'

const COLLECTIBLE = ['voltage_source', 'resistor', 'led', 'switch', 'capacitor', 'diode', 'inductor', 'transistor_npn'] as const
const PART_ICON: Record<string, string> = {
  voltage_source: '🔋', resistor: '〰️', led: '💡', switch: '⏻', capacitor: '🫙', diode: '▷', inductor: '🌀', transistor_npn: '🔺'
}

function MissionCard({ level, onClose }: { level: Level; onClose: () => void }): JSX.Element {
  const startLevel = useUIStore((s) => s.startLevel)
  const record = useGameStore((s) => s.completed[level.id])
  return (
    <div className="rounded-2xl border border-brand-yellow/40 bg-white dark:bg-brand-navy p-4 sm:p-5 shadow-xl" data-testid="mission-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-brand-yellow">Mission</p>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">{level.title}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 italic">{level.concept}</p>
        </div>
        <button onClick={onClose} aria-label="Close mission" className="text-gray-400 hover:text-gray-700 dark:hover:text-white">✕</button>
      </div>
      <p className="mt-3 text-sm text-gray-700 dark:text-gray-200 leading-relaxed">{level.brief}</p>
      <div className="mt-4 grid sm:grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Goals</p>
          <ul className="text-sm space-y-1 text-gray-700 dark:text-gray-200">
            {level.goals.map((g) => (
              <li key={g.label}>• {g.label}</li>
            ))}
            {(level.holdSeconds ?? 0.5) >= 1 && <li className="text-xs text-gray-500">…held for {level.holdSeconds} s</li>}
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Stars</p>
          <ul className="text-sm space-y-1 text-gray-700 dark:text-gray-200">
            <li className="flex items-center gap-2"><Stars count={1} size={12} /> Complete the goals</li>
            <li className="flex items-center gap-2"><Stars count={2} size={12} /> {level.stars[0].label}</li>
            <li className="flex items-center gap-2"><Stars count={3} size={12} /> {level.stars[1].label}</li>
          </ul>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          onClick={() => startLevel(level.id)}
          className="px-5 py-2 rounded-lg bg-brand-yellow text-brand-dark font-semibold hover:bg-brand-yellow/90"
        >
          {record ? 'Play again' : 'Start mission'} ▶
        </button>
        <span className="text-xs text-gray-500">+{level.xp} XP · best: </span>
        <Stars count={record?.stars ?? 0} />
      </div>
    </div>
  )
}

export default function CampaignPanel(): JSX.Element {
  const completed = useGameStore((s) => s.completed)
  const collection = useGameStore((s) => s.collection)
  const [openId, setOpenId] = useState<string | null>(null)
  const open = openId ? getLevel(openId) : undefined

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Campaign</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Missions on the live bench. Real physics — parts really do burn out.
          </p>
        </div>
        <RankCard />

        {CHAPTERS.map((ch) => {
          const firstOpen = ch.levels.find((l) => !completed[l.id] && isLevelUnlocked(l.id, completed))
          const chStars = ch.levels.reduce((n, l) => n + (completed[l.id]?.stars ?? 0), 0)
          return (
            <section key={ch.id}>
              <div className="flex items-end justify-between mb-3">
                <div>
                  <p className="text-xs uppercase tracking-wider text-gray-400">Chapter 1</p>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    {ch.icon} {ch.title}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{ch.subtitle}</p>
                </div>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  ⭐ {chStars} / {ch.levels.length * 3}
                </span>
              </div>

              <div className="relative rounded-2xl bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/10 px-1 sm:px-4 py-6 sm:py-8 overflow-hidden">
                <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none" viewBox="0 0 100 100" aria-hidden>
                  <path d="M 8 50 C 18 15, 28 15, 30 50 S 45 85, 52 50 S 66 15, 74 50 S 86 85, 92 50" fill="none" stroke="currentColor" className="text-gray-300 dark:text-white/10" strokeWidth="1.2" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
                </svg>
                <ol className="relative grid grid-cols-5 gap-1 sm:gap-2">
                  {ch.levels.map((l, i) => {
                    const rec = completed[l.id]
                    const unlocked = isLevelUnlocked(l.id, completed)
                    const current = firstOpen?.id === l.id
                    return (
                      <li key={l.id} className={`flex flex-col items-center text-center ${i % 2 ? 'mt-14' : ''}`}>
                        <button
                          disabled={!unlocked}
                          onClick={() => setOpenId(l.id)}
                          aria-label={`Level ${i + 1}: ${l.title}${unlocked ? '' : ' (locked)'}`}
                          className={`relative w-12 h-12 sm:w-16 sm:h-16 rounded-full text-lg font-bold flex items-center justify-center border-2 transition-transform hover:scale-105 disabled:hover:scale-100 ${
                            rec
                              ? 'bg-brand-yellow text-brand-dark border-brand-yellow'
                              : unlocked
                                ? 'bg-white dark:bg-brand-navy text-gray-900 dark:text-white border-brand-yellow'
                                : 'bg-gray-200 dark:bg-white/5 text-gray-400 border-gray-300 dark:border-white/10 cursor-not-allowed'
                          } ${openId === l.id ? 'ring-4 ring-brand-yellow/40' : ''}`}
                        >
                          {current && <span className="absolute inset-0 rounded-full animate-ping bg-brand-yellow/30" />}
                          <span className="relative">{unlocked ? i + 1 : '🔒'}</span>
                        </button>
                        <p className={`mt-2 text-[11px] sm:text-xs leading-tight font-medium ${unlocked ? 'text-gray-800 dark:text-gray-100' : 'text-gray-400'}`}>{l.title}</p>
                        <span className="text-gray-400"><Stars count={rec?.stars ?? 0} size={12} /></span>
                      </li>
                    )
                  })}
                </ol>
              </div>
            </section>
          )
        })}

        {open && <MissionCard level={open} onClose={() => setOpenId(null)} />}

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-2">Parts collection</h2>
          <div className="flex flex-wrap gap-2">
            {COLLECTIBLE.map((t) => {
              const has = collection.includes(t)
              return (
                <div
                  key={t}
                  title={has ? ELEMENTS[t].displayName : `${ELEMENTS[t].displayName} — unlock in the campaign`}
                  className={`px-3 py-2 rounded-lg border text-sm flex items-center gap-2 ${
                    has ? 'border-brand-yellow/40 bg-brand-yellow/5 text-gray-800 dark:text-gray-100' : 'border-gray-200 dark:border-white/10 text-gray-400'
                  }`}
                >
                  <span className={has ? '' : 'grayscale opacity-40'}>{PART_ICON[t]}</span>
                  {has ? ELEMENTS[t].displayName : '???'}
                </div>
              )
            })}
          </div>
          <p className="mt-2 text-xs text-gray-400">The free sandbox always has every part — the collection tracks what you’ve mastered.</p>
        </section>
      </div>
    </div>
  )
}

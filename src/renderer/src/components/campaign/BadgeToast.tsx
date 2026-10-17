/** Announces badges earned outside the completion card (e.g. first burnout). */
import { useEffect } from 'react'
import { useGameStore } from '@stores/gameStore'
import { BADGES } from '../../game/progression'

export default function BadgeToast(): JSX.Element | null {
  const queue = useGameStore((s) => s.badgeQueue)
  const shift = useGameStore((s) => s.shiftBadge)
  const id = queue[0]
  useEffect(() => {
    if (!id) return
    const t = setTimeout(shift, 4500)
    return () => clearTimeout(t)
  }, [id, shift])
  const badge = id ? BADGES.find((b) => b.id === id) : undefined
  if (!badge) return null
  return (
    <div role="status" className="absolute right-4 bottom-4 z-20 flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-900/95 text-white border border-brand-yellow/60 shadow-xl animate-card-in">
      <span className="text-3xl">{badge.icon}</span>
      <div>
        <p className="text-[10px] uppercase tracking-wider text-brand-yellow">Badge unlocked</p>
        <p className="text-sm font-semibold">{badge.title}</p>
        <p className="text-xs text-gray-400">{badge.description}</p>
      </div>
    </div>
  )
}

/**
 * Volt — XP, ranks and badges (pure)
 */
export interface Rank {
  title: string
  minXp: number
  icon: string
}

export const RANKS: Rank[] = [
  { title: 'Apprentice', minXp: 0, icon: '🔧' },
  { title: 'Tinkerer', minXp: 250, icon: '🔩' },
  { title: 'Technician', minXp: 700, icon: '🔌' },
  { title: 'Engineer', minXp: 1500, icon: '⚙️' },
  { title: 'Inventor', minXp: 3000, icon: '💡' }
]

export function rankFor(xp: number): { rank: Rank; next: Rank | null; progress: number } {
  let i = 0
  while (i + 1 < RANKS.length && xp >= RANKS[i + 1].minXp) i++
  const rank = RANKS[i]
  const next = RANKS[i + 1] ?? null
  const progress = next ? (xp - rank.minXp) / (next.minXp - rank.minXp) : 1
  return { rank, next, progress }
}

/** XP for a result: base for the first clear, +50% of base per star beyond the first. */
export function xpForStars(base: number, stars: number): number {
  if (stars <= 0) return 0
  return Math.round(base * (1 + 0.5 * (stars - 1)))
}

/** Only improvements pay out on replays. */
export function xpGain(base: number, previousStars: number, newStars: number): number {
  return Math.max(0, xpForStars(base, newStars) - xpForStars(base, previousStars))
}

export interface BadgeDef {
  id: string
  title: string
  description: string
  icon: string
}

export const BADGES: BadgeDef[] = [
  { id: 'first-light', title: 'First Light', description: 'Light your first LED.', icon: '💡' },
  { id: 'magic-smoke', title: 'Let the Smoke Out', description: 'Burn out a part. Every engineer has.', icon: '💨' },
  { id: 'three-star', title: 'Perfectionist', description: 'Earn three stars on a level.', icon: '⭐' },
  { id: 'chapter-1', title: 'Lit Up', description: 'Finish Chapter 1: Light It Up.', icon: '🏅' },
  { id: 'clean-sweep', title: 'Clean Sweep', description: 'Three stars on every level in a chapter.', icon: '🏆' }
]

/**
 * Volt — Campaign progress (persisted): XP, per-level stars, badges, parts
 * collection, plus the transient state of the level currently being played.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ComponentType } from '../sim/elements'
import { ALL_LEVELS, CHAPTERS, getLevel } from '../game/levels'
import { BADGES, xpGain } from '../game/progression'
import type { LevelProgress } from '../game/goals'

export interface LevelRecord {
  stars: number
  completedAt: number
}

export interface CompletionResult {
  levelId: string
  stars: number
  previousStars: number
  xpGained: number
  newBadges: string[]
  starChecks: [boolean, boolean]
}

interface GameState {
  xp: number
  completed: Record<string, LevelRecord>
  badges: string[]
  collection: ComponentType[]
  burnouts: number

  // ── transient (not persisted) ──
  /** live progress of the active level attempt */
  progress: LevelProgress | null
  hintsShown: number
  /** set when a level was just completed — drives the completion card */
  lastCompletion: CompletionResult | null
  /** badge ids waiting to be announced */
  badgeQueue: string[]

  setProgress: (p: LevelProgress | null) => void
  showHint: () => void
  resetAttempt: () => void
  recordCompletion: (levelId: string, stars: number, starChecks: [boolean, boolean]) => CompletionResult
  recordBurnout: () => void
  awardBadge: (id: string) => boolean
  dismissCompletion: () => void
  shiftBadge: () => void
  resetProgress: () => void
}

export function isLevelUnlocked(id: string, completed: Record<string, LevelRecord>): boolean {
  const i = ALL_LEVELS.findIndex((l) => l.id === id)
  if (i <= 0) return i === 0
  return !!completed[ALL_LEVELS[i - 1].id]
}

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      xp: 0,
      completed: {},
      badges: [],
      collection: ['wire_node', 'ground'],
      burnouts: 0,
      progress: null,
      hintsShown: 0,
      lastCompletion: null,
      badgeQueue: [],

      setProgress: (progress) => set({ progress }),
      showHint: () => set((s) => ({ hintsShown: s.hintsShown + 1 })),
      resetAttempt: () => set({ progress: null, hintsShown: 0, lastCompletion: null }),

      recordCompletion: (levelId, stars, starChecks) => {
        const s = get()
        const level = getLevel(levelId)
        const previousStars = s.completed[levelId]?.stars ?? 0
        const xpGained = level ? xpGain(level.xp, previousStars, stars) : 0
        const completed = {
          ...s.completed,
          [levelId]: { stars: Math.max(stars, previousStars), completedAt: Date.now() }
        }
        const collection = Array.from(new Set([...s.collection, ...(level?.unlocks ?? [])]))

        const earned: string[] = []
        const has = (id: string): boolean => s.badges.includes(id) || earned.includes(id)
        if (levelId === 'c1-l1' && !has('first-light')) earned.push('first-light')
        if (stars === 3 && !has('three-star')) earned.push('three-star')
        for (const ch of CHAPTERS) {
          const all = ch.levels.every((l) => completed[l.id])
          if (all && ch.id === 'c1' && !has('chapter-1')) earned.push('chapter-1')
          if (all && ch.levels.every((l) => completed[l.id].stars === 3) && !has('clean-sweep')) earned.push('clean-sweep')
        }

        const result: CompletionResult = { levelId, stars, previousStars, xpGained, newBadges: earned, starChecks }
        set({
          xp: s.xp + xpGained,
          completed,
          collection,
          badges: [...s.badges, ...earned],
          lastCompletion: result
        })
        return result
      },

      recordBurnout: () => {
        set((s) => ({ burnouts: s.burnouts + 1 }))
        get().awardBadge('magic-smoke')
      },

      awardBadge: (id) => {
        const s = get()
        if (s.badges.includes(id) || !BADGES.some((b) => b.id === id)) return false
        set({ badges: [...s.badges, id], badgeQueue: [...s.badgeQueue, id] })
        return true
      },

      dismissCompletion: () => set({ lastCompletion: null }),
      shiftBadge: () => set((s) => ({ badgeQueue: s.badgeQueue.slice(1) })),
      resetProgress: () =>
        set({ xp: 0, completed: {}, badges: [], collection: ['wire_node', 'ground'], burnouts: 0, badgeQueue: [] })
    }),
    {
      name: 'volt-game',
      partialize: (s) => ({
        xp: s.xp,
        completed: s.completed,
        badges: s.badges,
        collection: s.collection,
        burnouts: s.burnouts
      })
    }
  )
)

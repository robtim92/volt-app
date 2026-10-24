/**
 * Volt — Campaign progress (persisted): XP, per-level stars, badges, parts
 * collection, plus the transient state of the level currently being played.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ComponentType } from '../sim/elements'
import { CHAPTERS, chapterOf, getLevel } from '../game/levels'
import type { Chapter } from '../game/types'
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
  /** chapters opened early with "jump ahead" */
  jumpedChapters: string[]
  /** testing / free-roam: every mission open */
  unlockAll: boolean

  // ── transient (not persisted) ──
  /** live progress of the active level attempt */
  progress: LevelProgress | null
  hintsShown: number
  /** set when a level was just completed — drives the completion card */
  lastCompletion: CompletionResult | null
  /** badge ids waiting to be announced */
  badgeQueue: string[]
  /** the player's locked-in prediction for the current Predict mission */
  prediction: number | null

  setPrediction: (v: number | null) => void
  jumpToChapter: (id: string) => void
  setUnlockAll: (on: boolean) => void
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

export interface UnlockOptions {
  jumped?: string[]
  unlockAll?: boolean
}

export const chapterStars = (chapterId: string, completed: Record<string, LevelRecord>): number =>
  CHAPTERS.find((c) => c.id === chapterId)?.levels.reduce((n, l) => n + (completed[l.id]?.stars ?? 0), 0) ?? 0

/** A chapter opens when its required chapter has enough stars, or the player jumped ahead. */
export function chapterUnlocked(ch: Chapter, completed: Record<string, LevelRecord>, opts: UnlockOptions = {}): boolean {
  if (opts.unlockAll || !ch.requires || opts.jumped?.includes(ch.id)) return true
  return chapterStars(ch.requires.chapter, completed) >= ch.requires.stars
}

/** Missions open in order within an open chapter. */
export function isLevelUnlocked(id: string, completed: Record<string, LevelRecord>, opts: UnlockOptions = {}): boolean {
  if (opts.unlockAll) return true
  const ch = chapterOf(id)
  if (!ch || !chapterUnlocked(ch, completed, opts)) return false
  const i = ch.levels.findIndex((l) => l.id === id)
  return i === 0 || !!completed[ch.levels[i - 1].id]
}

const CHAPTER_BADGE: Record<string, string> = { c1: 'chapter-1', c2: 'chapter-2', c5: 'chapter-5' }

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
      prediction: null,
      jumpedChapters: [],
      unlockAll: false,

      setPrediction: (prediction) => set({ prediction }),
      jumpToChapter: (id) => set((s) => ({ jumpedChapters: s.jumpedChapters.includes(id) ? s.jumpedChapters : [...s.jumpedChapters, id] })),
      setUnlockAll: (unlockAll) => set({ unlockAll }),
      setProgress: (progress) => set({ progress }),
      showHint: () => set((s) => ({ hintsShown: s.hintsShown + 1 })),
      resetAttempt: () => set({ progress: null, hintsShown: 0, lastCompletion: null, prediction: null }),

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
          const badge = CHAPTER_BADGE[ch.id]
          if (all && badge && !has(badge)) earned.push(badge)
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
        set({ xp: 0, completed: {}, badges: [], collection: ['wire_node', 'ground'], burnouts: 0, badgeQueue: [], jumpedChapters: [] })
    }),
    {
      name: 'volt-game',
      partialize: (s) => ({
        xp: s.xp,
        completed: s.completed,
        badges: s.badges,
        collection: s.collection,
        burnouts: s.burnouts,
        jumpedChapters: s.jumpedChapters,
        unlockAll: s.unlockAll
      })
    }
  )
)

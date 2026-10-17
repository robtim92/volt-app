/**
 * Volt — Campaign level runner
 *
 * While a level is active: loads its starter circuit (fresh sim), then every
 * animation frame checks the level's goals against the live simulation,
 * counts burnouts, and records completion (stars, XP, badges).
 */
import { useEffect, useRef } from 'react'
import { useCircuitStore } from '@stores/circuitStore'
import { useUIStore } from '@stores/uiStore'
import { useGameStore } from '@stores/gameStore'
import { liveFrame, useLiveSimStore } from '@stores/liveSimStore'
import { getLevel } from '../game/levels'
import { newProgress, stepLevel, type LevelProgress } from '../game/goals'

const FAILURE_KINDS = new Set(['burnout', 'pop', 'fuse'])

/** Load (or reload) a level's starter circuit with a fresh simulation. */
export function loadLevel(levelId: string): void {
  const level = getLevel(levelId)
  if (!level) return
  const clone = JSON.parse(JSON.stringify(level.starter)) as typeof level.starter
  useLiveSimStore.getState().requestReset()
  useLiveSimStore.getState().setRunning(true)
  useCircuitStore.getState().loadCircuitData(clone.components, clone.wires)
  useGameStore.getState().resetAttempt()
  useGameStore.getState().setProgress(newProgress(level))
}

const sameGoals = (a: LevelProgress | null, b: LevelProgress): boolean =>
  !!a &&
  a.completed === b.completed &&
  a.burnouts === b.burnouts &&
  a.goals.length === b.goals.length &&
  a.goals.every((g, i) => g === b.goals[i]) &&
  Math.abs(a.held - b.held) < 0.05

export function useLevelRunner(): void {
  const levelId = useUIStore((s) => s.activeLevelId)

  // Load the starter when a level starts
  useEffect(() => {
    if (levelId) loadLevel(levelId)
  }, [levelId])

  // Count every failure (badge), in levels and free play alike
  const seenEffect = useRef(0)
  useEffect(
    () =>
      useLiveSimStore.subscribe((s) => {
        for (const fx of s.effects) {
          if (fx.id <= seenEffect.current) continue
          seenEffect.current = fx.id
          if (FAILURE_KINDS.has(fx.kind)) {
            useGameStore.getState().recordBurnout()
            pendingBurnouts.current++
          }
        }
      }),
    []
  )
  const pendingBurnouts = useRef(0)

  useEffect(() => {
    if (!levelId || typeof requestAnimationFrame === 'undefined') return
    const level = getLevel(levelId)
    if (!level) return
    let raf = 0
    let lastTime = liveFrame.time
    pendingBurnouts.current = 0

    // The authoritative attempt state lives here, updated every frame; the store
    // gets a copy only when something visible changes (avoids 60 re-renders/s).
    let progress: LevelProgress = useGameStore.getState().progress ?? newProgress(level)
    let published = progress

    const tick = (): void => {
      raf = requestAnimationFrame(tick)
      const game = useGameStore.getState()
      // A restart (loadLevel) puts a fresh attempt in the store: adopt it
      if (game.progress && game.progress !== published) {
        progress = game.progress
        published = game.progress
      }
      if (progress.completed) return
      const dt = Math.max(0, liveFrame.time - lastTime)
      lastTime = liveFrame.time
      const snap = liveFrame.snapshot
      const readings = snap?.solved ? { ...snap, terminalNodes: liveFrame.terminalNodes } : null
      const burnouts = pendingBurnouts.current
      pendingBurnouts.current = 0
      progress = stepLevel(level, progress, useCircuitStore.getState().components, readings, dt, burnouts)
      if (!sameGoals(published, progress)) {
        published = progress
        game.setProgress(progress)
      }
      if (progress.completed) {
        published = progress
        game.setProgress(progress)
        game.recordCompletion(level.id, progress.stars, progress.starChecks)
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [levelId])
}

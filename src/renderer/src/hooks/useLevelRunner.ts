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
import { homeLive, useHomeStore } from '@stores/homeStore'
import type { Level } from '../game/types'

/** Which workspace a mission is played in. */
export const levelPanel = (level: Level | undefined): 'sandbox' | 'home' => (level?.home ? 'home' : 'sandbox')

const FAILURE_KINDS = new Set(['burnout', 'pop', 'fuse'])

/** Load (or reload) a level's starter circuit with a fresh simulation. */
export function loadLevel(levelId: string): void {
  const level = getLevel(levelId)
  if (!level) return
  if (level.home) {
    useHomeStore.getState().loadLevelDesign(level.home.starter(), level.home.speed)
    useGameStore.getState().resetAttempt()
    useGameStore.getState().setProgress(newProgress(level))
    return
  }
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
  const activeId = useUIStore((s) => s.activeLevelId)
  // Home Power missions run in the Home workspace (useHomeLevelRunner)
  const levelId = activeId && !getLevel(activeId)?.home ? activeId : null

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
      const circuit = useCircuitStore.getState()
      progress = stepLevel(level, progress, circuit.components, readings, dt, burnouts, {
        wires: circuit.wires,
        soc: liveFrame.soc,
        supplyMode: liveFrame.supplyMode,
        prediction: game.prediction
      })
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

/**
 * Runs a Home Power mission: loads its starter design, then checks goals
 * against the house simulation every frame (hold times in house seconds;
 * breaker trips count against "no trips" stars).
 */
export function useHomeLevelRunner(): void {
  const activeId = useUIStore((s) => s.activeLevelId)
  const levelId = activeId && getLevel(activeId)?.home ? activeId : null

  useEffect(() => {
    if (levelId) loadLevel(levelId)
  }, [levelId])

  useEffect(() => {
    if (!levelId || typeof requestAnimationFrame === 'undefined') return
    const level = getLevel(levelId)
    if (!level) return
    let raf = 0
    let lastT = homeLive.runtime.t
    let progress: LevelProgress = useGameStore.getState().progress ?? newProgress(level)
    let published = progress
    let seenTrip = Math.max(0, ...useHomeStore.getState().trips.map((t) => t.key))
    const tick = (): void => {
      raf = requestAnimationFrame(tick)
      const game = useGameStore.getState()
      if (game.progress && game.progress !== published) {
        progress = game.progress
        published = game.progress
        lastT = homeLive.runtime.t
        seenTrip = Math.max(0, ...useHomeStore.getState().trips.map((t) => t.key))
      }
      if (progress.completed) return
      const rt = homeLive.runtime
      // the runtime resets to t = 0 when a design loads
      const dt = rt.t >= lastT ? rt.t - lastT : rt.t
      lastT = rt.t
      const home = useHomeStore.getState()
      const fresh = home.trips.filter((t) => t.key > seenTrip)
      if (fresh.length) seenTrip = Math.max(...fresh.map((t) => t.key))
      progress = stepLevel(level, progress, [], null, dt, fresh.length, { home: { design: home.design, runtime: rt } })
      if (!sameGoals(published, progress) || progress.completed) {
        published = progress
        game.setProgress(progress)
      }
      if (progress.completed) game.recordCompletion(level.id, progress.stars, progress.starChecks)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [levelId])
}

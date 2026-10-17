/**
 * Runs the home simulation on animation frames while the Home workspace is
 * open: advances house time by real time × speed, applies trips, and
 * publishes to React about 8 times a second.
 */
import { useEffect } from 'react'
import { homeLive, useHomeStore } from '@stores/homeStore'
import { stepHome } from '../../home/homeSim'

export function useHomeClock(): void {
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    let lastPublish = 0
    const loop = (now: number): void => {
      const real = Math.min(0.1, (now - last) / 1000)
      last = now
      const st = useHomeStore.getState()
      if (st.playing) {
        // fast speeds take bigger house-time steps; cap so a frame stays cheap
        const dt = Math.min(real * st.speed, 120)
        const { runtime, trips } = stepHome(st.design, homeLive.runtime, dt)
        homeLive.runtime = runtime
        if (trips.length) st.applyTrips(trips)
      }
      if (now - lastPublish > 125) {
        lastPublish = now
        useHomeStore.getState().publish()
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])
}

export function fmtClock(t: number): string {
  const d = Math.floor(t / 86400)
  const h = Math.floor((t % 86400) / 3600)
  const m = Math.floor((t % 3600) / 60)
  const s = Math.floor(t % 60)
  const hms = `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return d > 0 ? `day ${d + 1} · ${hms}` : hms
}

export const fmtW = (w: number): string => (w >= 1000 ? `${(w / 1000).toFixed(w >= 10000 ? 1 : 2)} kW` : `${Math.round(w)} W`)
export const fmtAmps = (a: number): string => (a >= 100 ? `${Math.round(a)} A` : `${a.toFixed(1)} A`)

/**
 * Volt — Live (time-domain) oscilloscope trace
 *
 * Plots the rolling history of probed node voltages from the live simulator —
 * capacitors charging, LEDs blinking, rectified sines — as a strip chart that
 * scrolls with simulated time. Probes follow the same rules as the AC scope:
 * selected wire → that net; selected component → its pins; otherwise all nodes.
 */
import { useEffect, useRef } from 'react'
import { liveFrame } from '@stores/liveSimStore'
import { useUIStore } from '@stores/uiStore'
import { formatValue } from '../../sim/elements'

export interface LiveProbe {
  node: string
  label: string
  color: string
}

function niceTime(t: number): string {
  if (t < 1e-3) return `${(t * 1e6).toPrecision(2)} µs`
  if (t < 1) return `${(t * 1e3).toPrecision(3)} ms`
  return `${t.toPrecision(3)} s`
}

export default function LiveScope({ probes }: { probes: LiveProbe[] }): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const probesRef = useRef(probes)
  probesRef.current = probes
  const legendRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx || typeof requestAnimationFrame === 'undefined') return
    let raf = 0
    let lastFrame = -1

    const draw = (): void => {
      raf = requestAnimationFrame(draw)
      if (liveFrame.frame === lastFrame) return
      lastFrame = liveFrame.frame
      const dark = useUIStore.getState().darkMode
      const rect = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      const W = Math.max(1, Math.round(rect.width * dpr))
      const H = Math.max(1, Math.round(rect.height * dpr))
      if (canvas.width !== W || canvas.height !== H) {
        canvas.width = W
        canvas.height = H
      }
      const w = rect.width
      const h = rect.height
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.fillStyle = dark ? '#0b0b14' : '#fbfbfd'
      ctx.fillRect(0, 0, w, h)

      const hist = liveFrame.history
      const ps = probesRef.current
      if (hist.length < 2 || ps.length === 0) return
      const t0 = hist[0].t
      const t1 = hist[hist.length - 1].t
      const span = Math.max(1e-12, t1 - t0)
      let vMin = 0
      let vMax = 0
      for (const s of hist) {
        for (const p of ps) {
          const v = s.v[p.node]
          if (v === undefined) continue
          if (v < vMin) vMin = v
          if (v > vMax) vMax = v
        }
      }
      if (vMax - vMin < 1e-6) vMax = vMin + 1
      const pad = (vMax - vMin) * 0.1
      vMin -= pad
      vMax += pad
      const padL = 44
      const padR = 8
      const padY = 8
      const plotW = w - padL - padR
      const plotH = h - padY * 2
      const xOf = (t: number): number => padL + ((t - t0) / span) * plotW
      const yOf = (v: number): number => padY + (1 - (v - vMin) / (vMax - vMin)) * plotH

      // grid + labels
      ctx.strokeStyle = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
      ctx.fillStyle = dark ? '#64748b' : '#94a3b8'
      ctx.font = '10px JetBrains Mono, monospace'
      ctx.textAlign = 'right'
      ctx.lineWidth = 1
      for (let k = 0; k <= 4; k++) {
        const v = vMin + ((vMax - vMin) * k) / 4
        const y = yOf(v)
        ctx.beginPath()
        ctx.moveTo(padL, y)
        ctx.lineTo(padL + plotW, y)
        ctx.stroke()
        ctx.fillText(formatValue(v, 'V'), padL - 4, y + 3)
      }
      if (vMin < 0 && vMax > 0) {
        ctx.strokeStyle = dark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)'
        ctx.beginPath()
        ctx.moveTo(padL, yOf(0))
        ctx.lineTo(padL + plotW, yOf(0))
        ctx.stroke()
      }
      ctx.textAlign = 'left'
      ctx.fillText(`window ${niceTime(span)}`, padL + 4, h - 4)

      for (const p of ps) {
        ctx.strokeStyle = p.color
        ctx.lineWidth = 2
        ctx.beginPath()
        let started = false
        for (const s of hist) {
          const v = s.v[p.node]
          if (v === undefined) continue
          const x = xOf(s.t)
          const y = yOf(v)
          if (!started) {
            ctx.moveTo(x, y)
            started = true
          } else ctx.lineTo(x, y)
        }
        ctx.stroke()
      }

      // legend values (direct DOM update, no React re-render per frame)
      const legend = legendRef.current
      const last = hist[hist.length - 1]
      if (legend) {
        ps.forEach((p, i) => {
          const el = legend.querySelector<HTMLElement>(`[data-probe="${i}"]`)
          const v = last.v[p.node]
          if (el) el.textContent = v === undefined ? '—' : formatValue(v, 'V')
        })
      }
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div className="px-3 pb-2">
      <canvas ref={canvasRef} data-testid="live-scope-canvas" className="w-full h-32 block rounded" />
      <div ref={legendRef} className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
        {probes.map((p, i) => (
          <span key={p.node} className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
            <span className="inline-block w-3 h-1.5 rounded-sm" style={{ backgroundColor: p.color }} />
            <span className="font-medium">{p.label}</span>
            <span className="font-mono text-gray-500 dark:text-gray-400" data-probe={i}>
              —
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}

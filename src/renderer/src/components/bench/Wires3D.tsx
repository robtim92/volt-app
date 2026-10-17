/**
 * Volt — 3D wires with flowing charge
 *
 * Each schematic wire becomes an insulated jumper arcing between the two leads.
 * Insulation colour follows the net voltage (warm = high, cool = low, same as
 * the schematic). Glowing dots travel along each wire at a speed proportional
 * to the current through it — conventional current, + to −.
 */
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { CircuitComponent, Wire } from '../../sim/elements'
import { wireCurrent, wireNetVoltage } from '../../sim/measure'
import { LEAD_HEIGHT, terminalWorld, toWorld, voltageRGB } from './benchMath'
import { wirePath } from '../../sim/wireRoute'
import { liveFrame } from '@stores/liveSimStore'
import { DEFAULT_GAUGE, diameterMm } from '../../sim/wire'
import { displayResult } from './liveReadings'

interface WireGeo {
  wire: Wire
  curve: THREE.Curve<THREE.Vector3>
  length: number
}

const MAX_DOTS = 2000
const DOT_SPACING = 0.55

function buildCurve(a: [number, number, number], b: [number, number, number]): THREE.CatmullRomCurve3 {
  const va = new THREE.Vector3(...a)
  const vb = new THREE.Vector3(...b)
  const dist = va.distanceTo(vb)
  const lift = Math.min(0.6, 0.12 + dist * 0.06)
  const mid = va.clone().add(vb).multiplyScalar(0.5)
  mid.y += lift
  const q1 = va.clone().lerp(vb, 0.2)
  q1.y += lift * 0.7
  const q3 = va.clone().lerp(vb, 0.8)
  q3.y += lift * 0.7
  return new THREE.CatmullRomCurve3([va, q1, mid, q3, vb])
}

/**
 * A jumper that follows the schematic route: up off the first lead, along the
 * corners at a small height, and down onto the last lead. Corners are bent
 * with a short radius, like real wire.
 */
function buildRoutedCurve(path: { x: number; y: number }[]): THREE.Curve<THREE.Vector3> {
  const H = LEAD_HEIGHT + 0.14
  const pts = path.map((p, i) => {
    const [x, , z] = toWorld(p.x, p.y)
    return new THREE.Vector3(x, i === 0 || i === path.length - 1 ? LEAD_HEIGHT : H, z)
  })
  // raised points just above each end so the wire rises before it runs
  const first = pts[0].clone().setY(H)
  const last = pts[pts.length - 1].clone().setY(H)
  const all = [pts[0], first, ...pts.slice(1, -1), last, pts[pts.length - 1]].filter(
    (p, i, arr) => i === 0 || p.distanceTo(arr[i - 1]) > 1e-4
  )
  const cp = new THREE.CurvePath<THREE.Vector3>()
  let cursor = all[0].clone()
  for (let i = 1; i < all.length; i++) {
    const p = all[i]
    const next = all[i + 1]
    if (!next) {
      cp.add(new THREE.LineCurve3(cursor, p.clone()))
      break
    }
    const r = Math.min(0.12, p.distanceTo(cursor) / 2, p.distanceTo(next) / 2)
    const inPt = p.clone().add(cursor.clone().sub(p).normalize().multiplyScalar(r))
    const outPt = p.clone().add(next.clone().sub(p).normalize().multiplyScalar(r))
    if (inPt.distanceTo(cursor) > 1e-4) cp.add(new THREE.LineCurve3(cursor, inPt))
    cp.add(new THREE.QuadraticBezierCurve3(inPt, p.clone(), outPt))
    cursor = outPt
  }
  return cp
}

function WireTube({ geo }: { geo: WireGeo }): JSX.Element {
  const mat = useRef<THREE.MeshStandardMaterial>(null)
  // insulated radius grows with conductor size (22 AWG ≈ 0.035 world units)
  const radius = Math.max(0.022, Math.min(0.09, 0.035 * Math.sqrt(diameterMm(geo.wire.gauge ?? DEFAULT_GAUGE) / 0.644)))
  const tube = useMemo(() => new THREE.TubeGeometry(geo.curve, Math.min(400, Math.max(32, Math.round(geo.length * 24))), radius, 8, false), [geo.curve, radius])
  const HOT = useMemo(() => new THREE.Color('#ff5a1f'), [])
  useFrame(() => {
    const m = mat.current
    if (!m) return
    if (geo.wire.damaged) {
      m.color.set('#1c1917')
      m.emissiveIntensity = 0
      m.opacity = 0.55
      return
    }
    m.opacity = 1
    const heat = liveFrame.heat[geo.wire.id] ?? 0
    const t = Math.max(0, Math.min(1, (heat - 0.6) / 1.2))
    m.emissive.copy(HOT)
    m.emissiveIntensity = t * 2
    const r = displayResult()
    if (!r?.solved) {
      m.color.setRGB(0.55, 0.6, 0.68)
      return
    }
    const maxV = Math.max(1e-9, ...Object.values(r.nodeVoltages).map(Math.abs))
    const v = wireNetVoltage(geo.wire, r) ?? 0
    const [cr, cg, cb] = voltageRGB(v, maxV)
    m.color.setRGB(cr, cg, cb)
  })
  return (
    <mesh geometry={tube} castShadow>
      <meshStandardMaterial ref={mat} roughness={0.45} transparent />
    </mesh>
  )
}

export default function Wires3D({ components, wires }: { components: CircuitComponent[]; wires: Wire[] }): JSX.Element {
  const geos = useMemo<WireGeo[]>(() => {
    const byId = new Map(components.map((c) => [c.id, c]))
    const out: WireGeo[] = []
    for (const w of wires) {
      const a = byId.get(w.fromComponentId)
      const b = byId.get(w.toComponentId)
      if (!a || !b) continue
      const path = wirePath(w, byId)
      const curve =
        path && path.length > 2
          ? buildRoutedCurve(path)
          : buildCurve(terminalWorld(a, w.fromTerminal), terminalWorld(b, w.toTerminal))
      out.push({ wire: w, curve, length: curve.getLength() })
    }
    return out
  }, [components, wires])

  // Charge dots: per wire, evenly spaced; phase advances with current
  const dotsRef = useRef<THREE.InstancedMesh>(null)
  const phases = useRef<number[]>([])
  const tmp = useMemo(() => new THREE.Object3D(), [])
  const point = useMemo(() => new THREE.Vector3(), [])

  useFrame((_, delta) => {
    const mesh = dotsRef.current
    if (!mesh) return
    const r = displayResult()
    let n = 0
    const maxI = r?.solved ? Math.max(1e-12, ...Object.values(r.elementCurrents).map(Math.abs)) : 0
    geos.forEach((g, wi) => {
      const i = r?.solved ? wireCurrent(g.wire, r) ?? 0 : 0
      // below 1 µA is leakage, not a current worth animating
      if (Math.abs(i) < 1e-6 || Math.abs(i) < maxI * 1e-4) return
      // speed in world units / s: log-ish so µA and A both look alive
      const rel = Math.abs(i) / maxI
      const speed = 0.25 + 1.6 * Math.sqrt(rel)
      const dir = i > 0 ? 1 : -1
      phases.current[wi] = ((phases.current[wi] ?? 0) + (dir * speed * Math.min(delta, 0.1)) / DOT_SPACING) % 1
      const count = Math.max(1, Math.floor(g.length / DOT_SPACING))
      for (let k = 0; k < count && n < MAX_DOTS; k++) {
        let u = (k + (phases.current[wi] ?? 0)) / count
        u = ((u % 1) + 1) % 1
        g.curve.getPointAt(u, point)
        tmp.position.copy(point)
        tmp.scale.setScalar(0.6 + 0.5 * Math.sqrt(rel))
        tmp.updateMatrix()
        mesh.setMatrixAt(n++, tmp.matrix)
      }
    })
    mesh.count = n
    mesh.instanceMatrix.needsUpdate = true
  })

  return (
    <group>
      {geos.map((g) => (
        <WireTube key={g.wire.id} geo={g} />
      ))}
      <instancedMesh ref={dotsRef} args={[undefined, undefined, MAX_DOTS]} frustumCulled={false}>
        <sphereGeometry args={[0.032, 10, 8]} />
        <meshStandardMaterial color="#ffe082" emissive="#ffc400" emissiveIntensity={1.1} toneMapped={false} />
      </instancedMesh>
    </group>
  )
}

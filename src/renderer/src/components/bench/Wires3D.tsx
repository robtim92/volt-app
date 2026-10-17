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
import { terminalWorld, voltageRGB } from './benchMath'
import { displayResult } from './liveReadings'

interface WireGeo {
  wire: Wire
  curve: THREE.CatmullRomCurve3
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

function WireTube({ geo }: { geo: WireGeo }): JSX.Element {
  const mat = useRef<THREE.MeshStandardMaterial>(null)
  const tube = useMemo(() => new THREE.TubeGeometry(geo.curve, 32, 0.035, 8, false), [geo.curve])
  useFrame(() => {
    const m = mat.current
    if (!m) return
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
      <meshStandardMaterial ref={mat} roughness={0.45} />
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
      const curve = buildCurve(terminalWorld(a, w.fromTerminal), terminalWorld(b, w.toTerminal))
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

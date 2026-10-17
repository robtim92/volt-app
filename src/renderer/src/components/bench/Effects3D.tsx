/**
 * Volt — 3D failure effects: sparks + flash when a part fails or an inductor
 * arcs, and smoke curling off anything running hot or freshly burnt.
 */
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { liveFrame, useLiveSimStore, type LiveEffect } from '@stores/liveSimStore'
import type { CircuitComponent } from '../../sim/elements'
import { toWorld } from './benchMath'

const SPARKS = 36
const BURST_MS = 900

function Burst({ fx, origin }: { fx: LiveEffect; origin: [number, number, number] }): JSX.Element {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const light = useRef<THREE.PointLight>(null)
  const vel = useMemo(
    () =>
      Array.from({ length: SPARKS }, () => {
        const a = Math.random() * Math.PI * 2
        const up = 1.5 + Math.random() * 2.5
        const out = 0.8 + Math.random() * 2
        return new THREE.Vector3(Math.cos(a) * out, up, Math.sin(a) * out)
      }),
    []
  )
  const tmp = useMemo(() => new THREE.Object3D(), [])
  const electric = fx.kind === 'arc' || fx.kind === 'trip' || fx.kind === 'fuse'
  const color = electric ? '#9fd8ff' : '#ffb347'
  useFrame(() => {
    const age = (performance.now() - fx.at) / BURST_MS
    const m = mesh.current
    if (!m) return
    const t = Math.max(0, age) * 0.9
    for (let k = 0; k < SPARKS; k++) {
      const v = vel[k]
      tmp.position.set(origin[0] + v.x * t, origin[1] + 0.4 + v.y * t - 4.9 * t * t, origin[2] + v.z * t)
      tmp.scale.setScalar(age < 1 ? 1 - age : 0)
      tmp.updateMatrix()
      m.setMatrixAt(k, tmp.matrix)
    }
    m.instanceMatrix.needsUpdate = true
    if (light.current) light.current.intensity = age < 1 ? 12 * (1 - age) ** 2 : 0
  })
  return (
    <group>
      <instancedMesh ref={mesh} args={[undefined, undefined, SPARKS]} frustumCulled={false}>
        <boxGeometry args={[0.04, 0.04, 0.12]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </instancedMesh>
      <pointLight ref={light} position={[origin[0], origin[1] + 0.6, origin[2]]} color={color} distance={6} decay={2} />
    </group>
  )
}

const PUFFS = 14

function Smoke({ c }: { c: CircuitComponent }): JSX.Element {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const mat = useRef<THREE.MeshStandardMaterial>(null)
  const seeds = useMemo(() => Array.from({ length: PUFFS }, (_, i) => ({ off: i / PUFFS, dx: Math.random() - 0.5, dz: Math.random() - 0.5 })), [])
  const tmp = useMemo(() => new THREE.Object3D(), [])
  const [x, , z] = toWorld(c.x, c.y)
  const burntAt = useRef<number | null>(null)
  useFrame(() => {
    const m = mesh.current
    if (!m || !mat.current) return
    const now = performance.now() / 1000
    const heat = liveFrame.heat[c.id] ?? 0
    if (c.damaged && burntAt.current === null) burntAt.current = now
    if (!c.damaged) burntAt.current = null
    // smoke density: hot parts smoulder; burnt parts billow then fade over ~6 s
    const burnt = burntAt.current !== null ? Math.max(0, 1 - (now - burntAt.current) / 6) : 0
    const density = Math.max(burnt, Math.min(1, (heat - 1.2) / 1.2))
    mat.current.opacity = 0.45 * density
    m.visible = density > 0.01
    for (let k = 0; k < PUFFS; k++) {
      const s = seeds[k]
      const life = (now * 0.45 + s.off) % 1
      tmp.position.set(x + s.dx * 0.3 * life + Math.sin(now + k) * 0.1 * life, 0.5 + life * 2.2, z + s.dz * 0.3 * life)
      tmp.scale.setScalar(0.12 + life * 0.45)
      tmp.updateMatrix()
      m.setMatrixAt(k, tmp.matrix)
    }
    m.instanceMatrix.needsUpdate = true
  })
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, PUFFS]} frustumCulled={false}>
      <sphereGeometry args={[1, 10, 8]} />
      <meshStandardMaterial ref={mat} color="#6b6b6b" transparent opacity={0} depthWrite={false} roughness={1} />
    </instancedMesh>
  )
}

export default function Effects3D({ components }: { components: CircuitComponent[] }): JSX.Element {
  const effects = useLiveSimStore((s) => s.effects)
  const byId = useMemo(() => new Map(components.map((c) => [c.id, c])), [components])
  const smokers = components.filter((c) => c.type === 'resistor' || c.type === 'led' || c.type === 'diode' || c.type === 'capacitor')
  return (
    <group>
      {effects.map((fx) => {
        const c = byId.get(fx.componentId)
        if (!c) return null
        return <Burst key={fx.id} fx={fx} origin={toWorld(c.x, c.y)} />
      })}
      {smokers.map((c) => (
        <Smoke key={c.id} c={c} />
      ))}
    </group>
  )
}

/**
 * Volt — 3D part models for the workbench
 *
 * Every schematic component gets a physical stand-in built from primitives:
 * colour-banded resistors (real colour code), electrolytic capacitors, glowing
 * LEDs, a 9 V battery, toggle switches, breakers, meters with live readouts.
 * Local frame: terminals sit at x = ±1 (two-terminal parts), y up, matching the
 * schematic geometry so wires land exactly on the leads.
 *
 * Live behaviour is driven in useFrame from liveFrame (no React re-renders):
 * LED brightness from current, heat glow from the thermal model, charred look
 * when burnt out, switch/breaker levers that follow their state.
 */
import { useMemo, useRef } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { liveFrame } from '@stores/liveSimStore'
import { useCircuitStore } from '@stores/circuitStore'
import { ELEMENTS, formatValue, type CircuitComponent } from '../../sim/elements'
import { terminalKey } from '../../sim/netlist'
import { LEAD_HEIGHT, resistorBands, toWorld, toWorldRotation } from './benchMath'
import { displayResult, currentOf } from './liveReadings'

const METAL = { color: '#c8ccd2', metalness: 0.9, roughness: 0.3 } as const
const CHAR = new THREE.Color('#1c1917')
const HOT = new THREE.Color('#ff5a1f')

// ── Shared pieces ─────────────────────────────────────────────────────────────

/** Straight lead wire between two local points. */
function Lead({ from, to, radius = 0.018 }: { from: [number, number, number]; to: [number, number, number]; radius?: number }): JSX.Element {
  const { position, quaternion, length } = useMemo(() => {
    const a = new THREE.Vector3(...from)
    const b = new THREE.Vector3(...to)
    const dir = b.clone().sub(a)
    const len = dir.length()
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize())
    return { position: a.add(b).multiplyScalar(0.5), quaternion: q, length: len }
  }, [from, to])
  return (
    <mesh position={position} quaternion={quaternion} castShadow>
      <cylinderGeometry args={[radius, radius, length, 8]} />
      <meshStandardMaterial {...METAL} />
    </mesh>
  )
}

/** Axial leads from a body (half-length `h`, at height `y`) down to the terminals. */
function AxialLeads({ h, y }: { h: number; y: number }): JSX.Element {
  return (
    <>
      <Lead from={[-h, y, 0]} to={[-0.85, y, 0]} />
      <Lead from={[-0.85, y, 0]} to={[-1, LEAD_HEIGHT, 0]} />
      <Lead from={[h, y, 0]} to={[0.85, y, 0]} />
      <Lead from={[0.85, y, 0]} to={[1, LEAD_HEIGHT, 0]} />
    </>
  )
}

/** Small solder pad at each terminal. */
function Pads({ points }: { points: [number, number][] }): JSX.Element {
  return (
    <>
      {points.map(([x, z], i) => (
        <mesh key={i} position={[x, 0.012, z]} receiveShadow>
          <cylinderGeometry args={[0.07, 0.07, 0.02, 16]} />
          <meshStandardMaterial color="#d4b16a" metalness={0.8} roughness={0.35} />
        </mesh>
      ))}
    </>
  )
}

/**
 * Apply heat glow / burnt look to a body material every frame.
 */
function useHeatMaterial(c: CircuitComponent, base: string): React.RefObject<THREE.MeshStandardMaterial> {
  const ref = useRef<THREE.MeshStandardMaterial>(null)
  const baseColor = useMemo(() => new THREE.Color(base), [base])
  useFrame(() => {
    const m = ref.current
    if (!m) return
    if (c.damaged) {
      m.color.copy(CHAR)
      m.emissive.set('#000000')
      m.emissiveIntensity = 0
      return
    }
    const heat = liveFrame.heat[c.id] ?? 0
    const t = Math.max(0, Math.min(1, (heat - 0.6) / 1.6))
    m.color.copy(baseColor).lerp(CHAR, t * 0.35)
    m.emissive.copy(HOT)
    m.emissiveIntensity = t * 2.2
  })
  return ref
}

// ── Part models ────────────────────────────────────────────────────────────────

function Resistor({ c }: { c: CircuitComponent }): JSX.Element {
  const bodyMat = useHeatMaterial(c, '#d9c7a1')
  const bands = useMemo(() => resistorBands(c.value ?? 1000).colors, [c.value])
  const y = 0.2
  return (
    <group>
      <mesh position={[0, y, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <capsuleGeometry args={[0.13, 0.62, 6, 16]} />
        <meshStandardMaterial ref={bodyMat} color="#d9c7a1" roughness={0.6} />
      </mesh>
      {bands.map((col, i) => (
        <mesh key={i} position={[-0.25 + i * 0.14 + (i === 3 ? 0.08 : 0), y, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.137, 0.137, 0.055, 20]} />
          <meshStandardMaterial color={col} roughness={0.5} metalness={col === '#c9a227' ? 0.7 : 0} />
        </mesh>
      ))}
      <AxialLeads h={0.42} y={y} />
    </group>
  )
}

function Capacitor({ c }: { c: CircuitComponent }): JSX.Element {
  const big = (c.value ?? 1e-6) >= 1e-6
  const bodyMat = useHeatMaterial(c, big ? '#1f3a93' : '#d98e2b')
  if (!big) {
    // ceramic disc
    return (
      <group>
        <mesh position={[0, 0.42, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.24, 0.24, 0.09, 24]} />
          <meshStandardMaterial ref={bodyMat} color="#d98e2b" roughness={0.5} />
        </mesh>
        <Lead from={[-0.12, 0.25, 0]} to={[-1, LEAD_HEIGHT, 0]} />
        <Lead from={[0.12, 0.25, 0]} to={[1, LEAD_HEIGHT, 0]} />
      </group>
    )
  }
  return (
    <group>
      <mesh position={[0, 0.45, 0]} castShadow>
        <cylinderGeometry args={[0.3, 0.3, 0.75, 28]} />
        <meshStandardMaterial ref={bodyMat} color="#1f3a93" roughness={0.35} metalness={0.2} />
      </mesh>
      {/* negative stripe (terminal 1 side) */}
      <mesh position={[0.18, 0.45, 0]} rotation={[0, 0, 0]}>
        <cylinderGeometry args={[0.305, 0.305, 0.75, 28, 1, true, -0.45, 0.9]} />
        <meshStandardMaterial color="#d6dbe6" roughness={0.4} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.83, 0]}>
        <cylinderGeometry args={[0.29, 0.29, 0.02, 28]} />
        <meshStandardMaterial {...METAL} />
      </mesh>
      <Lead from={[-0.12, 0.08, 0]} to={[-1, LEAD_HEIGHT, 0]} />
      <Lead from={[0.12, 0.08, 0]} to={[1, LEAD_HEIGHT, 0]} />
    </group>
  )
}

function Inductor({ c }: { c: CircuitComponent }): JSX.Element {
  const coreMat = useHeatMaterial(c, '#3a3a3a')
  return (
    <group>
      <mesh position={[0, 0.34, 0]} castShadow>
        <torusGeometry args={[0.28, 0.12, 16, 40]} />
        <meshStandardMaterial ref={coreMat} color="#3a3a3a" roughness={0.6} />
      </mesh>
      {Array.from({ length: 18 }, (_, i) => {
        const a = (i / 18) * Math.PI * 2
        return (
          <mesh key={i} position={[Math.cos(a) * 0.28, 0.34 + Math.sin(a) * 0.28, 0]} rotation={[0, 0, a]}>
            <torusGeometry args={[0.13, 0.018, 6, 16]} />
            <meshStandardMaterial color="#c56a2d" metalness={0.8} roughness={0.3} />
          </mesh>
        )
      })}
      <Lead from={[-0.2, 0.12, 0]} to={[-1, LEAD_HEIGHT, 0]} />
      <Lead from={[0.2, 0.12, 0]} to={[1, LEAD_HEIGHT, 0]} />
    </group>
  )
}

function Battery({ c }: { c: CircuitComponent }): JSX.Element {
  const bodyMat = useHeatMaterial(c, '#1d1d24')
  return (
    <group>
      {/* 9 V battery lying on its side; + terminal toward terminal 0 */}
      <mesh position={[0, 0.27, 0]} castShadow>
        <boxGeometry args={[1.2, 0.5, 0.75]} />
        <meshStandardMaterial ref={bodyMat} color="#1d1d24" roughness={0.5} />
      </mesh>
      <mesh position={[0.12, 0.27, 0]}>
        <boxGeometry args={[0.7, 0.505, 0.755]} />
        <meshStandardMaterial color="#e8b500" roughness={0.45} />
      </mesh>
      <mesh position={[-0.66, 0.27, 0.16]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.1, 0.1, 0.12, 16]} />
        <meshStandardMaterial {...METAL} />
      </mesh>
      <mesh position={[-0.66, 0.27, -0.16]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.13, 0.13, 0.12, 6]} />
        <meshStandardMaterial {...METAL} />
      </mesh>
      <Lead from={[-0.72, 0.27, 0.16]} to={[-1, LEAD_HEIGHT, 0]} />
      <Lead from={[-0.72, 0.27, -0.16]} to={[-0.85, 0.14, -0.3]} />
      <Lead from={[-0.85, 0.14, -0.3]} to={[0.9, 0.08, -0.45]} radius={0.016} />
      <Lead from={[0.9, 0.08, -0.45]} to={[1, LEAD_HEIGHT, 0]} />
    </group>
  )
}

function CellsPack({ c }: { c: CircuitComponent }): JSX.Element {
  const chem = c.chemistry ?? 'alkaline_9v'
  if (chem === 'alkaline_9v') return <Battery c={c} />
  const bodyMat = useHeatMaterial(c, chem === 'leadacid' ? '#2b2b2b' : chem === 'lifepo4' ? '#1e3a8a' : chem === 'liion' ? '#0e7490' : '#c2410c')
  if (chem === 'leadacid' || chem === 'lifepo4') {
    // block battery with two posts
    return (
      <group>
        <mesh position={[0, 0.35, 0]} castShadow>
          <boxGeometry args={[1.5, 0.7, 0.9]} />
          <meshStandardMaterial ref={bodyMat} color="#2b2b2b" roughness={0.6} />
        </mesh>
        <mesh position={[-0.5, 0.75, 0]}>
          <cylinderGeometry args={[0.08, 0.08, 0.12, 16]} />
          <meshStandardMaterial color="#b91c1c" metalness={0.6} roughness={0.4} />
        </mesh>
        <mesh position={[0.5, 0.75, 0]}>
          <cylinderGeometry args={[0.08, 0.08, 0.12, 16]} />
          <meshStandardMaterial color="#111" metalness={0.6} roughness={0.4} />
        </mesh>
        <Lead from={[-0.5, 0.8, 0]} to={[-1, LEAD_HEIGHT, 0]} />
        <Lead from={[0.5, 0.8, 0]} to={[1, LEAD_HEIGHT, 0]} />
      </group>
    )
  }
  // cylindrical cells in a holder (AA / 18650), up to four drawn
  const n = Math.min(4, Math.max(1, c.cells ?? (chem === 'alkaline_aa' ? 2 : 1)))
  const len = chem === 'liion' ? 0.9 : 0.75
  return (
    <group>
      <mesh position={[0, 0.06, 0]} castShadow>
        <boxGeometry args={[len + 0.25, 0.12, 0.28 * n + 0.1]} />
        <meshStandardMaterial color="#1f2937" roughness={0.7} />
      </mesh>
      {Array.from({ length: n }, (_, k) => (
        <group key={k} position={[0, 0.22, (k - (n - 1) / 2) * 0.28]}>
          <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.12, 0.12, len, 20]} />
            <meshStandardMaterial ref={k === 0 ? bodyMat : undefined} color={chem === 'liion' ? '#0e7490' : '#c2410c'} roughness={0.4} />
          </mesh>
          <mesh position={[-len / 2 - 0.02, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.05, 0.05, 0.04, 12]} />
            <meshStandardMaterial {...METAL} />
          </mesh>
        </group>
      ))}
      <Lead from={[-len / 2 - 0.1, 0.12, 0]} to={[-1, LEAD_HEIGHT, 0]} />
      <Lead from={[len / 2 + 0.1, 0.12, 0]} to={[1, LEAD_HEIGHT, 0]} />
    </group>
  )
}

function BenchSupply({ c }: { c: CircuitComponent }): JSX.Element {
  const textRef = useRef<HTMLSpanElement>(null)
  const ledRef = useRef<THREE.MeshStandardMaterial>(null)
  useFrame(() => {
    const r = displayResult()
    const mode = liveFrame.supplyMode[c.id] ?? 'CV'
    if (ledRef.current) ledRef.current.color.set(mode === 'CC' ? '#ef4444' : '#22c55e')
    if (ledRef.current) ledRef.current.emissive.set(mode === 'CC' ? '#ef4444' : '#22c55e')
    const el = textRef.current
    if (!el) return
    if (!r?.solved) {
      el.textContent = '--.-- V  -.--- A'
      return
    }
    const va = r.nodeVoltages[r.terminalNodes[terminalKey(c.id, 0)]] ?? 0
    const vb = r.nodeVoltages[r.terminalNodes[terminalKey(c.id, 1)]] ?? 0
    el.textContent = `${(va - vb).toFixed(2)} V  ${Math.abs(currentOf(r, c.id)).toFixed(3)} A`
  })
  return (
    <group>
      <mesh position={[0, 0.35, 0]} castShadow>
        <boxGeometry args={[1.5, 0.7, 0.9]} />
        <meshStandardMaterial color="#334155" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.42, 0.451]}>
        <planeGeometry args={[1.0, 0.24]} />
        <meshStandardMaterial color="#04140a" />
      </mesh>
      <Html position={[0, 0.42, 0.46]} transform scale={0.1} occlude={false} zIndexRange={[10, 0]}>
        <span ref={textRef} style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 22, color: '#4ade80', whiteSpace: 'pre' }}>
          --.-- V
        </span>
      </Html>
      <mesh position={[0.6, 0.18, 0.46]}>
        <sphereGeometry args={[0.04, 12, 8]} />
        <meshStandardMaterial ref={ledRef} color="#22c55e" emissive="#22c55e" emissiveIntensity={2} toneMapped={false} />
      </mesh>
      <mesh position={[-0.45, 0.15, 0.46]}>
        <cylinderGeometry args={[0.05, 0.05, 0.06, 12]} />
        <meshStandardMaterial color="#b91c1c" />
      </mesh>
      <mesh position={[-0.25, 0.15, 0.46]}>
        <cylinderGeometry args={[0.05, 0.05, 0.06, 12]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      <Lead from={[-0.75, 0.15, 0]} to={[-1, LEAD_HEIGHT, 0]} />
      <Lead from={[0.75, 0.15, 0]} to={[1, LEAD_HEIGHT, 0]} />
    </group>
  )
}

function SignalGenerator(): JSX.Element {
  return (
    <group>
      <mesh position={[0, 0.3, 0]} castShadow>
        <boxGeometry args={[1.3, 0.6, 0.8]} />
        <meshStandardMaterial color="#2b3242" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.38, 0.401]}>
        <planeGeometry args={[0.8, 0.28]} />
        <meshStandardMaterial color="#0d1f12" emissive="#22c55e" emissiveIntensity={0.6} />
      </mesh>
      <Lead from={[-0.66, 0.15, 0]} to={[-1, LEAD_HEIGHT, 0]} />
      <Lead from={[0.66, 0.15, 0]} to={[1, LEAD_HEIGHT, 0]} />
    </group>
  )
}

function CurrentSource(): JSX.Element {
  return (
    <group>
      <mesh position={[0, 0.3, 0]} castShadow>
        <boxGeometry args={[1.1, 0.55, 0.7]} />
        <meshStandardMaterial color="#3b2f4a" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.58, 0]} rotation={[-Math.PI / 2, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.12, 0.3, 3]} />
        <meshStandardMaterial color="#e8b500" />
      </mesh>
      <Lead from={[-0.56, 0.15, 0]} to={[-1, LEAD_HEIGHT, 0]} />
      <Lead from={[0.56, 0.15, 0]} to={[1, LEAD_HEIGHT, 0]} />
    </group>
  )
}

function Led({ c }: { c: CircuitComponent }): JSX.Element {
  const domeMat = useRef<THREE.MeshStandardMaterial>(null)
  const light = useRef<THREE.PointLight>(null)
  const capMat = useRef<THREE.MeshStandardMaterial>(null)
  useFrame(() => {
    if (capMat.current) capMat.current.emissiveIntensity = c.damaged ? 0 : 0.3 + (domeMat.current?.emissiveIntensity ?? 0) * 0.6
    const m = domeMat.current
    if (!m) return
    if (c.damaged) {
      m.color.set('#2a1414')
      m.emissiveIntensity = 0
      m.opacity = 0.95
      if (light.current) light.current.intensity = 0
      return
    }
    const i = Math.max(0, currentOf(displayResult(), c.id))
    const b = Math.min(1.6, i / 0.02) // 20 mA = full brightness
    m.color.set('#ff3b3b')
    m.emissiveIntensity = 0.05 + b * 5
    m.opacity = 0.75
    if (light.current) light.current.intensity = b * 2.5
  })
  return (
    <group>
      <mesh position={[0, 0.42, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.16, 0.3, 24]} />
        <meshStandardMaterial ref={domeMat} color="#ff3b3b" emissive="#ff2020" transparent opacity={0.75} roughness={0.15} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.57, 0]}>
        <sphereGeometry args={[0.16, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial ref={capMat} color={c.damaged ? '#2a1414' : '#ff6b6b'} emissive="#ff2020" emissiveIntensity={0.3} transparent opacity={0.7} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.27, 0]}>
        <cylinderGeometry args={[0.19, 0.19, 0.04, 24]} />
        <meshStandardMaterial color={c.damaged ? '#1c1917' : '#ff4d4d'} transparent opacity={0.8} />
      </mesh>
      <pointLight ref={light} position={[0, 0.7, 0]} color="#ff3030" intensity={0} distance={3} decay={2} />
      {/* anode (longer) and cathode legs */}
      <Lead from={[-0.07, 0.26, 0]} to={[-1, LEAD_HEIGHT, 0]} />
      <Lead from={[0.07, 0.26, 0]} to={[1, LEAD_HEIGHT, 0]} />
    </group>
  )
}

function Diode({ c }: { c: CircuitComponent }): JSX.Element {
  const bodyMat = useHeatMaterial(c, '#1a1a1a')
  return (
    <group>
      <mesh position={[0, 0.16, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.1, 0.1, 0.5, 20]} />
        <meshStandardMaterial ref={bodyMat} color="#1a1a1a" roughness={0.4} />
      </mesh>
      <mesh position={[0.18, 0.16, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.103, 0.103, 0.06, 20]} />
        <meshStandardMaterial color="#cfd2d6" />
      </mesh>
      <AxialLeads h={0.25} y={0.16} />
    </group>
  )
}

function Lever({ on, base = '#2d2d36', tip = '#e8b500' }: { on: boolean; base?: string; tip?: string }): JSX.Element {
  const ref = useRef<THREE.Group>(null)
  useFrame(() => {
    if (!ref.current) return
    const target = on ? -0.5 : 0.5
    ref.current.rotation.z += (target - ref.current.rotation.z) * 0.25
  })
  return (
    <group position={[0, 0.32, 0]}>
      <mesh castShadow>
        <boxGeometry args={[0.7, 0.18, 0.4]} />
        <meshStandardMaterial color={base} roughness={0.5} />
      </mesh>
      <group ref={ref} position={[0, 0.06, 0]}>
        <mesh position={[0, 0.2, 0]} castShadow>
          <cylinderGeometry args={[0.04, 0.05, 0.4, 12]} />
          <meshStandardMaterial {...METAL} />
        </mesh>
        <mesh position={[0, 0.42, 0]}>
          <sphereGeometry args={[0.07, 16, 12]} />
          <meshStandardMaterial color={tip} />
        </mesh>
      </group>
    </group>
  )
}

function Switch({ c }: { c: CircuitComponent }): JSX.Element {
  return (
    <group>
      <Lever on={!!c.closed} />
      <Lead from={[-0.35, 0.25, 0]} to={[-1, LEAD_HEIGHT, 0]} />
      <Lead from={[0.35, 0.25, 0]} to={[1, LEAD_HEIGHT, 0]} />
    </group>
  )
}

function Breaker({ c }: { c: CircuitComponent }): JSX.Element {
  const gfci = c.type === 'gfci'
  return (
    <group>
      <mesh position={[0, 0.3, 0]} castShadow>
        <boxGeometry args={[0.9, 0.6, 0.6]} />
        <meshStandardMaterial color={gfci ? '#ececec' : '#25252b'} roughness={0.55} />
      </mesh>
      {gfci ? (
        <>
          <mesh position={[-0.18, 0.61, 0]}>
            <boxGeometry args={[0.22, 0.04, 0.14]} />
            <meshStandardMaterial color="#d32f2f" />
          </mesh>
          <mesh position={[0.18, 0.61, 0]}>
            <boxGeometry args={[0.22, 0.04, 0.14]} />
            <meshStandardMaterial color={c.closed ? '#22c55e' : '#111'} emissive={c.closed ? '#22c55e' : '#000'} emissiveIntensity={0.8} />
          </mesh>
        </>
      ) : (
        <group position={[0, 0.3, 0]}>
          <Lever on={!!c.closed} base="#25252b" tip={c.closed ? '#e5e7eb' : '#ef4444'} />
        </group>
      )}
      <Lead from={[-0.45, 0.12, 0]} to={[-1, LEAD_HEIGHT, 0]} />
      <Lead from={[0.45, 0.12, 0]} to={[1, LEAD_HEIGHT, 0]} />
    </group>
  )
}

function Meter({ c }: { c: CircuitComponent }): JSX.Element {
  const textRef = useRef<HTMLSpanElement>(null)
  useFrame(() => {
    const el = textRef.current
    if (!el) return
    const r = displayResult()
    if (!r?.solved) {
      el.textContent = '----'
      return
    }
    if (c.damaged) {
      el.textContent = 'FUSE'
      return
    }
    if (c.type === 'ammeter') {
      el.textContent = formatValue(Math.abs(currentOf(r, c.id)), 'A')
    } else {
      const va = r.nodeVoltages[r.terminalNodes[terminalKey(c.id, 0)]] ?? 0
      const vb = r.nodeVoltages[r.terminalNodes[terminalKey(c.id, 1)]] ?? 0
      el.textContent = formatValue(va - vb, 'V')
    }
  })
  return (
    <group>
      <mesh position={[0, 0.12, 0]} castShadow>
        <boxGeometry args={[0.9, 0.24, 1.2]} />
        <meshStandardMaterial color={c.type === 'ammeter' ? '#c2410c' : '#ca8a04'} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.245, -0.2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.7, 0.35]} />
        <meshStandardMaterial color="#9fb39a" />
      </mesh>
      <Html position={[0, 0.26, -0.2]} transform rotation={[-Math.PI / 2, 0, 0]} scale={0.18} occlude={false} zIndexRange={[10, 0]}>
        <span ref={textRef} style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 22, fontWeight: 700, color: '#111', whiteSpace: 'nowrap' }}>
          ----
        </span>
      </Html>
      <Lead from={[-0.3, 0.25, 0.4]} to={[-1, LEAD_HEIGHT, 0]} />
      <Lead from={[0.3, 0.25, 0.4]} to={[1, LEAD_HEIGHT, 0]} />
    </group>
  )
}

function Ground(): JSX.Element {
  return (
    <group>
      <mesh position={[0, 0.1, 0.3]} castShadow>
        <cylinderGeometry args={[0.03, 0.03, 0.3, 8]} />
        <meshStandardMaterial {...METAL} />
      </mesh>
      {[0.32, 0.22, 0.12].map((w, i) => (
        <mesh key={i} position={[0, 0.03 + i * 0.001, 0.45 + i * 0.08]}>
          <boxGeometry args={[w * 1.6, 0.03, 0.04]} />
          <meshStandardMaterial color="#16a34a" />
        </mesh>
      ))}
    </group>
  )
}

function Transformer(): JSX.Element {
  return (
    <group>
      <mesh position={[0, 0.4, 0]} castShadow>
        <boxGeometry args={[0.9, 0.8, 0.7]} />
        <meshStandardMaterial color="#4b5563" metalness={0.5} roughness={0.5} />
      </mesh>
      {[-0.42, 0.42].map((x) => (
        <mesh key={x} position={[x, 0.4, 0]} rotation={[0, 0, 0]} castShadow>
          <cylinderGeometry args={[0.24, 0.24, 0.6, 24]} />
          <meshStandardMaterial color="#b45309" metalness={0.7} roughness={0.35} />
        </mesh>
      ))}
      <Lead from={[-0.6, 0.15, -0.3]} to={[-1, LEAD_HEIGHT, -0.5]} />
      <Lead from={[-0.6, 0.15, 0.3]} to={[-1, LEAD_HEIGHT, 0.5]} />
      <Lead from={[0.6, 0.15, -0.3]} to={[1, LEAD_HEIGHT, -0.5]} />
      <Lead from={[0.6, 0.15, 0.3]} to={[1, LEAD_HEIGHT, 0.5]} />
    </group>
  )
}

function Transistor(): JSX.Element {
  return (
    <group>
      <mesh position={[0.2, 0.35, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.2, 0.4, 24, 1, false, 0, Math.PI]} />
        <meshStandardMaterial color="#111" roughness={0.4} />
      </mesh>
      <Lead from={[0.2, 0.15, 0]} to={[-1, LEAD_HEIGHT, 0]} />
      <Lead from={[0.2, 0.15, -0.1]} to={[1, LEAD_HEIGHT, -1]} />
      <Lead from={[0.2, 0.15, 0.1]} to={[1, LEAD_HEIGHT, 1]} />
    </group>
  )
}

function SolderJoint(): JSX.Element {
  return (
    <mesh position={[0, 0.06, 0]}>
      <sphereGeometry args={[0.07, 12, 8]} />
      <meshStandardMaterial color="#cbd0d6" metalness={0.9} roughness={0.25} />
    </mesh>
  )
}

function Model({ c }: { c: CircuitComponent }): JSX.Element | null {
  switch (c.type) {
    case 'resistor': return <Resistor c={c} />
    case 'capacitor': return <Capacitor c={c} />
    case 'inductor': return <Inductor c={c} />
    case 'voltage_source': return <Battery c={c} />
    case 'battery': return <CellsPack c={c} />
    case 'bench_supply': return <BenchSupply c={c} />
    case 'ac_voltage_source': return <SignalGenerator />
    case 'current_source': return <CurrentSource />
    case 'led': return <Led c={c} />
    case 'diode': return <Diode c={c} />
    case 'switch': return <Switch c={c} />
    case 'breaker':
    case 'gfci': return <Breaker c={c} />
    case 'voltmeter':
    case 'ammeter': return <Meter c={c} />
    case 'ground': return <Ground />
    case 'transformer': return <Transformer />
    case 'transistor_npn': return <Transistor />
    case 'wire_node': return <SolderJoint />
    default: return null
  }
}

// ── Placed part (position, selection, interaction, label) ─────────────────────

export function Part({ c, selected, showLabels }: { c: CircuitComponent; selected: boolean; showLabels: boolean }): JSX.Element {
  const [x, , z] = toWorld(c.x, c.y)
  const def = ELEMENTS[c.type]
  const selectComponent = useCircuitStore((s) => s.selectComponent)
  const toggleSwitch = useCircuitStore((s) => s.toggleSwitch)
  const toggleable = c.type === 'switch' || c.type === 'breaker' || c.type === 'gfci'
  const pads = useMemo(() => {
    const out: [number, number][] = []
    for (const t of def.terminals) out.push([t.x / 40, t.y / 40])
    return out
  }, [def])

  const lastTap = useRef(0)
  const onClick = (e: ThreeEvent<MouseEvent>): void => {
    e.stopPropagation()
    selectComponent(c.id)
    // Touch screens don't reliably fire dblclick: treat two quick taps as one
    const touch = (e.nativeEvent as PointerEvent).pointerType === 'touch'
    if (touch && toggleable) {
      const now = performance.now()
      if (now - lastTap.current < 350) {
        toggleSwitch(c.id)
        lastTap.current = 0
      } else lastTap.current = now
    }
  }
  const onDoubleClick = (e: ThreeEvent<MouseEvent>): void => {
    e.stopPropagation()
    if (toggleable) toggleSwitch(c.id)
  }
  const valueText =
    c.value !== undefined && def.defaultValue !== null && c.type !== 'breaker' && c.type !== 'gfci'
      ? formatValue(c.value, def.unit)
      : ''

  return (
    <group position={[x, 0, z]} rotation={[0, toWorldRotation(c.rotation), 0]} onClick={onClick} onDoubleClick={onDoubleClick}>
      {c.type !== 'wire_node' && c.type !== 'ground' && <Pads points={pads} />}
      <Model c={c} />
      {selected && (
        <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.95, 1.05, 48]} />
          <meshBasicMaterial color="#E8B500" transparent opacity={0.85} />
        </mesh>
      )}
      {showLabels && c.type !== 'wire_node' && c.type !== 'ground' && (
        <Html position={[0, 1.05, 0]} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
          <div
            style={{
              fontFamily: 'Inter, system-ui, sans-serif',
              fontSize: 11,
              whiteSpace: 'nowrap',
              padding: '1px 6px',
              borderRadius: 6,
              background: c.damaged ? 'rgba(127,29,29,0.85)' : 'rgba(15,15,26,0.72)',
              color: c.damaged ? '#fecaca' : '#e5e7eb',
              border: selected ? '1px solid #E8B500' : '1px solid rgba(255,255,255,0.12)'
            }}
          >
            {c.label ?? def.displayName}
            {valueText && <span style={{ color: '#E8B500' }}> · {valueText}</span>}
            {c.damaged && ' · burnt'}
          </div>
        </Html>
      )}
    </group>
  )
}

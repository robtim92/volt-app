/**
 * Placeholder 3D house for H1: one open-topped box per room on a slab. A room
 * lights up warm while its lighting is running and glows by how much power
 * it's drawing; a room whose circuit has tripped goes dark with a red floor.
 * The detailed house (roof, panels, moving sun) comes with H3 solar.
 */
import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Html, OrbitControls } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'
import { homeLive, useHomeStore } from '@stores/homeStore'
import { APPLIANCES } from '../../home/appliances'
import type { HomeDesign } from '../../home/types'

const ROOM_W = 4
const ROOM_D = 3.4
const WALL_H = 1.1

interface RoomInfo {
  name: string
  x: number
  z: number
  circuitIds: string[]
}

function layoutRooms(d: HomeDesign): RoomInfo[] {
  const names = [...new Set(d.circuits.map((c) => c.room))]
  const cols = Math.min(3, Math.max(1, Math.ceil(Math.sqrt(names.length))))
  return names.map((name, i) => ({
    name,
    x: (i % cols) * ROOM_W - ((cols - 1) * ROOM_W) / 2,
    z: Math.floor(i / cols) * ROOM_D - ((Math.ceil(names.length / cols) - 1) * ROOM_D) / 2,
    circuitIds: d.circuits.filter((c) => c.room === name).map((c) => c.id)
  }))
}

function Room({ room }: { room: RoomInfo }): JSX.Element {
  const floor = useRef<THREE.MeshStandardMaterial>(null)
  const lamp = useRef<THREE.MeshStandardMaterial>(null)
  const light = useRef<THREE.PointLight>(null)
  const label = useRef<HTMLDivElement>(null)
  useFrame(() => {
    const d = useHomeStore.getState().design
    const rt = homeLive.runtime
    const circuits = d.circuits.filter((c) => room.circuitIds.includes(c.id))
    const tripped = d.mainState === 'tripped' || circuits.some((c) => c.state === 'tripped')
    let lit = 0
    let watts = 0
    for (const c of circuits) {
      watts += rt.readings[c.id]?.watts ?? 0
      for (const l of c.loads) if (rt.loadRunning[l.id] && APPLIANCES[l.appliance]?.lighting) lit += APPLIANCES[l.appliance].watts
    }
    const glow = Math.min(1, lit / 150)
    if (lamp.current) lamp.current.emissiveIntensity = glow * 3
    if (light.current) light.current.intensity = glow * 6
    if (floor.current) {
      floor.current.color.set(tripped ? '#7f1d1d' : '#d6d3d1')
      floor.current.emissive.set(tripped ? '#ef4444' : '#f59e0b')
      floor.current.emissiveIntensity = tripped ? 0.35 : Math.min(0.25, watts / 20000)
    }
    if (label.current) label.current.textContent = `${room.name}${tripped ? ' · TRIPPED' : watts > 1 ? ` · ${watts >= 1000 ? (watts / 1000).toFixed(1) + ' kW' : Math.round(watts) + ' W'}` : ''}`
  })
  const wallMat = <meshStandardMaterial color="#e7e5e4" roughness={0.9} />
  return (
    <group position={[room.x, 0, room.z]}>
      <mesh position={[0, 0.02, 0]} receiveShadow>
        <boxGeometry args={[ROOM_W - 0.1, 0.04, ROOM_D - 0.1]} />
        <meshStandardMaterial ref={floor} color="#d6d3d1" roughness={0.8} />
      </mesh>
      {/* back and side walls only, so we can see in */}
      <mesh position={[0, WALL_H / 2, -ROOM_D / 2 + 0.05]} castShadow>
        <boxGeometry args={[ROOM_W - 0.1, WALL_H, 0.1]} />
        {wallMat}
      </mesh>
      <mesh position={[-ROOM_W / 2 + 0.05, WALL_H / 2, 0]} castShadow>
        <boxGeometry args={[0.1, WALL_H, ROOM_D - 0.1]} />
        {wallMat}
      </mesh>
      {/* ceiling lamp */}
      <mesh position={[0, WALL_H + 0.1, 0]}>
        <sphereGeometry args={[0.16, 16, 12]} />
        <meshStandardMaterial ref={lamp} color="#fff7e0" emissive="#ffcf70" emissiveIntensity={0} toneMapped={false} />
      </mesh>
      <pointLight ref={light} position={[0, WALL_H, 0]} color="#ffd59a" intensity={0} distance={5} decay={1.6} />
      <Html position={[0, 0.1, ROOM_D / 2 - 0.3]} center zIndexRange={[10, 0]}>
        <div ref={label} className="whitespace-nowrap text-[11px] font-medium px-1.5 py-0.5 rounded bg-black/60 text-white pointer-events-none">
          {room.name}
        </div>
      </Html>
    </group>
  )
}

export default function House3D(): JSX.Element {
  const design = useHomeStore((s) => s.design)
  const roomsKey = design.circuits.map((c) => `${c.id}:${c.room}`).join('|')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const rooms = useMemo(() => layoutRooms(design), [roomsKey])
  const span = Math.max(8, ...rooms.map((r) => Math.hypot(r.x, r.z) * 2 + 6))
  return (
    <div className="w-full h-full min-h-[260px] rounded-lg overflow-hidden" data-testid="house-3d">
      <Canvas shadows dpr={[1, 2]} camera={{ position: [span * 0.55, span * 0.75, span * 0.85], fov: 40 }}>
        <color attach="background" args={['#0c0c14']} />
        <ambientLight intensity={0.25} />
        <directionalLight position={[6, 10, 4]} intensity={0.5} castShadow />
        <mesh position={[0, -0.05, 0]} receiveShadow>
          <boxGeometry args={[span * 1.4, 0.1, span * 1.2]} />
          <meshStandardMaterial color="#1f2a1f" roughness={1} />
        </mesh>
        {rooms.map((r) => (
          <Room key={r.name} room={r} />
        ))}
        <OrbitControls makeDefault enablePan={false} maxPolarAngle={Math.PI / 2.2} />
        <EffectComposer>
          <Bloom intensity={0.6} luminanceThreshold={0.6} mipmapBlur />
        </EffectComposer>
      </Canvas>
    </div>
  )
}

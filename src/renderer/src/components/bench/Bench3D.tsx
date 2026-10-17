/**
 * Volt — 3D workbench view
 *
 * A live, physical rendering of the same circuit the schematic edits: parts on
 * a cutting mat, insulated jumpers with flowing charge, LEDs that actually
 * light the bench, resistors that glow and smoke when overloaded, sparks when
 * something fails. Click a part to inspect it; double-click a switch, breaker
 * or GFCI to flip it. Orbit with left-drag, pan with right-drag, zoom with the
 * wheel.
 *
 * Lazy-loaded (React.lazy) so three.js stays out of the main bundle and tests.
 */
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, ContactShadows } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import * as THREE from 'three'
import { useCircuitStore } from '@stores/circuitStore'
import { Part } from './Parts3D'
import Wires3D from './Wires3D'
import Effects3D from './Effects3D'
import { circuitBounds } from './benchMath'

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch {
    return false
  }
}

function Desk(): JSX.Element {
  const matTexture = useMemo(() => {
    const size = 512
    const cv = document.createElement('canvas')
    cv.width = size
    cv.height = size
    const g = cv.getContext('2d')!
    g.fillStyle = '#1f4d3a'
    g.fillRect(0, 0, size, size)
    g.strokeStyle = 'rgba(255,255,255,0.10)'
    g.lineWidth = 1
    for (let i = 0; i <= size; i += size / 16) {
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i, size); g.stroke()
      g.beginPath(); g.moveTo(0, i); g.lineTo(size, i); g.stroke()
    }
    g.strokeStyle = 'rgba(255,255,255,0.22)'
    g.lineWidth = 2
    for (let i = 0; i <= size; i += size / 4) {
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i, size); g.stroke()
      g.beginPath(); g.moveTo(0, i); g.lineTo(size, i); g.stroke()
    }
    const tex = new THREE.CanvasTexture(cv)
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(8, 8)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 8
    return tex
  }, [])
  return (
    <group>
      {/* wooden desk */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#3b2a1e" roughness={0.85} />
      </mesh>
      {/* self-healing cutting mat */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[64, 64]} />
        <meshStandardMaterial map={matTexture} roughness={0.9} />
      </mesh>
    </group>
  )
}

/** Moves the camera to frame the circuit when `token` changes. */
function Framer({ token, controls }: { token: number; controls: React.RefObject<OrbitControlsImpl> }): null {
  const { camera, size } = useThree()
  useEffect(() => {
    const { components } = useCircuitStore.getState()
    const b = circuitBounds(components)
    const fov = ((camera as THREE.PerspectiveCamera).fov * Math.PI) / 180
    const aspect = size.width / Math.max(1, size.height)
    // distance that fits the circuit vertically, widened for narrow viewports
    const fit = (b.size / 2 + 0.8) / Math.tan(fov / 2)
    const dist = (fit / Math.min(1, aspect)) * 1.05
    camera.position.set(b.center[0], dist * 0.82, b.center[2] + dist * 0.6)
    controls.current?.target.set(b.center[0], 0, b.center[2])
    controls.current?.update()
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // re-frame when the viewport shape changes noticeably (e.g. split ↔ full)
  }, [token, Math.round((size.width / Math.max(1, size.height)) * 3)])
  return null
}

export default function Bench3D(): JSX.Element {
  const components = useCircuitStore((s) => s.components)
  const wires = useCircuitStore((s) => s.wires)
  const selectedIds = useCircuitStore((s) => s.selectedIds)
  const clearSelection = useCircuitStore((s) => s.clearSelection)
  const [labels, setLabels] = useState(true)
  const [frameToken, setFrameToken] = useState(0)
  const controls = useRef<OrbitControlsImpl>(null)
  const webgl = useMemo(hasWebGL, [])
  const selected = new Set(selectedIds)

  // Re-frame when a whole new circuit is loaded (component count jumps from 0)
  const count = components.length
  const prevCount = useRef(count)
  useEffect(() => {
    if (prevCount.current === 0 && count > 0) setFrameToken((t) => t + 1)
    prevCount.current = count
  }, [count])

  if (!webgl) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-gray-400 p-6 text-center">
        3D view needs WebGL, which isn’t available in this browser. The schematic view still works.
      </div>
    )
  }

  return (
    <div className="relative h-full w-full bg-[#0c0c14]" data-testid="bench-3d">
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [4, 9, 10], fov: 40, near: 0.1, far: 400 }}
        gl={{ antialias: true }}
        onPointerMissed={() => clearSelection()}
      >
        <color attach="background" args={['#0c0c14']} />
        <fog attach="fog" args={['#0c0c14', 30, 90]} />
        <hemisphereLight args={['#dfe7ff', '#2a1d14', 0.55]} />
        <directionalLight
          position={[8, 14, 6]}
          intensity={1.6}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-20}
          shadow-camera-right={20}
          shadow-camera-top={20}
          shadow-camera-bottom={-20}
        />
        <directionalLight position={[-10, 6, -8]} intensity={0.35} color="#9db4ff" />
        <Suspense fallback={null}>
          <Desk />
          <ContactShadows position={[0, 0.005, 0]} opacity={0.45} scale={60} blur={2.4} far={4} />
          {components.map((c) => (
            <Part key={c.id} c={c} selected={selected.has(c.id)} showLabels={labels} />
          ))}
          <Wires3D components={components} wires={wires} />
          <Effects3D components={components} />
        </Suspense>
        <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={0.12} maxPolarAngle={Math.PI / 2.15} minDistance={2} maxDistance={80} />
        <Framer token={frameToken} controls={controls} />
        <EffectComposer multisampling={4}>
          <Bloom intensity={1.1} luminanceThreshold={0.85} luminanceSmoothing={0.2} mipmapBlur />
          <Vignette eskil={false} offset={0.2} darkness={0.55} />
        </EffectComposer>
      </Canvas>

      <div className="absolute top-2 right-2 flex gap-1.5">
        <button
          onClick={() => setLabels((l) => !l)}
          className={`px-2 py-1 text-xs rounded ${labels ? 'bg-brand-yellow/25 text-brand-yellow' : 'bg-white/10 text-gray-300'} hover:bg-white/20`}
        >
          Labels
        </button>
        <button onClick={() => setFrameToken((t) => t + 1)} className="px-2 py-1 text-xs rounded bg-white/10 text-gray-300 hover:bg-white/20">
          Frame circuit
        </button>
      </div>
      <p className="absolute bottom-2 left-3 text-[11px] text-gray-500 pointer-events-none">
        Drag to orbit · right-drag to pan · scroll to zoom · click a part to inspect · double-click a switch to flip it
      </p>
    </div>
  )
}

'use client'

import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'

const ORBITS = [
  { radius: 2.2, speed: 0.35, inc: 0.40,  phase: 0.0 },
  { radius: 2.8, speed: 0.28, inc: -0.60, phase: 1.3 },
  { radius: 1.8, speed: 0.45, inc: 0.80,  phase: 2.6 },
  { radius: 3.1, speed: 0.22, inc: -0.30, phase: 3.9 },
  { radius: 2.4, speed: 0.38, inc: 0.55,  phase: 5.2 },
] as const

const PACKET_TARGETS = [0, 2, 3]

function Scene() {
  const hostRef = useRef<THREE.Mesh | null>(null)
  const workerMeshes = useRef<(THREE.Mesh | null)[]>(Array(ORBITS.length).fill(null))
  const packetMeshes = useRef<(THREE.Mesh | null)[]>(Array(PACKET_TARGETS.length).fill(null))

  // Thin lines host→worker, updated per frame
  const connectionLines = useMemo(() =>
    ORBITS.map(() => {
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3))
      const mat = new THREE.LineBasicMaterial({
        color: new THREE.Color('#EF8354'),
        transparent: true,
        opacity: 0.28,
      })
      return new THREE.Line(geo, mat)
    }), []
  )

  // Orbit rings: full-circle path for each orbit, very low opacity
  // Gives the "solar system orrery diagram" feel
  const orbitRings = useMemo(() =>
    ORBITS.map((orbit) => {
      const segments = 96
      const pts = new Float32Array((segments + 1) * 3)
      for (let j = 0; j <= segments; j++) {
        const a = (j / segments) * Math.PI * 2
        pts[j * 3 + 0] = Math.cos(a) * orbit.radius
        pts[j * 3 + 1] = Math.sin(orbit.inc) * Math.sin(a) * orbit.radius
        pts[j * 3 + 2] = Math.sin(a) * Math.cos(orbit.inc) * orbit.radius
      }
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(pts, 3))
      const mat = new THREE.LineBasicMaterial({
        color: new THREE.Color('#8B6B5E'),
        transparent: true,
        opacity: 0.10,
      })
      return new THREE.Line(geo, mat)
    }), []
  )

  useFrame(({ clock }) => {
    const t = clock.elapsedTime

    // Slowly rotate host on its own axis (icosahedron looks great spinning)
    if (hostRef.current) {
      hostRef.current.rotation.y = t * 0.15
      hostRef.current.rotation.x = t * 0.07
    }

    ORBITS.forEach((orbit, i) => {
      const mesh = workerMeshes.current[i]
      if (!mesh) return

      const angle = t * orbit.speed + orbit.phase
      mesh.position.set(
        Math.cos(angle) * orbit.radius,
        Math.sin(orbit.inc) * Math.sin(angle) * orbit.radius,
        Math.sin(angle) * Math.cos(orbit.inc) * orbit.radius
      )

      // Self-rotation on each worker — each has a slightly different axis
      mesh.rotation.y += 0.009 + i * 0.001
      mesh.rotation.z += 0.005

      // Update connection line endpoint
      const line = connectionLines[i]
      if (line) {
        const attr = line.geometry.attributes.position as THREE.BufferAttribute
        attr.setXYZ(1, mesh.position.x, mesh.position.y, mesh.position.z)
        attr.needsUpdate = true
      }
    })

    // Data packets: host → worker, staggered per packet
    PACKET_TARGETS.forEach((orbitIdx, i) => {
      const packet = packetMeshes.current[i]
      const worker = workerMeshes.current[orbitIdx]
      if (!packet || !worker) return

      const progress = (t * 0.18 + i * 0.38) % 1
      if (progress > 0.5) {
        packet.visible = false
        return
      }
      packet.visible = true
      const frac = progress / 0.5
      packet.position.set(
        worker.position.x * frac,
        worker.position.y * frac,
        worker.position.z * frac
      )
    })
  })

  return (
    <>
      <ambientLight intensity={0.5} color="#FFF4E8" />
      <directionalLight position={[5, 7, 4]} intensity={1.4} color="#FFE8D0" />
      {/* Warm fill from below for richness */}
      <pointLight position={[0, -4, 2]} intensity={0.6} color="#C8643A" />
      {/* Host glow */}
      <pointLight position={[0, 0, 0]} intensity={2.2} color="#EF8354" distance={5} />

      {/* Orbit rings — the orrery diagram */}
      {orbitRings.map((ring, i) => (
        <primitive key={i} object={ring} />
      ))}

      {/* Host node — icosahedron for a sculptural, crystalline look */}
      <mesh ref={(el: THREE.Mesh | null) => { hostRef.current = el }} position={[0, 0, 0]}>
        <icosahedronGeometry args={[0.58, 1]} />
        <meshStandardMaterial
          color="#1A0905"
          emissive="#EF8354"
          emissiveIntensity={0.95}
          roughness={0.05}
          metalness={0.45}
        />
      </mesh>

      {/* Worker nodes — alternate between dodecahedron and octahedron for variety */}
      {ORBITS.map((_, i) => (
        <mesh
          key={i}
          ref={(el: THREE.Mesh | null) => { workerMeshes.current[i] = el }}
        >
          {i % 2 === 0
            ? <dodecahedronGeometry args={[0.26, 0]} />
            : <octahedronGeometry args={[0.28, 0]} />
          }
          <meshStandardMaterial
            color="#3D2A25"
            emissive="#EF8354"
            emissiveIntensity={0.35}
            roughness={0.2}
            metalness={0.2}
          />
        </mesh>
      ))}

      {/* Connection lines */}
      {connectionLines.map((line, i) => (
        <primitive key={i} object={line} />
      ))}

      {/* Data packet indicators */}
      {PACKET_TARGETS.map((_, i) => (
        <mesh
          key={i}
          ref={(el: THREE.Mesh | null) => { packetMeshes.current[i] = el }}
        >
          <sphereGeometry args={[0.07, 8, 8]} />
          <meshStandardMaterial
            color="#EF8354"
            emissive="#EF8354"
            emissiveIntensity={6}
          />
        </mesh>
      ))}

      <OrbitControls
        enableZoom={false}
        enablePan={false}
        autoRotate
        autoRotateSpeed={0.3}
      />
    </>
  )
}

export default function ClusterOrb() {
  return (
    <div style={{ width: '100%', height: '100%', pointerEvents: 'none' }}>
      <Canvas
        camera={{ position: [0, 2.5, 9], fov: 52 }}
        onCreated={({ gl }) => {
          gl.setClearColor(new THREE.Color('#EDE5D8'), 1)
        }}
      >
        <fog attach="fog" args={['#EDE5D8', 14, 28]} />
        <Scene />
      </Canvas>
    </div>
  )
}

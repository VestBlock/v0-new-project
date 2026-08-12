"use client"

import { Edges, Line, useTexture } from "@react-three/drei"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { Bloom, EffectComposer, Noise, Vignette } from "@react-three/postprocessing"
import type { MutableRefObject } from "react"
import { Suspense, useEffect, useMemo, useRef, useState } from "react"
import * as THREE from "three"

type LaneKey = "capital" | "deals" | "opportunity"

type HeroFilmProps = {
  progressRef: MutableRefObject<number>
  pointerRef: MutableRefObject<{ x: number; y: number }>
  activeLane: LaneKey
}

type CameraBeat = {
  at: number
  position: THREE.Vector3
  target: THREE.Vector3
}

const cameraBeats: CameraBeat[] = [
  { at: 0, position: new THREE.Vector3(7.6, 5.1, 13.5), target: new THREE.Vector3(0, 1.35, 0) },
  { at: 0.18, position: new THREE.Vector3(8.7, 3.7, 9.5), target: new THREE.Vector3(0, 1.4, 0.1) },
  { at: 0.38, position: new THREE.Vector3(-7.1, 4.6, 8.7), target: new THREE.Vector3(0, 1.8, 0) },
  { at: 0.58, position: new THREE.Vector3(-2.8, 7.4, 12.2), target: new THREE.Vector3(0, 0.9, 0) },
  { at: 0.78, position: new THREE.Vector3(5.5, 3.5, 10.5), target: new THREE.Vector3(0, 1.5, 0) },
  { at: 1, position: new THREE.Vector3(7.2, 4.9, 13.1), target: new THREE.Vector3(0, 1.5, 0) },
]

const propertyVolumes: Array<{ position: [number, number, number]; scale: [number, number, number] }> = [
  { position: [-1.95, 0.6, -0.85], scale: [0.72, 1.2, 1.05] },
  { position: [-1.08, 1.1, -0.92], scale: [0.74, 2.2, 0.96] },
  { position: [-0.2, 0.78, -0.82], scale: [0.85, 1.56, 1.18] },
  { position: [0.77, 1.32, -0.78], scale: [0.86, 2.64, 1.06] },
  { position: [1.68, 0.84, -0.83], scale: [0.7, 1.68, 0.95] },
  { position: [-1.44, 0.37, 0.45], scale: [0.68, 0.74, 0.92] },
  { position: [-0.57, 0.59, 0.35], scale: [0.72, 1.18, 0.88] },
  { position: [0.3, 0.42, 0.4], scale: [0.74, 0.84, 0.88] },
  { position: [1.15, 0.76, 0.44], scale: [0.64, 1.52, 0.92] },
  { position: [2.0, 0.34, 0.44], scale: [0.58, 0.68, 0.88] },
]

const laneColors: Record<LaneKey, THREE.ColorRepresentation> = {
  capital: "#d8ff75",
  deals: "#b7ff3c",
  opportunity: "#8edbff",
}

const scanVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uProgress;
  varying vec2 vUv;
  varying float vNoise;

  void main() {
    vUv = uv;
    vec3 transformed = position;
    float wave = sin(position.x * 2.4 + uTime * 1.2) * 0.06;
    transformed.z += wave * (0.25 + uProgress * 0.75);
    vNoise = wave;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
  }
`

const scanFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uProgress;
  uniform vec3 uColor;
  varying vec2 vUv;
  varying float vNoise;

  void main() {
    float travel = fract(uProgress * 3.0 - vUv.y * 1.25);
    float scan = smoothstep(0.76, 1.0, travel) * smoothstep(0.0, 0.22, travel);
    float gridX = smoothstep(0.94, 1.0, sin(vUv.x * 70.0) * 0.5 + 0.5);
    float gridY = smoothstep(0.97, 1.0, sin(vUv.y * 42.0) * 0.5 + 0.5);
    float field = (gridX + gridY * 0.65) * 0.18;
    float shimmer = sin(vUv.x * 27.0 + vUv.y * 12.0 + uTime) * 0.035;
    float alpha = (scan * 0.38 + field + shimmer) * smoothstep(0.10, 0.9, uProgress) * (1.0 - smoothstep(0.82, 1.0, uProgress));
    gl_FragColor = vec4(uColor, alpha);
  }
`

function saturate(value: number) {
  return Math.min(1, Math.max(0, value))
}

function smoothstep(edge0: number, edge1: number, value: number) {
  const t = saturate((value - edge0) / (edge1 - edge0))
  return t * t * (3 - 2 * t)
}

function cameraForProgress(progress: number) {
  let nextIndex = cameraBeats.findIndex((beat) => beat.at >= progress)
  if (nextIndex < 0) nextIndex = cameraBeats.length - 1
  const to = cameraBeats[nextIndex]
  const from = cameraBeats[Math.max(0, nextIndex - 1)]
  const range = Math.max(0.001, to.at - from.at)
  const amount = smoothstep(0, 1, (progress - from.at) / range)
  return {
    position: from.position.clone().lerp(to.position, amount),
    target: from.target.clone().lerp(to.target, amount),
  }
}

function DataScanMaterial({ progressRef, activeLane }: Pick<HeroFilmProps, "progressRef" | "activeLane">) {
  const materialRef = useRef<THREE.ShaderMaterial>(null)
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uProgress: { value: 0 },
    uColor: { value: new THREE.Color("#b7ff3c") },
  }), [])

  useFrame((state) => {
    const material = materialRef.current
    if (!material) return
    material.uniforms.uTime.value = state.clock.elapsedTime
    material.uniforms.uProgress.value = progressRef.current
    material.uniforms.uColor.value.set(laneColors[activeLane])
  })

  return (
    <shaderMaterial
      ref={materialRef}
      uniforms={uniforms}
      vertexShader={scanVertexShader}
      fragmentShader={scanFragmentShader}
      transparent
      depthWrite={false}
      blending={THREE.AdditiveBlending}
      side={THREE.DoubleSide}
    />
  )
}

function PropertyFilm({ progressRef, pointerRef, activeLane }: HeroFilmProps) {
  const propertyRef = useRef<THREE.Group>(null)
  const routeRef = useRef<THREE.Group>(null)
  const vaultRef = useRef<THREE.Group>(null)
  const markRef = useRef<THREE.Mesh>(null)
  const sourceMarkTexture = useTexture("/brand/vestblock-monogram.png")
  const markTexture = useMemo(() => {
    const texture = sourceMarkTexture.clone()
    texture.colorSpace = THREE.SRGBColorSpace
    texture.needsUpdate = true
    return texture
  }, [sourceMarkTexture])
  const routeCurve = useMemo(
    () => new THREE.CatmullRomCurve3([
      new THREE.Vector3(-2.5, 0.4, 0.35),
      new THREE.Vector3(-1.25, 2.6, -0.2),
      new THREE.Vector3(0.25, 1.1, 0.05),
      new THREE.Vector3(2.65, 2.3, 0.4),
      new THREE.Vector3(4.7, 0.75, -0.8),
    ]),
    [],
  )
  const routeNodes = useMemo(() => [
    new THREE.Vector3(-2.5, 0.4, 0.35),
    new THREE.Vector3(-1.25, 2.6, -0.2),
    new THREE.Vector3(0.25, 1.1, 0.05),
    new THREE.Vector3(2.65, 2.3, 0.4),
    new THREE.Vector3(4.7, 0.75, -0.8),
  ], [])
  const { camera } = useThree()

  useEffect(() => () => markTexture.dispose(), [markTexture])

  useFrame((state, delta) => {
    const progress = progressRef.current
    const pointer = pointerRef.current
    const shot = cameraForProgress(progress)
    const cameraWeight = 1 - Math.exp(-delta * 3.2)
    camera.position.lerp(shot.position, cameraWeight)
    camera.lookAt(shot.target)

    const reveal = smoothstep(0.02, 0.34, progress)
    const routeProgress = smoothstep(0.42, 0.73, progress)
    const vaultProgress = smoothstep(0.66, 0.9, progress)
    const time = state.clock.elapsedTime

    if (propertyRef.current) {
      propertyRef.current.rotation.y = THREE.MathUtils.damp(
        propertyRef.current.rotation.y,
        -0.28 + progress * 0.82 + pointer.x * 0.32,
        4,
        delta,
      )
      propertyRef.current.rotation.x = THREE.MathUtils.damp(propertyRef.current.rotation.x, pointer.y * 0.08, 4, delta)
      propertyRef.current.position.y = Math.sin(time * 0.42) * 0.045 - vaultProgress * 0.42
      propertyRef.current.scale.setScalar(1 - vaultProgress * 0.4)
    }

    if (routeRef.current) {
      routeRef.current.scale.x = (0.15 + routeProgress * 0.85) * (1 - vaultProgress * 0.38)
      routeRef.current.scale.y = (0.82 + routeProgress * 0.18) * (1 - vaultProgress * 0.24)
      routeRef.current.rotation.z = Math.sin(time * 0.35) * 0.016
      routeRef.current.visible = routeProgress > 0.02
    }

    if (vaultRef.current) {
      vaultRef.current.scale.setScalar(0.62 + vaultProgress * 0.52)
      vaultRef.current.rotation.y = -0.45 + vaultProgress * 0.75
      vaultRef.current.position.y = -0.2 + vaultProgress * 1.32
      vaultRef.current.position.z = 0.2 + vaultProgress * 0.9
      vaultRef.current.visible = vaultProgress > 0.01
    }

    if (markRef.current) {
      if (markRef.current.material instanceof THREE.MeshBasicMaterial) {
        markRef.current.material.opacity = 0.18 + (1 - reveal) * 0.72 + vaultProgress * 0.82
      }
      markRef.current.rotation.z = -0.1 + Math.sin(time * 0.28) * 0.025
      markRef.current.position.z = 0.7 + (1 - vaultProgress) * 0.55
      markRef.current.scale.setScalar(1.18 - reveal * 0.38 + vaultProgress * 0.16)
    }

  })

  return (
    <group>
      <fog attach="fog" args={["#080a08", 12, 27]} />
      <ambientLight intensity={0.34} color="#d8ded0" />
      <hemisphereLight args={["#dfe8d9", "#10150d", 1.2]} />
      <directionalLight position={[4, 9, 6]} intensity={2.8} color="#e6eee0" castShadow />
      <pointLight position={[-4, 2.8, 3]} intensity={5.2} distance={12} color={laneColors[activeLane]} />
      <pointLight position={[5, 1.2, -3]} intensity={2.6} distance={14} color="#50693b" />

      <group ref={propertyRef}>
        <mesh position={[0, -0.24, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[10.6, 7.8, 1, 1]} />
          <meshStandardMaterial color="#11150f" metalness={0.8} roughness={0.58} />
        </mesh>
        <Line points={[[-5.3, -0.22, -3.7], [5.3, -0.22, -3.7], [5.3, -0.22, 3.7], [-5.3, -0.22, 3.7], [-5.3, -0.22, -3.7]]} color="#708064" transparent opacity={0.42} lineWidth={0.45} />
        {[-4, -2, 0, 2, 4].map((offset) => (
          <Line key={`grid-x-${offset}`} points={[[offset, -0.21, -3.55], [offset, -0.21, 3.55]]} color="#405035" transparent opacity={0.26} lineWidth={0.32} />
        ))}
        {[-3, -1.5, 0, 1.5, 3].map((offset) => (
          <Line key={`grid-z-${offset}`} points={[[-5.05, -0.21, offset], [5.05, -0.21, offset]]} color="#405035" transparent opacity={0.26} lineWidth={0.32} />
        ))}

        <group position={[-0.15, 0, 0]}>
          {propertyVolumes.map((volume, index) => (
            <group key={`${volume.position.join("-")}-${index}`} position={volume.position}>
              <mesh castShadow receiveShadow scale={volume.scale}>
                <boxGeometry args={[1, 1, 1]} />
                <meshPhysicalMaterial color={index % 3 === 0 ? "#30382e" : "#20261f"} metalness={0.82} roughness={0.34} clearcoat={0.32} clearcoatRoughness={0.32} />
                <Edges color={index % 2 === 0 ? "#8ba36b" : "#4f6340"} threshold={15} scale={1.006} />
              </mesh>
              {index % 2 === 0 ? (
                <mesh position={[0, volume.scale[1] * 0.505, 0]} scale={[volume.scale[0] * 0.78, 0.02, volume.scale[2] * 0.76]}>
                  <boxGeometry args={[1, 1, 1]} />
                  <meshBasicMaterial color={laneColors[activeLane]} transparent opacity={0.24} />
                </mesh>
              ) : null}
            </group>
          ))}
          <mesh position={[0, 2.05, 0.82]}>
            <planeGeometry args={[6.8, 5.3, 36, 36]} />
            <DataScanMaterial progressRef={progressRef} activeLane={activeLane} />
          </mesh>
        </group>
      </group>

      <group ref={routeRef}>
        <mesh>
          <tubeGeometry args={[routeCurve, 112, 0.052, 10, false]} />
          <meshStandardMaterial color={laneColors[activeLane]} emissive={laneColors[activeLane]} emissiveIntensity={2.4} metalness={0.34} roughness={0.26} />
        </mesh>
        {routeNodes.map((node, index) => (
          <group key={`route-node-${index}`} position={node}>
            <mesh>
              <sphereGeometry args={[index === 2 ? 0.15 : 0.1, 18, 18]} />
              <meshStandardMaterial color="#f1f7e9" emissive={laneColors[activeLane]} emissiveIntensity={2.8} roughness={0.18} />
            </mesh>
            <mesh scale={[2.7, 0.04, 2.7]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.5, 0.54, 42]} />
              <meshBasicMaterial color={laneColors[activeLane]} transparent opacity={0.28} side={THREE.DoubleSide} />
            </mesh>
          </group>
        ))}
      </group>

      <group ref={vaultRef} position={[0, 0.9, 0.15]}>
        <mesh castShadow>
          <boxGeometry args={[3.95, 2.32, 0.48]} />
          <meshPhysicalMaterial color="#26321a" emissive="#293b12" emissiveIntensity={0.42} metalness={0.84} roughness={0.25} clearcoat={0.44} clearcoatRoughness={0.22} transparent opacity={0.86} />
          <Edges color="#c4ef79" threshold={15} scale={1.006} />
        </mesh>
        <mesh position={[0, 0, 0.27]}>
          <planeGeometry args={[3.1, 1.45]} />
          <meshBasicMaterial color="#b7ff3c" transparent opacity={0.18} />
        </mesh>
        <Line points={[[-1.4, 0.34, 0.31], [1.28, 0.34, 0.31]]} color="#d2ff83" transparent opacity={0.92} lineWidth={0.6} />
        <Line points={[[-1.4, -0.18, 0.31], [0.64, -0.18, 0.31]]} color="#b7ff3c" transparent opacity={0.72} lineWidth={0.5} />
        <Line points={[[-1.4, -0.55, 0.31], [1.08, -0.55, 0.31]]} color="#84996b" transparent opacity={0.62} lineWidth={0.5} />
      </group>

      <mesh ref={markRef} position={[0.15, 2.2, 1.25]}>
        <planeGeometry args={[4.5, 4.5]} />
        <meshBasicMaterial map={markTexture} transparent opacity={0.68} depthWrite={false} toneMapped={false} />
      </mesh>

      <EffectComposer multisampling={0} enableNormalPass={false}>
        <Bloom mipmapBlur intensity={0.52} luminanceThreshold={1.15} luminanceSmoothing={0.72} />
        <Noise opacity={0.026} premultiply />
        <Vignette eskil={false} offset={0.18} darkness={0.86} />
      </EffectComposer>
    </group>
  )
}

function FilmCanvas(props: HeroFilmProps) {
  return (
    <Canvas
      className="vb-hero-film-canvas"
      dpr={[1, 1.55]}
      gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
      camera={{ position: [7.6, 5.1, 13.5], fov: 38, near: 0.1, far: 60 }}
      onCreated={({ gl }) => {
        gl.outputColorSpace = THREE.SRGBColorSpace
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 1.06
      }}
    >
      <Suspense fallback={null}>
        <PropertyFilm {...props} />
      </Suspense>
    </Canvas>
  )
}

export function HeroFilm(props: HeroFilmProps) {
  const [enabled, setEnabled] = useState(false)
  const [inView, setInView] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)")
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)")
    const evaluate = () => setEnabled(!reducedMotion.matches && finePointer.matches)
    evaluate()
    reducedMotion.addEventListener("change", evaluate)
    finePointer.addEventListener("change", evaluate)
    return () => {
      reducedMotion.removeEventListener("change", evaluate)
      finePointer.removeEventListener("change", evaluate)
    }
  }, [])

  useEffect(() => {
    const element = containerRef.current
    if (!element || !enabled) return
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { rootMargin: "30% 0px 30% 0px" })
    observer.observe(element)
    return () => observer.disconnect()
  }, [enabled])

  return (
    <div ref={containerRef} className="vb-hero-film" aria-hidden="true">
      {enabled && inView ? <FilmCanvas {...props} /> : null}
    </div>
  )
}

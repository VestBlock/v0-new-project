"use client"

import { useEffect, useRef, useState } from "react"
import * as THREE from "three"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { Building2, CircleDollarSign, Handshake, ShieldCheck } from "lucide-react"

import { CapitalFlowSection } from "@/components/cinematic/capital-flow-section"

const STAGES = [
  {
    label: "Share",
    title: "Sellers & opportunities",
    body: "Property details, timing, motivation, and deal context enter through a simple review path.",
    icon: Building2,
    tint: "text-cyan-200",
    accent: "#22d3ee",
  },
  {
    label: "Meet",
    title: "Buyers & operators",
    body: "Buyers and operators see opportunities that fit their markets, asset appetite, and capacity.",
    icon: Handshake,
    tint: "text-sky-200",
    accent: "#38bdf8",
  },
  {
    label: "Fund",
    title: "Lenders & capital",
    body: "Lenders and capital partners receive opportunities aligned with their programs and risk appetite.",
    icon: CircleDollarSign,
    tint: "text-amber-200",
    accent: "#facc15",
  },
  {
    label: "Verify",
    title: "Proof & records",
    body: "DealVault helps members keep agreements, milestones, payouts, and proof organized beyond one transaction.",
    icon: ShieldCheck,
    tint: "text-emerald-200",
    accent: "#34d399",
  },
] as const

const STATION_X = [-5.2, -1.75, 1.75, 5.2]

function disposeObject(object: THREE.Object3D) {
  const disposable = object as THREE.Object3D & {
    geometry?: THREE.BufferGeometry
    material?: THREE.Material | THREE.Material[]
  }
  disposable.geometry?.dispose()
  if (Array.isArray(disposable.material)) disposable.material.forEach((m) => m.dispose())
  else disposable.material?.dispose()
}

function makeHouse(color: number) {
  const group = new THREE.Group()
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.82, 0.56, 0.7),
    new THREE.MeshStandardMaterial({ color: 0x0f2435, emissive: color, emissiveIntensity: 0.25, metalness: 0.32, roughness: 0.38 })
  )
  body.position.y = 0.37
  group.add(body)
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(0.7, 0.5, 4),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.55, metalness: 0.38, roughness: 0.24 })
  )
  roof.position.y = 0.9
  roof.rotation.y = Math.PI / 4
  group.add(roof)
  return group
}

function makePartnerCluster(color: number) {
  const group = new THREE.Group()
  const positions: Array<[number, number, number]> = [
    [-0.45, 0.45, 0.15],
    [0.4, 0.6, -0.15],
    [0, 0.32, 0.32],
  ]
  positions.forEach(([x, y, z], i) => {
    const node = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.24 + i * 0.04, 0),
      new THREE.MeshStandardMaterial({ color: 0x0f2435, emissive: color, emissiveIntensity: 0.5, metalness: 0.4, roughness: 0.3 })
    )
    node.position.set(x, y, z)
    group.add(node)
  })
  return group
}

function makeCoinStack(color: number) {
  const group = new THREE.Group()
  const material = new THREE.MeshStandardMaterial({ color, emissive: 0xf59e0b, emissiveIntensity: 0.45, metalness: 0.82, roughness: 0.2 })
  for (let i = 0; i < 7; i++) {
    const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.07, 48), material)
    coin.position.y = 0.08 + i * 0.07
    coin.rotation.y = i * 0.24
    group.add(coin)
  }
  return group
}

function makeProofCore(color: number) {
  const group = new THREE.Group()
  const core = new THREE.Mesh(
    new THREE.DodecahedronGeometry(0.52, 0),
    new THREE.MeshPhysicalMaterial({
      color: 0x67e8f9,
      emissive: color,
      emissiveIntensity: 0.5,
      metalness: 0.36,
      roughness: 0.12,
      opacity: 0.7,
      transparent: true,
    })
  )
  core.position.y = 0.65
  group.add(core)
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(core.geometry),
    new THREE.LineBasicMaterial({ color: 0xfacc15, opacity: 0.8, transparent: true })
  )
  edges.position.copy(core.position)
  group.add(edges)
  const orbit = new THREE.Mesh(
    new THREE.TorusGeometry(0.95, 0.014, 8, 110),
    new THREE.MeshBasicMaterial({ color, opacity: 0.4, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })
  )
  orbit.rotation.x = Math.PI / 2.4
  orbit.position.y = 0.65
  group.add(orbit)
  return group
}

const STATION_BUILDERS = [
  () => makeHouse(0x22d3ee),
  () => makePartnerCluster(0x38bdf8),
  () => makeCoinStack(0xfacc15),
  () => makeProofCore(0x34d399),
]

const STATION_COLORS = [0x22d3ee, 0x38bdf8, 0xfacc15, 0x34d399]

function Journey3D() {
  const sectionRef = useRef<HTMLElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const progressRef = useRef(0)
  const [stage, setStage] = useState(0)
  const stageRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    const container = canvas?.parentElement
    const section = sectionRef.current
    if (!canvas || !container || !section) return

    gsap.registerPlugin(ScrollTrigger)

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, canvas, powerPreference: "high-performance" })
    renderer.setClearColor(0x000000, 0)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7))

    const scene = new THREE.Scene()
    scene.fog = new THREE.Fog(0x030610, 9, 16)
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100)

    scene.add(new THREE.AmbientLight(0x9bdcff, 1.1))
    const keyLight = new THREE.PointLight(0x22d3ee, 7, 20)
    keyLight.position.set(-3, 4.5, 4.5)
    scene.add(keyLight)
    const warmLight = new THREE.PointLight(0xfacc15, 4.5, 16)
    warmLight.position.set(3.4, 3.6, 3)
    scene.add(warmLight)

    const rig = new THREE.Group()
    scene.add(rig)

    // Ground grid
    const grid = new THREE.GridHelper(26, 60, 0x22d3ee, 0x16335c)
    const gridMaterial = grid.material as THREE.Material
    gridMaterial.transparent = true
    gridMaterial.opacity = 0.16
    rig.add(grid)

    // Depth particle field
    const starGeometry = new THREE.BufferGeometry()
    const starCount = 260
    const starPositions = new Float32Array(starCount * 3)
    for (let i = 0; i < starCount; i++) {
      starPositions[i * 3] = (Math.random() - 0.5) * 26
      starPositions[i * 3 + 1] = Math.random() * 6 + 0.4
      starPositions[i * 3 + 2] = (Math.random() - 0.5) * 14 - 2
    }
    starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3))
    const stars = new THREE.Points(
      starGeometry,
      new THREE.PointsMaterial({ color: 0x7dd3fc, size: 0.035, transparent: true, opacity: 0.5, depthWrite: false })
    )
    rig.add(stars)

    // Stations
    type Station = { group: THREE.Group; halo: THREE.Mesh; baseY: number }
    const stations: Station[] = STATION_X.map((x, index) => {
      const group = new THREE.Group()
      group.position.set(x, 0, 0)
      rig.add(group)

      const platform = new THREE.Mesh(
        new THREE.CylinderGeometry(0.85, 1, 0.08, 64),
        new THREE.MeshBasicMaterial({
          color: STATION_COLORS[index],
          opacity: 0.12,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      )
      platform.position.y = 0.04
      group.add(platform)

      const halo = new THREE.Mesh(
        new THREE.TorusGeometry(0.95, 0.02, 8, 96),
        new THREE.MeshBasicMaterial({
          color: STATION_COLORS[index],
          opacity: 0.4,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      )
      halo.rotation.x = Math.PI / 2
      halo.position.y = 0.1
      group.add(halo)

      const subject = STATION_BUILDERS[index]()
      subject.position.y = 0.06
      group.add(subject)

      return { group, halo, baseY: 0 }
    })

    // Connecting routes with flowing particles
    type Route = { curve: THREE.CatmullRomCurve3; particles: THREE.Mesh[]; material: THREE.MeshBasicMaterial; particleMaterial: THREE.MeshBasicMaterial; from: number }
    const routes: Route[] = []
    for (let i = 0; i < STATION_X.length - 1; i++) {
      const start = new THREE.Vector3(STATION_X[i], 0.7, 0)
      const end = new THREE.Vector3(STATION_X[i + 1], 0.7, 0)
      const middle = start.clone().lerp(end, 0.5)
      middle.y += 1.2
      const curve = new THREE.CatmullRomCurve3([start, middle, end])

      const material = new THREE.MeshBasicMaterial({
        color: STATION_COLORS[i + 1],
        opacity: 0.2,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 72, 0.016, 8, false), material)
      rig.add(tube)

      const particleMaterial = new THREE.MeshBasicMaterial({
        color: STATION_COLORS[i + 1],
        opacity: 0.85,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
      const particles = [0, 0.45].map(() => {
        const particle = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 16), particleMaterial)
        rig.add(particle)
        return particle
      })
      routes.push({ curve, particles, material, particleMaterial, from: i })
    }

    let frame = 0
    let animationId = 0
    let camX = STATION_X[0]

    const resize = () => {
      const width = container.clientWidth
      const height = container.clientHeight
      renderer.setSize(width, height, false)
      camera.aspect = width / Math.max(height, 1)
      camera.updateProjectionMatrix()
    }

    const renderScene = () => {
      frame += 0.016
      const progress = progressRef.current
      const targetX = THREE.MathUtils.lerp(STATION_X[0], STATION_X[STATION_X.length - 1], progress)
      camX = THREE.MathUtils.lerp(camX, targetX, 0.07)

      const aspect = container.clientWidth / Math.max(container.clientHeight, 1)
      const distance = aspect < 1.2 ? 9.6 : 7.4
      camera.position.set(camX, 2.5 + Math.sin(frame * 0.5) * 0.06, distance)
      camera.lookAt(camX * 0.96, 0.75, 0)

      stars.rotation.y = frame * 0.008

      stations.forEach((station, index) => {
        const proximity = 1 - Math.min(Math.abs(camX - STATION_X[index]) / 3.2, 1)
        const pulse = 1 + Math.sin(frame * 1.8 + index * 1.4) * (0.04 + proximity * 0.08)
        station.halo.scale.setScalar(pulse)
        ;(station.halo.material as THREE.MeshBasicMaterial).opacity = 0.18 + proximity * 0.6
        station.group.rotation.y = Math.sin(frame * 0.3 + index) * 0.08
        station.group.position.y = Math.sin(frame * 0.8 + index * 2) * 0.04 * (0.4 + proximity)
        station.group.traverse((child) => {
          const mesh = child as THREE.Mesh
          const material = mesh.material as THREE.MeshStandardMaterial | undefined
          if (material && "emissiveIntensity" in material) {
            material.emissiveIntensity = 0.25 + proximity * 0.55
          }
        })
      })

      routes.forEach((route) => {
        const segmentProgress = progress * 3 - route.from
        const active = Math.max(0, Math.min(segmentProgress, 1))
        route.material.opacity = 0.06 + active * 0.34
        route.particleMaterial.opacity = 0.15 + active * 0.75
        route.particles.forEach((particle, particleIndex) => {
          const flowProgress = (frame * 0.16 + particleIndex * 0.45) % 1
          particle.position.copy(route.curve.getPointAt(flowProgress))
          particle.scale.setScalar((0.5 + active * 0.8) * (0.7 + Math.sin(flowProgress * Math.PI) * 0.5))
        })
      })

      renderer.render(scene, camera)
      animationId = window.requestAnimationFrame(renderScene)
    }

    const observer = new ResizeObserver(resize)
    observer.observe(container)
    resize()
    renderScene()

    const trigger = ScrollTrigger.create({
      trigger: section,
      start: "top top",
      end: "+=280%",
      pin: true,
      scrub: true,
      onUpdate: (self) => {
        progressRef.current = self.progress
        const nextStage = Math.min(STAGES.length - 1, Math.round(self.progress * (STAGES.length - 1)))
        if (nextStage !== stageRef.current) {
          stageRef.current = nextStage
          setStage(nextStage)
        }
      },
    })

    return () => {
      trigger.kill()
      window.cancelAnimationFrame(animationId)
      observer.disconnect()
      scene.traverse(disposeObject)
      starGeometry.dispose()
      renderer.dispose()
    }
  }, [])

  return (
    <section ref={sectionRef} className="relative h-screen overflow-hidden">
      {/* 3D canvas */}
      <div className="absolute inset-0">
        <canvas ref={canvasRef} aria-hidden="true" className="h-full w-full" />
      </div>

      {/* Futuristic texture + edge fades */}
      <div className="pointer-events-none absolute inset-0">
        <div className="vb-scan-grid absolute inset-0 opacity-40" />
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#030610] to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#030610] to-transparent" />
      </div>

      {/* Section heading */}
      <div className="pointer-events-none absolute inset-x-0 top-14 z-10 px-4 text-center md:top-20">
        <p className="vb-mono text-xs uppercase tracking-[0.28em] text-amber-200/80">How the network moves</p>
        <h2 className="mx-auto mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-white md:text-5xl">
          Start with the role. Move toward the right partner.
        </h2>
      </div>

      {/* Stage copy (all stages stay in the DOM; opacity crossfade) */}
      <div className="absolute bottom-24 left-4 right-4 z-10 mx-auto max-w-xl md:bottom-28 lg:left-16 lg:right-auto lg:mx-0">
        <div className="relative min-h-[10.5rem]">
          {STAGES.map((item, index) => {
            const Icon = item.icon
            return (
              <div
                key={item.label}
                aria-hidden={index !== stage}
                className="absolute inset-x-0 bottom-0 transition-all duration-700"
                style={{ opacity: index === stage ? 1 : 0, transform: index === stage ? "translateY(0)" : "translateY(14px)" }}
              >
                <div className="vb-glass rounded-[1.6rem] p-6">
                  <div className="mb-3 flex items-center justify-between">
                    <span className={`flex h-11 w-11 items-center justify-center rounded-2xl border border-white/15 bg-slate-950/60 ${item.tint}`}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="vb-mono text-[0.65rem] uppercase tracking-[0.2em] text-slate-500">
                      0{index + 1} · {item.label}
                    </span>
                  </div>
                  <h3 className="text-xl font-semibold text-white">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-300/85">{item.body}</p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Progress rail */}
        <div className="mt-5 flex items-center gap-2 px-2">
          {STAGES.map((item, index) => (
            <div key={item.label} className="flex flex-1 items-center gap-2">
              <span
                className="vb-mono text-[0.6rem] uppercase tracking-[0.16em] transition-colors duration-500"
                style={{ color: index <= stage ? item.accent : "rgba(100,116,139,0.6)" }}
              >
                {item.label}
              </span>
              {index < STAGES.length - 1 ? (
                <span className="h-px flex-1 overflow-hidden rounded bg-white/10">
                  <span
                    className="block h-full bg-gradient-to-r from-cyan-300/80 to-amber-200/80 transition-[width] duration-700"
                    style={{ width: index < stage ? "100%" : "0%" }}
                  />
                </span>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      {/* Scroll hint */}
      <div className="pointer-events-none absolute bottom-8 left-1/2 z-10 -translate-x-1/2">
        <p className="vb-mono text-[0.6rem] uppercase tracking-[0.24em] text-slate-500">Scroll to move the deal</p>
      </div>
    </section>
  )
}

/**
 * Scroll-driven 3D capital-flow journey. Pins the viewport and dollies a
 * Three.js camera through Share → Meet → Fund → Verify stations as the user
 * scrolls. Falls back to the static card grid on small screens, reduced
 * motion, or when WebGL is unavailable.
 */
export function DealJourneySection() {
  const [mode, setMode] = useState<"static" | "3d">("static")

  useEffect(() => {
    const wantsMotion = !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const isDesktop = window.matchMedia("(min-width: 1024px)").matches
    let webglOk = false
    try {
      const probe = document.createElement("canvas")
      webglOk = Boolean(probe.getContext("webgl2") || probe.getContext("webgl"))
    } catch {
      webglOk = false
    }
    if (wantsMotion && isDesktop && webglOk) setMode("3d")
  }, [])

  if (mode === "3d") return <Journey3D />
  return <CapitalFlowSection />
}

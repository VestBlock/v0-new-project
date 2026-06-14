"use client"

import { useEffect, useRef, useState } from "react"
import * as THREE from "three"
import type { AgentAction, AgentKey, MissionNode } from "@/lib/admin/commandCenter"
import { MissionCanvasOverlay, type MissionVisualMode } from "./mission-canvas-overlay"

type RouteObject = {
  material: THREE.MeshBasicMaterial
  particles: THREE.Mesh[]
  particleMaterial: THREE.MeshBasicMaterial
  curve: THREE.CatmullRomCurve3
  key: AgentKey
  offset: number
  speed: number
  intensity: number
}

type NodeObject = {
  halo: THREE.Mesh
  core: THREE.Mesh
  panel: THREE.Mesh
  beacon: THREE.Mesh
  key: AgentKey
  intensity: number
}

const AGENT_COLORS: Record<AgentKey, number> = {
  acquisition: 0x22d3ee, // cyan — inflow
  outreach: 0x60a5fa, // blue — messaging
  routing: 0x34d399, // emerald — movement
  underwriting: 0xfacc15, // gold — capital
  authority: 0xa855f7, // violet — visibility
  qa: 0xf87171, // red — health
  operator: 0xe2e8f0, // slate — the human
}

const ORDER: AgentKey[] = ["acquisition", "outreach", "routing", "underwriting", "authority", "qa", "operator"]

const MODE_AGENT_BOOST: Record<MissionVisualMode, AgentKey[]> = {
  scan: ["acquisition", "qa", "operator"],
  value: ["underwriting", "routing"],
  route: ["routing", "outreach", "operator"],
  offer: ["outreach", "underwriting", "acquisition"],
}

function ringPosition(index: number, total: number, radius: number) {
  // Start at the left and sweep clockwise so acquisition (inflow) reads west.
  const angle = Math.PI + (index / total) * Math.PI * 2
  return new THREE.Vector3(Math.cos(angle) * radius, 0.16, Math.sin(angle) * radius * 0.74)
}

function makeRoute(start: THREE.Vector3, end: THREE.Vector3) {
  const middle = start.clone().lerp(end, 0.5)
  middle.y += 1.05
  return new THREE.CatmullRomCurve3([start, middle, end])
}

function disposeObject(object: THREE.Object3D) {
  const disposable = object as THREE.Object3D & {
    geometry?: THREE.BufferGeometry
    material?: THREE.Material | THREE.Material[]
  }
  disposable.geometry?.dispose()
  if (Array.isArray(disposable.material)) {
    disposable.material.forEach((material) => material.dispose())
  } else {
    disposable.material?.dispose()
  }
}

export function MissionCore({
  nodes,
  focusedAgent,
  onAgentClick,
  onAgentAction,
  onOpenCodex,
  onAskCodex,
}: {
  nodes: MissionNode[]
  focusedAgent: AgentKey | null
  onAgentClick?: (key: AgentKey) => void
  onAgentAction?: (action: AgentAction, key: AgentKey) => void
  onOpenCodex?: () => void
  onAskCodex?: (prompt: string, key?: AgentKey) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const nodesRef = useRef(nodes)
  const focusRef = useRef<AgentKey | null>(focusedAgent)
  const clickRef = useRef(onAgentClick)
  const [visualMode, setVisualMode] = useState<MissionVisualMode>("scan")
  const [scanPulse, setScanPulse] = useState(0)
  const visualModeRef = useRef<MissionVisualMode>(visualMode)
  const scanPulseRef = useRef(scanPulse)

  useEffect(() => {
    nodesRef.current = nodes
  }, [nodes])
  useEffect(() => {
    focusRef.current = focusedAgent
  }, [focusedAgent])
  useEffect(() => {
    clickRef.current = onAgentClick
  }, [onAgentClick])
  useEffect(() => {
    visualModeRef.current = visualMode
  }, [visualMode])
  useEffect(() => {
    scanPulseRef.current = scanPulse
  }, [scanPulse])

  useEffect(() => {
    const canvas = canvasRef.current
    const container = canvas?.parentElement
    if (!canvas || !container) return

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      canvas,
      powerPreference: "high-performance",
      preserveDrawingBuffer: true,
    })
    renderer.setClearColor(0x000000, 0)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7))

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100)
    camera.position.set(0, 4.4, 8.6)
    camera.lookAt(0, 0.7, 0)

    scene.add(new THREE.AmbientLight(0x9bdcff, 1.05))
    const keyLight = new THREE.PointLight(0x22d3ee, 6.5, 20)
    keyLight.position.set(-3.5, 4.5, 4)
    scene.add(keyLight)
    const fillLight = new THREE.PointLight(0xa855f7, 5, 18)
    fillLight.position.set(3.6, 4.2, 3.2)
    scene.add(fillLight)

    const rig = new THREE.Group()
    rig.rotation.x = -0.14
    rig.position.y = -0.25
    scene.add(rig)

    const grid = new THREE.GridHelper(14, 42, 0x22d3ee, 0x1e3a5f)
    const gridMaterial = grid.material as THREE.Material
    gridMaterial.transparent = true
    gridMaterial.opacity = 0.14
    rig.add(grid)

    // Central asset scanner: the property as a live deal hologram.
    const coreGroup = new THREE.Group()
    coreGroup.position.set(0, 0.82, 0)
    coreGroup.scale.setScalar(1.05)
    rig.add(coreGroup)

    const parcel = new THREE.Mesh(
      new THREE.BoxGeometry(3.15, 0.035, 2.16),
      new THREE.MeshBasicMaterial({
        color: 0x0ea5e9,
        opacity: 0.12,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    )
    parcel.position.y = -0.16
    parcel.rotation.y = -0.18
    coreGroup.add(parcel)

    const parcelEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(parcel.geometry),
      new THREE.LineBasicMaterial({ color: 0x7dd3fc, opacity: 0.48, transparent: true })
    )
    parcelEdges.position.copy(parcel.position)
    parcelEdges.rotation.copy(parcel.rotation)
    coreGroup.add(parcelEdges)

    const foundation = new THREE.Mesh(
      new THREE.CylinderGeometry(2.05, 2.35, 0.1, 96),
      new THREE.MeshBasicMaterial({
        color: 0x22d3ee,
        opacity: 0.09,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    )
    foundation.position.y = -0.08
    coreGroup.add(foundation)

    const core = new THREE.Mesh(
      new THREE.BoxGeometry(1.78, 1.18, 1.22),
      new THREE.MeshPhysicalMaterial({
        color: 0x67e8f9,
        emissive: 0x0891b2,
        emissiveIntensity: 0.58,
        metalness: 0.35,
        roughness: 0.18,
        opacity: 0.34,
        transparent: true,
      })
    )
    core.position.y = 0.46
    coreGroup.add(core)

    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(1.42, 0.88, 4),
      new THREE.MeshPhysicalMaterial({
        color: 0x38bdf8,
        emissive: 0x0ea5e9,
        emissiveIntensity: 0.55,
        metalness: 0.28,
        roughness: 0.2,
        opacity: 0.38,
        transparent: true,
      })
    )
    roof.rotation.y = Math.PI / 4
    roof.scale.z = 0.9
    roof.position.y = 1.28
    coreGroup.add(roof)

    const coreEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(core.geometry),
      new THREE.LineBasicMaterial({ color: 0xbae6fd, opacity: 0.7, transparent: true })
    )
    coreEdges.position.copy(core.position)
    coreGroup.add(coreEdges)

    const roofEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(roof.geometry),
      new THREE.LineBasicMaterial({ color: 0xe0f2fe, opacity: 0.66, transparent: true })
    )
    roofEdges.rotation.copy(roof.rotation)
    roofEdges.scale.copy(roof.scale)
    roofEdges.position.copy(roof.position)
    coreGroup.add(roofEdges)

    const windowMaterial = new THREE.MeshBasicMaterial({
      color: 0xe0f2fe,
      opacity: 0.48,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    const windowGeometry = new THREE.PlaneGeometry(0.28, 0.24)
    ;[
      [-0.42, 0.62, 0.602, 0],
      [0.42, 0.62, 0.602, 0],
      [-0.795, 0.62, 0.08, Math.PI / 2],
      [0.795, 0.62, -0.08, -Math.PI / 2],
    ].forEach(([x, y, z, rotationY]) => {
      const windowPane = new THREE.Mesh(windowGeometry, windowMaterial)
      windowPane.position.set(x, y, z)
      windowPane.rotation.y = rotationY
      coreGroup.add(windowPane)
    })

    const doorGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(0.32, 0.5),
      new THREE.MeshBasicMaterial({
        color: 0x22d3ee,
        opacity: 0.38,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    )
    doorGlow.position.set(0, 0.22, 0.604)
    coreGroup.add(doorGlow)

    const floorplanMaterial = new THREE.LineBasicMaterial({ color: 0xe0f2fe, opacity: 0.32, transparent: true })
    const floorplan = new THREE.Group()
    ;[
      [-0.72, 0.09, 0.66, 0, 0.55],
      [0.0, 0.09, 0.66, 0, 0.7],
      [0.72, 0.09, 0.66, 0, 0.55],
      [-0.88, 0.09, 0.18, Math.PI / 2, 0.46],
      [0.88, 0.09, 0.18, Math.PI / 2, 0.46],
    ].forEach(([x, y, z, rotationY, length]) => {
      const segment = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(-length / 2, 0, 0),
          new THREE.Vector3(length / 2, 0, 0),
        ]),
        floorplanMaterial
      )
      segment.position.set(x, y, z)
      segment.rotation.y = rotationY
      floorplan.add(segment)
    })
    coreGroup.add(floorplan)

    const coreGlow = new THREE.Mesh(
      new THREE.SphereGeometry(1.8, 32, 24),
      new THREE.MeshBasicMaterial({
        color: 0x22d3ee,
        opacity: 0.055,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    )
    coreGroup.add(coreGlow)

    const orbit = new THREE.Mesh(
      new THREE.TorusGeometry(2.42, 0.012, 8, 180),
      new THREE.MeshBasicMaterial({
        color: 0x67e8f9,
        opacity: 0.28,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    )
    orbit.rotation.x = Math.PI / 2.15
    coreGroup.add(orbit)

    const scanShell = new THREE.Mesh(
      new THREE.SphereGeometry(2.16, 28, 16),
      new THREE.MeshBasicMaterial({
        color: 0x67e8f9,
        opacity: 0.045,
        transparent: true,
        wireframe: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    )
    scanShell.scale.y = 0.58
    scanShell.position.y = 0.56
    coreGroup.add(scanShell)

    const verticalOrbits = [0, 1, 2].map((index) => {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(1.82 + index * 0.2, 0.007, 6, 150),
        new THREE.MeshBasicMaterial({
          color: index === 1 ? 0xa855f7 : 0x7dd3fc,
          opacity: 0.08,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      )
      ring.rotation.set(Math.PI / 2.35, index * 0.82, index * 0.38)
      ring.position.y = 0.56
      coreGroup.add(ring)
      return ring
    })

    const scanRings = [1.2, 1.65, 2.15].map((radius, index) => {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(radius, 0.007, 6, 132),
        new THREE.MeshBasicMaterial({
          color: index === 1 ? 0xa855f7 : 0x22d3ee,
          opacity: 0.14,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      )
      ring.rotation.x = Math.PI / 2
      ring.position.y = -0.02
      coreGroup.add(ring)
      return ring
    })

    const valuationBeam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.11, 2.7, 32),
      new THREE.MeshBasicMaterial({
        color: 0x67e8f9,
        opacity: 0.16,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    )
    valuationBeam.position.y = 1.42
    coreGroup.add(valuationBeam)

    const scanBarMaterial = new THREE.MeshBasicMaterial({
      color: 0x67e8f9,
      opacity: 0.18,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
    const scanBar = new THREE.Mesh(new THREE.PlaneGeometry(3.55, 0.055), scanBarMaterial)
    scanBar.rotation.x = -Math.PI / 2
    scanBar.position.set(0, 0.02, -1.15)
    coreGroup.add(scanBar)

    const offerField = new THREE.Mesh(
      new THREE.TorusGeometry(2.68, 0.009, 6, 180),
      new THREE.MeshBasicMaterial({
        color: 0xfacc15,
        opacity: 0.04,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    )
    offerField.rotation.x = Math.PI / 2.04
    offerField.position.y = 0.12
    coreGroup.add(offerField)

    const dataPlanes = [
      { color: 0x22d3ee, position: new THREE.Vector3(-1.72, 1.32, -0.54), rotationY: 0.42 },
      { color: 0xfacc15, position: new THREE.Vector3(1.66, 1.2, -0.28), rotationY: -0.48 },
      { color: 0x34d399, position: new THREE.Vector3(0.18, 1.78, -0.86), rotationY: 0.02 },
    ].map(({ color, position, rotationY }) => {
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(0.92, 0.34),
        new THREE.MeshBasicMaterial({
          color,
          opacity: 0.14,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        })
      )
      plane.position.copy(position)
      plane.rotation.y = rotationY
      coreGroup.add(plane)
      return plane
    })

    const marketBlocks = [-1.2, -0.6, 0.15, 0.88, 1.34].map((x, index) => {
      const block = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.06 + index * 0.035, 0.22),
        new THREE.MeshBasicMaterial({
          color: index % 2 ? 0x60a5fa : 0x22d3ee,
          opacity: 0.16,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      )
      block.position.set(x, -0.05 + index * 0.018, -1.08 - (index % 2) * 0.22)
      coreGroup.add(block)
      return block
    })

    const scannerParticles = Array.from({ length: 28 }, (_, index) => {
      const material = new THREE.MeshBasicMaterial({
        color: index % 5 === 0 ? 0xe0f2fe : index % 3 === 0 ? 0xa855f7 : 0x22d3ee,
        opacity: 0.46,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
      const particle = new THREE.Mesh(new THREE.SphereGeometry(index % 5 === 0 ? 0.045 : 0.028, 10, 10), material)
      coreGroup.add(particle)
      return {
        particle,
        radius: 1.45 + (index % 7) * 0.13,
        y: 0.05 + (index % 6) * 0.22,
        speed: 0.24 + (index % 8) * 0.035,
        phase: index * 0.73,
      }
    })

    const valuePillars = [0.36, 0.62, 0.48, 0.82, 0.68, 0.95].map((height, index) => {
      const material = new THREE.MeshBasicMaterial({
        color: index % 2 ? 0xfacc15 : 0x67e8f9,
        opacity: 0.08,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1, 0.12), material)
      pillar.position.set(1.28 + index * 0.16, 0.08 + height / 2, 0.86 - index * 0.18)
      pillar.scale.y = height
      coreGroup.add(pillar)
      return { pillar, height }
    })

    const offerPaths = [
      {
        color: 0xfacc15,
        phase: 0,
        curve: new THREE.CatmullRomCurve3([
          new THREE.Vector3(-0.38, 0.34, 1.1),
          new THREE.Vector3(-1.62, 0.94, 1.32),
          new THREE.Vector3(-2.36, 0.36, 0.18),
        ]),
      },
      {
        color: 0xa855f7,
        phase: 0.42,
        curve: new THREE.CatmullRomCurve3([
          new THREE.Vector3(0.38, 0.34, 1.1),
          new THREE.Vector3(1.62, 1.12, 1.2),
          new THREE.Vector3(2.42, 0.38, 0.12),
        ]),
      },
    ].map(({ color, curve, phase }) => {
      const material = new THREE.MeshBasicMaterial({
        color,
        opacity: 0.05,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 64, 0.018, 8, false), material)
      coreGroup.add(tube)

      const markerMaterial = new THREE.MeshBasicMaterial({
        color,
        opacity: 0.12,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
      const marker = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.008, 8, 52), markerMaterial)
      marker.position.copy(curve.getPointAt(1))
      marker.rotation.x = Math.PI / 2
      coreGroup.add(marker)

      const particleMaterial = new THREE.MeshBasicMaterial({
        color,
        opacity: 0.22,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
      const particles = [0, 0.5].map(() => {
        const particle = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 12), particleMaterial)
        coreGroup.add(particle)
        return particle
      })

      return { curve, material, marker, markerMaterial, particleMaterial, particles, phase }
    })

    // Orbiting command modules around the asset scanner.
    const nodeObjects: NodeObject[] = []
    const routes: RouteObject[] = []
    const clickTargets: { mesh: THREE.Mesh; key: AgentKey }[] = []
    const radius = 3.55

    ORDER.forEach((key, index) => {
      const color = AGENT_COLORS[key]
      const position = ringPosition(index, ORDER.length, radius)
      const group = new THREE.Group()
      group.position.copy(position)
      rig.add(group)

      group.lookAt(new THREE.Vector3(0, 0.42, 0))

      const base = new THREE.Mesh(
        new THREE.TorusGeometry(0.5, 0.012, 8, 72),
        new THREE.MeshBasicMaterial({
          color,
          opacity: 0.22,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      )
      base.rotation.x = Math.PI / 2
      group.add(base)

      const nodeCore = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.72, 0.42),
        new THREE.MeshStandardMaterial({
          color: 0x0f2435,
          emissive: color,
          emissiveIntensity: 0.62,
          metalness: 0.4,
          roughness: 0.24,
        })
      )
      nodeCore.position.y = 0.52
      group.add(nodeCore)

      const panel = new THREE.Mesh(
        new THREE.PlaneGeometry(0.82, 0.26),
        new THREE.MeshBasicMaterial({
          color,
          opacity: 0.16,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        })
      )
      panel.position.set(0, 0.82, 0)
      group.add(panel)

      const beacon = new THREE.Mesh(
        new THREE.CylinderGeometry(0.018, 0.045, 0.74, 20),
        new THREE.MeshBasicMaterial({
          color,
          opacity: 0.34,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      )
      beacon.position.y = 0.88
      group.add(beacon)

      const halo = new THREE.Mesh(
        new THREE.TorusGeometry(0.52, 0.016, 8, 72),
        new THREE.MeshBasicMaterial({
          color,
          opacity: 0.55,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      )
      halo.rotation.x = Math.PI / 2
      halo.position.y = 0.08
      group.add(halo)

      // invisible, generous click target
      const hit = new THREE.Mesh(
        new THREE.SphereGeometry(0.62, 12, 12),
        new THREE.MeshBasicMaterial({
          opacity: 0,
          transparent: true,
          depthWrite: false,
        })
      )
      hit.position.y = 0.35
      group.add(hit)
      clickTargets.push({ mesh: hit, key })

      nodeObjects.push({ halo, core: nodeCore, panel, beacon, key, intensity: 0.3 })

      // Signal route from command module to the asset scanner, with 2 particles.
      const start = position.clone()
      start.y += 0.45
      const end = new THREE.Vector3(0, 1.12, 0)
      const curve = makeRoute(start, end)
      const material = new THREE.MeshBasicMaterial({
        color,
        opacity: 0.18,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 64, 0.014, 8, false), material)
      rig.add(tube)

      const particleMaterial = new THREE.MeshBasicMaterial({
        color,
        opacity: 0.8,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
      const particles = [0, 0.5].map(() => {
        const particle = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 16), particleMaterial)
        rig.add(particle)
        return particle
      })

      routes.push({
        curve,
        material,
        particles,
        particleMaterial,
        key,
        offset: index * 0.14,
        speed: 0.05,
        intensity: 0.3,
      })
    })

    // Click handling via raycaster
    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    let hoveredKey: AgentKey | null = null
    const handleClick = (event: MouseEvent) => {
      const rect = container.getBoundingClientRect()
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(pointer, camera)
      const hits = raycaster.intersectObjects(clickTargets.map((t) => t.mesh))
      if (hits.length) {
        const target = clickTargets.find((t) => t.mesh === hits[0].object)
        if (target) clickRef.current?.(target.key)
      }
    }
    container.addEventListener("click", handleClick)

    let frame = 0
    let animationId = 0
    let pointerX = 0
    let pointerY = 0
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches

    const resize = () => {
      const width = container.clientWidth
      const height = container.clientHeight
      renderer.setSize(width, height, false)
      const aspect = width / Math.max(height, 1)
      camera.aspect = aspect
      const distance = aspect < 0.8 ? 12.5 : aspect < 1.3 ? 10.2 : 8.6
      camera.position.set(0, aspect < 1 ? 5.1 : 4.4, distance)
      camera.lookAt(0, 0.7, 0)
      camera.updateProjectionMatrix()
    }

    const handlePointerMove = (event: PointerEvent) => {
      const rect = container.getBoundingClientRect()
      pointerX = ((event.clientX - rect.left) / rect.width - 0.5) * 2
      pointerY = ((event.clientY - rect.top) / rect.height - 0.5) * 2
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(pointer, camera)
      const hits = raycaster.intersectObjects(clickTargets.map((target) => target.mesh))
      const target = hits.length ? clickTargets.find((item) => item.mesh === hits[0].object) : null
      hoveredKey = target?.key ?? null
      container.style.cursor = hoveredKey ? "pointer" : "grab"
    }

    const syncIntensities = () => {
      const map = new Map(nodesRef.current.map((node) => [node.key, node.intensity]))
      nodeObjects.forEach((node) => {
        node.intensity = map.get(node.key) ?? 0.2
      })
      routes.forEach((route) => {
        route.intensity = map.get(route.key) ?? 0.2
        route.speed = 0.035 + route.intensity * 0.085
      })
    }
    syncIntensities()
    const intensityTimer = window.setInterval(syncIntensities, 1500)
    let lastPulse = scanPulseRef.current
    let pulseStart = -10

    const renderScene = () => {
      frame += 0.016
      const focus = focusRef.current
      const mode = visualModeRef.current
      const boostedAgents = MODE_AGENT_BOOST[mode]
      const modeEnergy =
        mode === "value"
          ? { scan: 0.8, value: 1.45, route: 0.8, offer: 0.75 }
          : mode === "route"
            ? { scan: 0.7, value: 0.85, route: 1.55, offer: 0.75 }
            : mode === "offer"
              ? { scan: 0.95, value: 1.2, route: 1.05, offer: 1.55 }
              : { scan: 1.35, value: 0.9, route: 0.85, offer: 0.65 }

      if (scanPulseRef.current !== lastPulse) {
        lastPulse = scanPulseRef.current
        pulseStart = frame
      }
      const pulseAge = frame - pulseStart
      const pulseStrength = pulseAge >= 0 && pulseAge < 1.2 ? 1 - pulseAge / 1.2 : 0

      rig.rotation.y = Math.sin(frame * 0.18) * 0.1 + pointerX * 0.06
      rig.rotation.x = -0.14 + pointerY * -0.03
      coreGroup.rotation.y = Math.sin(frame * 0.22) * 0.08
      coreGlow.scale.setScalar(1 + Math.sin(frame * 1.4) * 0.06 + pulseStrength * 0.42)
      const coreGlowMaterial = coreGlow.material as THREE.MeshBasicMaterial
      coreGlowMaterial.opacity = 0.04 + modeEnergy.scan * 0.02 + pulseStrength * 0.08
      orbit.rotation.z += 0.003
      const orbitMaterial = orbit.material as THREE.MeshBasicMaterial
      orbitMaterial.opacity = 0.18 + modeEnergy.route * 0.09 + pulseStrength * 0.12
      offerField.rotation.z -= 0.0025
      const offerMaterial = offerField.material as THREE.MeshBasicMaterial
      offerMaterial.opacity = mode === "offer" ? 0.18 + Math.sin(frame * 1.2) * 0.03 : 0.04
      scanShell.rotation.y += 0.0025
      scanShell.rotation.z = Math.sin(frame * 0.42) * 0.06
      const scanShellMaterial = scanShell.material as THREE.MeshBasicMaterial
      scanShellMaterial.opacity = 0.028 + modeEnergy.scan * 0.025 + pulseStrength * 0.06
      verticalOrbits.forEach((ring, index) => {
        ring.rotation.z += 0.0015 + index * 0.0008
        const ringMaterial = ring.material as THREE.MeshBasicMaterial
        ringMaterial.opacity = 0.035 + Math.sin(frame * 0.9 + index) * 0.02 + index * 0.012 + modeEnergy.scan * 0.018
      })
      roofEdges.rotation.y = roof.rotation.y + Math.sin(frame * 0.7) * 0.025
      const doorMaterial = doorGlow.material as THREE.MeshBasicMaterial
      doorMaterial.opacity = 0.22 + Math.sin(frame * 2.4) * 0.08 + modeEnergy.offer * 0.04
      valuationBeam.scale.y = 0.88 + Math.sin(frame * 1.15) * 0.08 + modeEnergy.value * 0.16
      const valuationMaterial = valuationBeam.material as THREE.MeshBasicMaterial
      valuationMaterial.opacity = 0.08 + modeEnergy.value * 0.08 + pulseStrength * 0.08
      scanBar.position.z = -1.25 + ((frame * (0.72 + modeEnergy.scan * 0.22)) % 2.5)
      scanBar.scale.x = 0.84 + pulseStrength * 0.3
      scanBarMaterial.opacity = 0.07 + modeEnergy.scan * 0.1 + pulseStrength * 0.18
      scanRings.forEach((ring, index) => {
        ring.rotation.z += 0.002 + index * 0.001
        const ringMaterial = ring.material as THREE.MeshBasicMaterial
        ringMaterial.opacity = 0.05 + Math.sin(frame * 1.1 + index) * 0.035 + index * 0.018 + modeEnergy.scan * 0.035 + pulseStrength * 0.08
      })
      dataPlanes.forEach((plane, index) => {
        plane.position.y += Math.sin(frame * 0.82 + index) * 0.0009
        plane.rotation.z = Math.sin(frame * 0.5 + index) * 0.025
        const planeMaterial = plane.material as THREE.MeshBasicMaterial
        planeMaterial.opacity = 0.06 + Math.sin(frame * 1.35 + index) * 0.03 + modeEnergy.value * 0.07
        plane.scale.setScalar(0.92 + modeEnergy.value * 0.08 + pulseStrength * 0.08)
      })
      marketBlocks.forEach((block, index) => {
        const blockMaterial = block.material as THREE.MeshBasicMaterial
        block.scale.y = 0.82 + Math.sin(frame * (1.2 + index * 0.08) + index) * 0.18 + modeEnergy.value * 0.16
        blockMaterial.opacity = 0.08 + modeEnergy.value * 0.08 + pulseStrength * 0.04
      })
      scannerParticles.forEach(({ particle, radius, y, speed, phase }, index) => {
        const particleMaterial = particle.material as THREE.MeshBasicMaterial
        const angle = frame * speed * (1 + modeEnergy.scan * 0.35) + phase
        const activeRadius = radius + pulseStrength * 0.24
        particle.position.set(Math.cos(angle) * activeRadius, y + Math.sin(angle * 0.8) * 0.08, Math.sin(angle) * activeRadius * 0.62)
        particle.scale.setScalar(0.78 + Math.sin(frame * 1.6 + index) * 0.16 + modeEnergy.scan * 0.12 + pulseStrength * 1.2)
        particleMaterial.opacity = 0.16 + modeEnergy.scan * 0.18 + Math.sin(frame * 1.8 + phase) * 0.05 + pulseStrength * 0.24
      })
      valuePillars.forEach(({ pillar, height }, index) => {
        const pillarMaterial = pillar.material as THREE.MeshBasicMaterial
        const lift = mode === "value" ? 1 : 0.48
        pillar.scale.y = height * lift + Math.sin(frame * 1.35 + index) * 0.035 + pulseStrength * 0.08
        pillar.position.y = 0.08 + Math.max(pillar.scale.y, 0.05) / 2
        pillarMaterial.opacity = mode === "value" ? 0.3 + Math.sin(frame * 1.2 + index) * 0.04 : 0.08 + modeEnergy.value * 0.05
      })
      offerPaths.forEach((path, pathIndex) => {
        const offerActive = mode === "offer" ? 1 : 0
        path.material.opacity = 0.04 + offerActive * 0.24 + pulseStrength * 0.04
        path.markerMaterial.opacity = 0.08 + offerActive * 0.28 + Math.sin(frame * 1.6 + pathIndex) * 0.04
        path.marker.scale.setScalar(0.92 + offerActive * 0.28 + Math.sin(frame * 1.5 + pathIndex) * 0.08)
        path.marker.rotation.z += 0.004 + offerActive * 0.006
        path.particleMaterial.opacity = 0.08 + offerActive * 0.58
        path.particles.forEach((particle, particleIndex) => {
          const progress = (frame * (0.18 + offerActive * 0.22) + path.phase + particleIndex * 0.5) % 1
          particle.position.copy(path.curve.getPointAt(progress))
          particle.scale.setScalar((0.62 + offerActive * 0.72) * (0.72 + Math.sin(progress * Math.PI) * 0.6))
        })
      })

      nodeObjects.forEach((node, index) => {
        const isFocused = focus === node.key
        const isHovered = hoveredKey === node.key
        const isModeBoosted = boostedAgents.includes(node.key)
        const dim = focus && !isFocused
        const energy = 0.35 + node.intensity * 0.65 + (isModeBoosted ? 0.38 : 0) + (isHovered ? 0.35 : 0)
        const pulse = 1 + Math.sin(frame * (1.4 + node.intensity * 1.6) + index) * (0.05 + node.intensity * 0.1)
        node.halo.scale.setScalar(isFocused || isHovered ? pulse * 1.28 : isModeBoosted ? pulse * 1.12 : pulse)
        const haloMaterial = node.halo.material as THREE.MeshBasicMaterial
        haloMaterial.opacity = dim ? 0.12 : 0.22 + energy * 0.46
        const coreMaterial = node.core.material as THREE.MeshStandardMaterial
        coreMaterial.emissiveIntensity = dim ? 0.2 : 0.3 + energy * 0.5
        node.core.scale.setScalar(isFocused || isHovered ? 1.12 : isModeBoosted ? 1.06 : 1 + node.intensity * 0.04)
        const panelMaterial = node.panel.material as THREE.MeshBasicMaterial
        panelMaterial.opacity = dim ? 0.04 : 0.08 + energy * 0.18
        node.panel.scale.setScalar(isFocused || isHovered ? 1.18 : isModeBoosted ? 1.1 : 1 + node.intensity * 0.05)
        const beaconMaterial = node.beacon.material as THREE.MeshBasicMaterial
        beaconMaterial.opacity = dim ? 0.08 : 0.16 + energy * 0.28
        node.beacon.scale.y = isFocused || isHovered ? 1.22 : isModeBoosted ? 1.1 : 0.88 + Math.sin(frame * 1.8 + index) * 0.1
      })

      routes.forEach((route) => {
        const isFocused = focus === route.key
        const isHovered = hoveredKey === route.key
        const isModeBoosted = boostedAgents.includes(route.key)
        const dim = focus && !isFocused
        route.material.opacity = dim ? 0.04 : 0.08 + route.intensity * 0.32 + modeEnergy.route * 0.05 + (isFocused || isHovered || isModeBoosted ? 0.12 : 0)
        route.particleMaterial.opacity = dim ? 0.1 : 0.36 + route.intensity * 0.42 + modeEnergy.route * 0.08 + (isFocused || isHovered || isModeBoosted ? 0.12 : 0)
        route.particles.forEach((particle, particleIndex) => {
          const progress = (frame * route.speed * (1 + modeEnergy.route * 0.35) + route.offset + particleIndex * 0.5) % 1
          particle.position.copy(route.curve.getPointAt(progress))
          particle.scale.setScalar(
            (dim ? 0.5 : 0.68 + route.intensity * 0.58 + (isFocused || isHovered || isModeBoosted ? 0.28 : 0)) *
              (0.7 + Math.sin(progress * Math.PI) * 0.5)
          )
        })
      })

      renderer.render(scene, camera)
      animationId = window.requestAnimationFrame(renderScene)
    }

    const observer = new ResizeObserver(resize)
    observer.observe(container)
    resize()

    if (!prefersReducedMotion) {
      container.addEventListener("pointermove", handlePointerMove)
      renderScene()
    } else {
      syncIntensities()
      renderer.render(scene, camera)
    }

    return () => {
      window.cancelAnimationFrame(animationId)
      window.clearInterval(intensityTimer)
      observer.disconnect()
      container.removeEventListener("click", handleClick)
      if (!prefersReducedMotion) {
        container.removeEventListener("pointermove", handlePointerMove)
      }
      container.style.cursor = ""
      scene.traverse(disposeObject)
      renderer.dispose()
    }
  }, [])

  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_46%,rgba(34,211,238,0.20),transparent_22%),radial-gradient(circle_at_22%_18%,rgba(168,85,247,0.18),transparent_30%),linear-gradient(135deg,rgba(2,6,23,0.58),rgba(8,13,29,0.10)_48%,rgba(2,6,23,0.72))]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 z-[2] h-[72%] w-[72%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-300/10 shadow-[inset_0_0_65px_rgba(34,211,238,0.08),0_0_90px_rgba(34,211,238,0.08)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 z-[2] h-[48%] w-[48%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-200/15 shadow-[0_0_60px_rgba(34,211,238,0.08)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-8 top-1/2 z-[2] h-px bg-gradient-to-r from-transparent via-cyan-200/30 to-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-8 left-1/2 z-[2] w-px bg-gradient-to-b from-transparent via-cyan-200/20 to-transparent"
      />
      <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 z-[3] h-full w-full" />
      <MissionCanvasOverlay
        nodes={nodes}
        focusedAgent={focusedAgent}
        visualMode={visualMode}
        onVisualModeChange={setVisualMode}
        onScanPulse={() => setScanPulse((current) => current + 1)}
        onAgentClick={onAgentClick}
        onAgentAction={onAgentAction}
        onOpenCodex={onOpenCodex}
        onAskCodex={onAskCodex}
      />
    </>
  )
}

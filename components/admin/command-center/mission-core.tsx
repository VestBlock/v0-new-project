"use client"

import { useEffect, useRef } from "react"
import * as THREE from "three"
import type { AgentKey, MissionNode } from "@/lib/admin/commandCenter"

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
}: {
  nodes: MissionNode[]
  focusedAgent: AgentKey | null
  onAgentClick?: (key: AgentKey) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const nodesRef = useRef(nodes)
  const focusRef = useRef<AgentKey | null>(focusedAgent)
  const clickRef = useRef(onAgentClick)

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
    const canvas = canvasRef.current
    const container = canvas?.parentElement
    if (!canvas || !container) return

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      canvas,
      powerPreference: "high-performance",
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

    const grid = new THREE.GridHelper(12, 36, 0x22d3ee, 0x1e3a5f)
    const gridMaterial = grid.material as THREE.Material
    gridMaterial.transparent = true
    gridMaterial.opacity = 0.14
    rig.add(grid)

    // Central core: the business itself
    const coreGroup = new THREE.Group()
    coreGroup.position.set(0, 1.05, 0)
    rig.add(coreGroup)

    const core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.55, 1),
      new THREE.MeshPhysicalMaterial({
        color: 0x67e8f9,
        emissive: 0x0891b2,
        emissiveIntensity: 0.6,
        metalness: 0.35,
        roughness: 0.15,
        opacity: 0.72,
        transparent: true,
      })
    )
    coreGroup.add(core)
    const coreEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(core.geometry),
      new THREE.LineBasicMaterial({ color: 0xbae6fd, opacity: 0.7, transparent: true })
    )
    coreGroup.add(coreEdges)

    const coreGlow = new THREE.Mesh(
      new THREE.SphereGeometry(0.95, 32, 24),
      new THREE.MeshBasicMaterial({
        color: 0x22d3ee,
        opacity: 0.07,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    )
    coreGroup.add(coreGlow)

    const orbit = new THREE.Mesh(
      new THREE.TorusGeometry(1.35, 0.012, 8, 140),
      new THREE.MeshBasicMaterial({
        color: 0x67e8f9,
        opacity: 0.35,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    )
    orbit.rotation.x = Math.PI / 2.4
    coreGroup.add(orbit)

    // Agent nodes around the core
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

      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(0.42, 0.52, 0.07, 48),
        new THREE.MeshBasicMaterial({
          color,
          opacity: 0.14,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      )
      group.add(base)

      const nodeCore = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.26, 0),
        new THREE.MeshStandardMaterial({
          color: 0x0f2435,
          emissive: color,
          emissiveIntensity: 0.5,
          metalness: 0.4,
          roughness: 0.3,
        })
      )
      nodeCore.position.y = 0.42
      group.add(nodeCore)

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
        new THREE.MeshBasicMaterial({ visible: false })
      )
      hit.position.y = 0.35
      group.add(hit)
      clickTargets.push({ mesh: hit, key })

      nodeObjects.push({ halo, core: nodeCore, key, intensity: 0.3 })

      // Route from node to core, with 2 particles
      const start = position.clone()
      start.y += 0.45
      const end = new THREE.Vector3(0, 1.05, 0)
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

    const renderScene = () => {
      frame += 0.016
      const focus = focusRef.current

      rig.rotation.y = Math.sin(frame * 0.18) * 0.1 + pointerX * 0.06
      rig.rotation.x = -0.14 + pointerY * -0.03
      coreGroup.rotation.y += 0.004
      core.rotation.x += 0.003
      coreEdges.rotation.copy(core.rotation)
      coreGlow.scale.setScalar(1 + Math.sin(frame * 1.4) * 0.06)
      orbit.rotation.z += 0.003

      nodeObjects.forEach((node, index) => {
        const isFocused = focus === node.key
        const dim = focus && !isFocused
        const energy = 0.35 + node.intensity * 0.65
        const pulse = 1 + Math.sin(frame * (1.4 + node.intensity * 1.6) + index) * (0.05 + node.intensity * 0.1)
        node.halo.scale.setScalar(isFocused ? pulse * 1.2 : pulse)
        const haloMaterial = node.halo.material as THREE.MeshBasicMaterial
        haloMaterial.opacity = dim ? 0.16 : 0.3 + energy * 0.55
        const coreMaterial = node.core.material as THREE.MeshStandardMaterial
        coreMaterial.emissiveIntensity = dim ? 0.2 : 0.3 + energy * 0.5
        node.core.rotation.y += 0.008 + node.intensity * 0.012
      })

      routes.forEach((route) => {
        const isFocused = focus === route.key
        const dim = focus && !isFocused
        route.material.opacity = dim ? 0.05 : 0.1 + route.intensity * 0.4
        route.particleMaterial.opacity = dim ? 0.12 : 0.45 + route.intensity * 0.5
        route.particles.forEach((particle, particleIndex) => {
          const progress = (frame * route.speed + route.offset + particleIndex * 0.5) % 1
          particle.position.copy(route.curve.getPointAt(progress))
          particle.scale.setScalar((dim ? 0.5 : 0.75 + route.intensity * 0.7) * (0.7 + Math.sin(progress * Math.PI) * 0.5))
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
      scene.traverse(disposeObject)
      renderer.dispose()
    }
  }, [])

  return <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 h-full w-full" />
}

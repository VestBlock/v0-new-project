"use client"

import { useEffect, useRef } from "react"
import * as THREE from "three"

export type CommandRole = "seller" | "buyer" | "lender" | "builder"

type RouteObject = {
  material: THREE.MeshBasicMaterial
  particle: THREE.Mesh
  particleMaterial: THREE.MeshBasicMaterial
  curve: THREE.CatmullRomCurve3
  role: CommandRole
  offset: number
  speed: number
}

type NodeObject = {
  halo: THREE.Mesh
  role: CommandRole
}

const roleColors: Record<CommandRole, number> = {
  seller: 0x22d3ee,
  buyer: 0x60a5fa,
  lender: 0xfacc15,
  builder: 0xa855f7,
}

const rolePositions: Record<CommandRole, THREE.Vector3> = {
  seller: new THREE.Vector3(-4.1, 0.18, 1.6),
  buyer: new THREE.Vector3(-1.6, 0.18, -2.3),
  lender: new THREE.Vector3(2.15, 0.18, -2.0),
  builder: new THREE.Vector3(4.1, 0.18, 1.25),
}

function makeRoute(start: THREE.Vector3, end: THREE.Vector3) {
  const middle = start.clone().lerp(end, 0.5)
  middle.y += 1.55
  middle.z += start.z > end.z ? -0.55 : 0.55
  return new THREE.CatmullRomCurve3([start, middle, end])
}

function makeHouse(color: number) {
  const group = new THREE.Group()

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.78, 0.54, 0.68),
    new THREE.MeshStandardMaterial({
      color: 0x0f2435,
      emissive: color,
      emissiveIntensity: 0.18,
      metalness: 0.32,
      roughness: 0.38,
    }),
  )
  body.position.y = 0.36
  group.add(body)

  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(0.68, 0.48, 4),
    new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.55,
      metalness: 0.38,
      roughness: 0.24,
    }),
  )
  roof.position.y = 0.86
  roof.rotation.y = Math.PI / 4
  group.add(roof)

  const windowMaterial = new THREE.MeshBasicMaterial({
    color: 0xe0f2fe,
    opacity: 0.86,
    transparent: true,
  })
  ;[-0.18, 0.18].forEach((xPosition) => {
    const pane = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.02), windowMaterial)
    pane.position.set(xPosition, 0.42, 0.35)
    group.add(pane)
  })

  return group
}

function makeCoinStack() {
  const group = new THREE.Group()
  const material = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.46,
    metalness: 0.82,
    roughness: 0.2,
  })

  for (let index = 0; index < 9; index += 1) {
    const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.075, 56), material)
    coin.position.y = 0.08 + index * 0.075
    coin.rotation.y = index * 0.22
    group.add(coin)
  }

  const symbolMaterial = new THREE.MeshBasicMaterial({
    color: 0xfef3c7,
    opacity: 0.92,
    transparent: true,
  })
  const symbol = new THREE.Group()
  symbol.position.y = 0.98
  const upper = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.014, 8, 36), symbolMaterial)
  upper.position.y = 0.1
  const lower = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.014, 8, 36), symbolMaterial)
  lower.position.y = -0.1
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.46, 0.035), symbolMaterial)
  symbol.add(upper, lower, bar)
  group.add(symbol)

  return group
}

function makeBuilderBlocks(color: number) {
  const group = new THREE.Group()
  const material = new THREE.MeshStandardMaterial({
    color: 0x1f1640,
    emissive: color,
    emissiveIntensity: 0.28,
    metalness: 0.42,
    roughness: 0.32,
  })

  ;[
    [-0.35, 0.28, 0, 0.34, 0.56],
    [0.02, 0.44, 0.05, 0.34, 0.88],
    [0.39, 0.62, -0.02, 0.34, 1.24],
  ].forEach(([x, y, z, width, height]) => {
    const tower = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.42), material)
    tower.position.set(x, y, z)
    group.add(tower)
  })

  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(1.08, 0.06, 0.08),
    new THREE.MeshBasicMaterial({ color, opacity: 0.8, transparent: true }),
  )
  roof.position.set(0.03, 1.3, 0)
  roof.rotation.z = -0.22
  group.add(roof)

  return group
}

function makeRoleNode(role: CommandRole) {
  const color = roleColors[role]
  const group = new THREE.Group()
  group.position.copy(rolePositions[role])

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.72, 0.88, 0.1, 72),
    new THREE.MeshBasicMaterial({
      color,
      opacity: 0.16,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  )
  base.position.y = 0.02
  group.add(base)

  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(0.86, 0.022, 10, 96),
    new THREE.MeshBasicMaterial({
      color,
      opacity: 0.72,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  )
  halo.rotation.x = Math.PI / 2
  halo.position.y = 0.11
  group.add(halo)

  if (role === "lender") {
    const stack = makeCoinStack()
    stack.position.y = 0.1
    group.add(stack)
  } else if (role === "builder") {
    const blocks = makeBuilderBlocks(color)
    blocks.position.y = 0.08
    group.add(blocks)
  } else {
    const house = makeHouse(color)
    house.position.y = 0.08
    group.add(house)
  }

  return { group, halo }
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

export function VestBlockCommandScene({ activeRole }: { activeRole: CommandRole }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const activeRoleRef = useRef<CommandRole>(activeRole)

  useEffect(() => {
    activeRoleRef.current = activeRole
  }, [activeRole])

  useEffect(() => {
    const canvas = canvasRef.current
    const container = canvas?.parentElement

    if (!canvas || !container) {
      return
    }

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      canvas,
      powerPreference: "high-performance",
    })
    renderer.setClearColor(0x000000, 0)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7))

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(43, 1, 0.1, 100)
    camera.position.set(0.1, 3.45, 8.5)
    camera.lookAt(0, 1.15, 0)

    const ambient = new THREE.AmbientLight(0x9bdcff, 1.2)
    scene.add(ambient)

    const cyanLight = new THREE.PointLight(0x22d3ee, 8.5, 18)
    cyanLight.position.set(-3.8, 4.2, 4.1)
    scene.add(cyanLight)

    const violetLight = new THREE.PointLight(0xa855f7, 7, 18)
    violetLight.position.set(3.8, 4.6, 3.4)
    scene.add(violetLight)

    const goldLight = new THREE.PointLight(0xfacc15, 3.8, 14)
    goldLight.position.set(1.8, 2.8, -2.8)
    scene.add(goldLight)

    const rig = new THREE.Group()
    rig.rotation.x = -0.18
    rig.position.y = -0.35
    scene.add(rig)

    const floor = new THREE.Group()
    floor.rotation.x = -Math.PI / 2
    rig.add(floor)

    const grid = new THREE.GridHelper(11, 34, 0x22d3ee, 0x1d4ed8)
    const gridMaterial = grid.material as THREE.Material
    gridMaterial.transparent = true
    gridMaterial.opacity = 0.22
    rig.add(grid)

    const platform = new THREE.Mesh(
      new THREE.CircleGeometry(4.25, 128),
      new THREE.MeshBasicMaterial({
        color: 0x0f172a,
        opacity: 0.3,
        side: THREE.DoubleSide,
        transparent: true,
      }),
    )
    platform.rotation.x = -Math.PI / 2
    platform.position.y = -0.04
    rig.add(platform)

    const commandCore = new THREE.Group()
    commandCore.position.set(0, 1.35, 0.08)
    rig.add(commandCore)

    const logoMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    })
    const logo = new THREE.Mesh(new THREE.PlaneGeometry(3.95, 3.95), logoMaterial)
    logo.position.set(0, 0.34, 0)
    logo.rotation.y = -0.08
    commandCore.add(logo)

    const loader = new THREE.TextureLoader()
    const logoTexture = loader.load("/vestblock-mark-transparent.png", (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy()
      logoMaterial.map = texture
      logoMaterial.opacity = 0.96
      logoMaterial.needsUpdate = true
    })

    const backGlow = new THREE.Mesh(
      new THREE.SphereGeometry(1.95, 48, 32),
      new THREE.MeshBasicMaterial({
        color: 0x22d3ee,
        opacity: 0.09,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    )
    backGlow.scale.set(1.25, 0.84, 0.2)
    backGlow.position.z = -0.22
    commandCore.add(backGlow)

    const proofCore = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.62, 0),
      new THREE.MeshPhysicalMaterial({
        color: 0x67e8f9,
        emissive: 0x0891b2,
        emissiveIntensity: 0.55,
        metalness: 0.36,
        opacity: 0.66,
        roughness: 0.12,
        transparent: true,
        transmission: 0.08,
      }),
    )
    proofCore.position.set(2.08, 0.4, -0.55)
    commandCore.add(proofCore)

    const proofEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(proofCore.geometry),
      new THREE.LineBasicMaterial({
        color: 0xfacc15,
        opacity: 0.82,
        transparent: true,
      }),
    )
    proofEdges.position.copy(proofCore.position)
    commandCore.add(proofEdges)

    const orbitMaterial = new THREE.MeshBasicMaterial({
      color: 0x67e8f9,
      opacity: 0.42,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    const orbitOne = new THREE.Mesh(new THREE.TorusGeometry(2.38, 0.018, 10, 160), orbitMaterial)
    orbitOne.rotation.x = Math.PI / 2.65
    orbitOne.rotation.z = -0.12
    commandCore.add(orbitOne)

    const orbitTwo = new THREE.Mesh(
      new THREE.TorusGeometry(1.72, 0.014, 10, 160),
      new THREE.MeshBasicMaterial({
        color: 0xa855f7,
        opacity: 0.38,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    )
    orbitTwo.rotation.x = Math.PI / 2.45
    orbitTwo.rotation.z = 0.26
    commandCore.add(orbitTwo)

    const nodes: NodeObject[] = []
    ;(Object.keys(rolePositions) as CommandRole[]).forEach((role) => {
      const { group, halo } = makeRoleNode(role)
      rig.add(group)
      nodes.push({ halo, role })
    })

    const routes: RouteObject[] = []
    ;(Object.keys(rolePositions) as CommandRole[]).forEach((role, index) => {
      const color = roleColors[role]
      const start = rolePositions[role].clone()
      start.y += role === "lender" ? 1.35 : role === "builder" ? 1.55 : 1.18
      const end = new THREE.Vector3(role === "builder" ? 1.15 : role === "seller" ? -1.1 : 0, 2.15, 0.04)
      const curve = makeRoute(start, end)

      const material = new THREE.MeshBasicMaterial({
        color,
        opacity: 0.3,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 96, 0.023, 10, false), material)
      rig.add(tube)

      const particleMaterial = new THREE.MeshBasicMaterial({
        color,
        opacity: 0.86,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
      const particle = new THREE.Mesh(new THREE.SphereGeometry(0.1, 24, 24), particleMaterial)
      rig.add(particle)
      routes.push({
        curve,
        material,
        offset: index * 0.23,
        particle,
        particleMaterial,
        role,
        speed: 0.078 + index * 0.011,
      })
    })

    const parcelMaterial = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      opacity: 0.12,
      transparent: true,
    })
    for (let index = 0; index < 28; index += 1) {
      const parcel = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.045, 0.52), parcelMaterial)
      parcel.position.set(-5.1 + (index % 7) * 1.42, 0.025, -3.75 + Math.floor(index / 7) * 1.05)
      parcel.rotation.y = ((index % 4) - 1.5) * 0.08
      rig.add(parcel)
    }

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
      // Pull the camera back / raise it on tall or narrow viewports so the
      // full Seller→Buyer→Lender→Operator spread stays framed as a background.
      const distance = aspect < 0.7 ? 13 : aspect < 1 ? 11 : aspect < 1.5 ? 9.4 : 8.5
      const heightY = aspect < 1 ? 4.3 : 3.45
      camera.position.set(0.1, heightY, distance)
      camera.lookAt(0, 1.15, 0)
      camera.updateProjectionMatrix()
    }

    const handlePointerMove = (event: PointerEvent) => {
      const rect = container.getBoundingClientRect()
      pointerX = ((event.clientX - rect.left) / rect.width - 0.5) * 2
      pointerY = ((event.clientY - rect.top) / rect.height - 0.5) * 2
    }

    const renderScene = () => {
      frame += 0.016
      const active = activeRoleRef.current

      rig.rotation.y = Math.sin(frame * 0.32) * 0.13 + pointerX * 0.08
      rig.rotation.x = -0.18 + pointerY * -0.035
      commandCore.position.y = 1.35 + Math.sin(frame * 0.9) * 0.07
      commandCore.rotation.y = Math.sin(frame * 0.42) * 0.04
      logo.rotation.y = -0.08 + Math.sin(frame * 0.65) * 0.04
      backGlow.scale.set(1.25 + Math.sin(frame * 1.2) * 0.05, 0.84 + Math.sin(frame * 1.2) * 0.04, 0.2)
      proofCore.rotation.y += 0.012
      proofCore.rotation.x += 0.005
      proofEdges.rotation.copy(proofCore.rotation)
      orbitOne.rotation.z += 0.0035
      orbitTwo.rotation.z -= 0.0045

      nodes.forEach((node, index) => {
        const isActive = node.role === active
        const pulse = 1 + Math.sin(frame * 2.2 + index * 0.72) * (isActive ? 0.16 : 0.07)
        node.halo.scale.setScalar(isActive ? pulse * 1.14 : pulse)
        const material = node.halo.material as THREE.MeshBasicMaterial
        material.opacity = isActive ? 0.9 : 0.42
      })

      routes.forEach((route) => {
        const isActive = route.role === active
        route.material.opacity = isActive ? 0.72 : 0.22
        route.particleMaterial.opacity = isActive ? 1 : 0.46
        const progress = (frame * route.speed + route.offset) % 1
        route.particle.position.copy(route.curve.getPointAt(progress))
        route.particle.scale.setScalar(isActive ? 1.2 + Math.sin(progress * Math.PI) * 0.78 : 0.7)
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
      renderer.render(scene, camera)
    }

    return () => {
      window.cancelAnimationFrame(animationId)
      observer.disconnect()
      if (!prefersReducedMotion) {
        container.removeEventListener("pointermove", handlePointerMove)
      }
      logoTexture.dispose()
      scene.traverse(disposeObject)
      renderer.dispose()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      data-vestblock-command-scene="true"
      className="absolute inset-0 h-full w-full"
    />
  )
}

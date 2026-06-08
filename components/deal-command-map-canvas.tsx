"use client"

import { useEffect, useRef } from "react"
import * as THREE from "three"

const nodes = [
  { key: "seller", position: new THREE.Vector3(-3.8, 0.45, 1.65), color: 0x22d3ee, height: 1.1 },
  { key: "buyer", position: new THREE.Vector3(-1.2, 0.45, -2.45), color: 0x60a5fa, height: 0.9 },
  { key: "lender", position: new THREE.Vector3(2.15, 0.45, -2.05), color: 0xa78bfa, height: 1 },
  { key: "vault", position: new THREE.Vector3(3.25, 0.6, 1.35), color: 0xfacc15, height: 1.25 },
] as const

const routePairs = [
  ["seller", "buyer"],
  ["seller", "lender"],
  ["buyer", "vault"],
  ["lender", "vault"],
] as const

const nodeMap = new Map(nodes.map((node) => [node.key, node]))

function makeCurve(start: THREE.Vector3, end: THREE.Vector3) {
  const mid = start.clone().lerp(end, 0.5)
  mid.y += 1.05
  mid.z += start.z > end.z ? -0.3 : 0.3
  return new THREE.CatmullRomCurve3([start, mid, end])
}

function makeTower(node: (typeof nodes)[number]) {
  const group = new THREE.Group()
  group.position.copy(node.position)

  const baseMaterial = new THREE.MeshStandardMaterial({
    color: node.color,
    emissive: node.color,
    emissiveIntensity: 0.45,
    metalness: 0.35,
    opacity: 0.8,
    roughness: 0.35,
    transparent: true,
  })

  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.3, node.height, 36), baseMaterial)
  column.position.y = node.height / 2
  group.add(column)

  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 32, 32),
    new THREE.MeshStandardMaterial({
      color: node.color,
      emissive: node.color,
      emissiveIntensity: 1.1,
      metalness: 0.2,
      roughness: 0.18,
    }),
  )
  cap.position.y = node.height + 0.16
  group.add(cap)

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.58, 0.018, 10, 96),
    new THREE.MeshBasicMaterial({ color: node.color, opacity: 0.75, transparent: true }),
  )
  ring.rotation.x = Math.PI / 2
  ring.position.y = 0.08
  group.add(ring)

  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.18, node.height + 1.1, 32, 1, true),
    new THREE.MeshBasicMaterial({ color: node.color, opacity: 0.16, side: THREE.DoubleSide, transparent: true }),
  )
  beam.position.y = (node.height + 1.1) / 2
  group.add(beam)

  if (node.key !== "vault") {
    const house = new THREE.Group()
    house.position.set(-0.46, 0.05, 0.18)

    const houseBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.66, 0.46, 0.58),
      new THREE.MeshStandardMaterial({
        color: 0x0f2f46,
        emissive: node.color,
        emissiveIntensity: 0.18,
        metalness: 0.2,
        roughness: 0.42,
      }),
    )
    houseBody.position.y = 0.23
    house.add(houseBody)

    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(0.52, 0.42, 4),
      new THREE.MeshStandardMaterial({
        color: node.color,
        emissive: node.color,
        emissiveIntensity: 0.5,
        metalness: 0.3,
        roughness: 0.28,
      }),
    )
    roof.position.y = 0.69
    roof.rotation.y = Math.PI / 4
    house.add(roof)

    const door = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.24, 0.018),
      new THREE.MeshBasicMaterial({ color: 0xe0f2fe, opacity: 0.72, transparent: true }),
    )
    door.position.set(0, 0.16, 0.3)
    house.add(door)

    const windowMaterial = new THREE.MeshBasicMaterial({ color: 0x67e8f9, opacity: 0.65, transparent: true })
    ;[-0.19, 0.19].forEach((xPosition) => {
      const windowPane = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.018), windowMaterial)
      windowPane.position.set(xPosition, 0.32, 0.3)
      house.add(windowPane)
    })

    group.add(house)
  } else {
    const coinMaterial = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.45,
      metalness: 0.7,
      roughness: 0.22,
    })

    for (let index = 0; index < 6; index += 1) {
      const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.075, 48), coinMaterial)
      coin.position.set(-0.58, 0.08 + index * 0.08, -0.12)
      coin.rotation.y = index * 0.18
      group.add(coin)
    }

    const moneySymbol = new THREE.Group()
    moneySymbol.name = "moneySymbol"
    moneySymbol.position.set(-0.58, 0.83, -0.12)

    const symbolMaterial = new THREE.MeshBasicMaterial({ color: 0xfef3c7, opacity: 0.9, transparent: true })
    const upperLoop = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.015, 8, 36), symbolMaterial)
    upperLoop.position.y = 0.1
    const lowerLoop = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.015, 8, 36), symbolMaterial)
    lowerLoop.position.y = -0.1
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.46, 0.035), symbolMaterial)
    moneySymbol.add(upperLoop, lowerLoop, bar)
    group.add(moneySymbol)
  }

  return { group, ring, cap }
}

export function DealCommandMapCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

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
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8))

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 90)
    camera.position.set(0.2, 4.8, 8.6)
    camera.lookAt(0, 0.8, 0)

    const rig = new THREE.Group()
    rig.rotation.x = -0.34
    scene.add(rig)

    const ambient = new THREE.AmbientLight(0x9bdcff, 1.0)
    scene.add(ambient)
    const keyLight = new THREE.PointLight(0x22d3ee, 10, 18)
    keyLight.position.set(-3, 5, 4)
    scene.add(keyLight)
    const goldLight = new THREE.PointLight(0xfacc15, 6, 15)
    goldLight.position.set(4, 3, 3)
    scene.add(goldLight)
    const fillLight = new THREE.PointLight(0x818cf8, 3.5, 14)
    fillLight.position.set(0, 6, -4)
    scene.add(fillLight)

    const floor = new THREE.GridHelper(12, 24, 0x22d3ee, 0x334155)
    const floorMaterial = floor.material as THREE.Material
    floorMaterial.transparent = true
    floorMaterial.opacity = 0.44
    rig.add(floor)

    const floorPlate = new THREE.Mesh(
      new THREE.CircleGeometry(5.7, 96),
      new THREE.MeshBasicMaterial({
        color: 0x0f172a,
        opacity: 0.48,
        side: THREE.DoubleSide,
        transparent: true,
      }),
    )
    floorPlate.rotation.x = -Math.PI / 2
    floorPlate.position.y = -0.04
    rig.add(floorPlate)

    const aiNodeMaterial = new THREE.MeshBasicMaterial({
      color: 0x67e8f9,
      opacity: 0.62,
      transparent: true,
    })
    const aiLineMaterial = new THREE.LineBasicMaterial({
      color: 0x67e8f9,
      opacity: 0.22,
      transparent: true,
    })
    const aiPoints = [
      new THREE.Vector3(-4.4, 0.18, -3.15),
      new THREE.Vector3(-3.35, 0.16, -2.55),
      new THREE.Vector3(-2.65, 0.2, -3.65),
      new THREE.Vector3(0.65, 0.18, -3.85),
      new THREE.Vector3(1.55, 0.2, -3.1),
      new THREE.Vector3(3.95, 0.18, -3.55),
      new THREE.Vector3(4.65, 0.22, -2.45),
    ]
    aiPoints.forEach((point) => {
      const aiNode = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 16), aiNodeMaterial)
      aiNode.position.copy(point)
      rig.add(aiNode)
    })
    for (let index = 0; index < aiPoints.length - 1; index += 1) {
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([aiPoints[index], aiPoints[index + 1]]), aiLineMaterial)
      rig.add(line)
    }

    const vaultNode = nodeMap.get("vault")
    if (vaultNode) {
      const vaultCore = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.72, 0),
        new THREE.MeshPhysicalMaterial({
          color: 0x67e8f9,
          emissive: 0x0891b2,
          emissiveIntensity: 0.55,
          metalness: 0.28,
          opacity: 0.72,
          roughness: 0.12,
          transparent: true,
          transmission: 0.08,
        }),
      )
      vaultCore.name = "vaultCore"
      vaultCore.position.copy(vaultNode.position)
      vaultCore.position.y += 1.9
      rig.add(vaultCore)

      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(vaultCore.geometry),
        new THREE.LineBasicMaterial({ color: 0xfacc15, opacity: 0.8, transparent: true }),
      )
      edges.name = "vaultEdges"
      edges.position.copy(vaultCore.position)
      rig.add(edges)
    }

    const towerObjects = nodes.map((node) => {
      const tower = makeTower(node)
      rig.add(tower.group)
      return tower
    })

    const routeMaterial = new THREE.MeshBasicMaterial({
      color: 0x67e8f9,
      opacity: 0.48,
      transparent: true,
    })
    const particles: Array<{ mesh: THREE.Mesh; curve: THREE.CatmullRomCurve3; offset: number; speed: number }> = []

    routePairs.forEach(([from, to], index) => {
      const startNode = nodeMap.get(from)
      const endNode = nodeMap.get(to)

      if (!startNode || !endNode) {
        return
      }

      const start = startNode.position.clone()
      start.y += startNode.height + 0.62
      const end = endNode.position.clone()
      end.y += endNode.height + 0.62
      const curve = makeCurve(start, end)

      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 80, 0.028, 10, false), routeMaterial)
      rig.add(tube)

      const particle = new THREE.Mesh(
        new THREE.SphereGeometry(0.1, 24, 24),
        new THREE.MeshBasicMaterial({ color: index === 3 ? 0xfacc15 : 0xe0f2fe, opacity: 0.95, transparent: true }),
      )
      particle.position.copy(curve.getPointAt(0))
      rig.add(particle)
      particles.push({ curve, mesh: particle, offset: index * 0.21, speed: 0.085 + index * 0.012 })
    })

    const parcelMaterial = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      opacity: 0.16,
      transparent: true,
    })
    for (let index = 0; index < 20; index += 1) {
      const parcel = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.05, 0.52), parcelMaterial)
      parcel.position.set(-4.8 + (index % 5) * 1.25, 0.02, -3.8 + Math.floor(index / 5) * 1.15)
      parcel.rotation.y = ((index % 3) - 1) * 0.12
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
      camera.aspect = width / Math.max(height, 1)
      camera.updateProjectionMatrix()
    }

    const handlePointerMove = (event: PointerEvent) => {
      const rect = container.getBoundingClientRect()
      pointerX = ((event.clientX - rect.left) / rect.width - 0.5) * 2
      pointerY = ((event.clientY - rect.top) / rect.height - 0.5) * 2
    }

    const animate = () => {
      frame += 0.016
      rig.rotation.y = Math.sin(frame * 0.38) * 0.18 + pointerX * 0.08
      rig.rotation.x = -0.34 + pointerY * -0.03

      const vaultCore = rig.getObjectByName("vaultCore")
      const vaultEdges = rig.getObjectByName("vaultEdges")
      if (vaultCore) {
        vaultCore.rotation.y += 0.009
        vaultCore.rotation.x += 0.004
      }
      if (vaultEdges) {
        vaultEdges.rotation.copy(vaultCore?.rotation || new THREE.Euler())
      }

      const moneySymbol = rig.getObjectByName("moneySymbol")
      if (moneySymbol) {
        moneySymbol.rotation.y += 0.018
        moneySymbol.position.y = 1.43 + Math.sin(frame * 1.7) * 0.06
      }

      towerObjects.forEach((tower, index) => {
        const pulse = 1 + Math.sin(frame * 2.1 + index * 0.7) * 0.1
        tower.ring.scale.setScalar(pulse)
        tower.cap.scale.setScalar(0.94 + pulse * 0.06)
      })

      particles.forEach((particle) => {
        const progress = (frame * particle.speed + particle.offset) % 1
        particle.mesh.position.copy(particle.curve.getPointAt(progress))
        particle.mesh.scale.setScalar(0.8 + Math.sin(progress * Math.PI) * 0.7)
      })

      renderer.render(scene, camera)
      animationId = window.requestAnimationFrame(animate)
    }

    const observer = new ResizeObserver(resize)
    observer.observe(container)
    if (!prefersReducedMotion) {
      container.addEventListener("pointermove", handlePointerMove)
    }
    resize()
    if (prefersReducedMotion) {
      renderer.render(scene, camera)
    } else {
      animate()
    }

    return () => {
      window.cancelAnimationFrame(animationId)
      observer.disconnect()
      if (!prefersReducedMotion) {
        container.removeEventListener("pointermove", handlePointerMove)
      }
      scene.traverse((object) => {
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
      })
      renderer.dispose()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      data-hero-command-map="true"
      className="absolute inset-0 h-full w-full"
    />
  )
}

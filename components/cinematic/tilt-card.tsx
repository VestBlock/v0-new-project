"use client"

import { useCallback, useRef } from "react"
import { useReducedMotion } from "framer-motion"
import { cn } from "@/lib/utils"

/**
 * Pointer-tracked 3D tilt wrapper with a moving glare highlight.
 * Pure CSS transforms — no dependencies. Disabled for reduced motion
 * and on touch-only devices (no hover).
 */
export function TiltCard({
  children,
  className,
  maxTilt = 7,
}: {
  children: React.ReactNode
  className?: string
  maxTilt?: number
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const frame = useRef(0)
  const reduce = useReducedMotion()

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (reduce || event.pointerType === "touch") return
      const node = ref.current
      if (!node || frame.current) return
      const { clientX, clientY } = event
      frame.current = window.requestAnimationFrame(() => {
        frame.current = 0
        const rect = node.getBoundingClientRect()
        const x = (clientX - rect.left) / rect.width
        const y = (clientY - rect.top) / rect.height
        node.style.setProperty("--tilt-x", `${((y - 0.5) * -2 * maxTilt).toFixed(2)}deg`)
        node.style.setProperty("--tilt-y", `${((x - 0.5) * 2 * maxTilt).toFixed(2)}deg`)
        node.style.setProperty("--glare-x", `${(x * 100).toFixed(1)}%`)
        node.style.setProperty("--glare-y", `${(y * 100).toFixed(1)}%`)
        node.style.setProperty("--glare-o", "1")
      })
    },
    [maxTilt, reduce]
  )

  const handlePointerLeave = useCallback(() => {
    const node = ref.current
    if (!node) return
    if (frame.current) {
      window.cancelAnimationFrame(frame.current)
      frame.current = 0
    }
    node.style.setProperty("--tilt-x", "0deg")
    node.style.setProperty("--tilt-y", "0deg")
    node.style.setProperty("--glare-o", "0")
  }, [])

  return (
    <div style={{ perspective: "900px" }} className="h-full">
      <div
        ref={ref}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        className={cn("relative h-full will-change-transform", className)}
        style={{
          transform: "rotateX(var(--tilt-x, 0deg)) rotateY(var(--tilt-y, 0deg))",
          transformStyle: "preserve-3d",
          transition: "transform 0.35s cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        {children}
        {/* Moving glare highlight */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[inherit]"
          style={{
            background:
              "radial-gradient(280px circle at var(--glare-x, 50%) var(--glare-y, 50%), rgba(165, 230, 255, 0.10), transparent 65%)",
            opacity: "var(--glare-o, 0)",
            transition: "opacity 0.4s ease",
          }}
        />
      </div>
    </div>
  )
}

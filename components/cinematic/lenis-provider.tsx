"use client"

import { useEffect } from "react"
import Lenis from "lenis"

/**
 * Global smooth-scroll layer (Lenis). Mount once near the top of a page.
 * Renders nothing — it drives native scroll with eased momentum so the
 * cinematic scroll experience feels premium. Fully disabled when the user
 * prefers reduced motion.
 */
export function LenisProvider() {
  useEffect(() => {
    if (typeof window === "undefined") return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    const lenis = new Lenis({
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      touchMultiplier: 1.4,
    })

    let frame = 0
    const raf = (time: number) => {
      lenis.raf(time)
      frame = window.requestAnimationFrame(raf)
    }
    frame = window.requestAnimationFrame(raf)

    return () => {
      window.cancelAnimationFrame(frame)
      lenis.destroy()
    }
  }, [])

  return null
}

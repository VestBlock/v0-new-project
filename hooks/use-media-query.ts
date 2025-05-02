"use client"

import { useState, useEffect } from "react"

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    // Set initial value
    const media = window.matchMedia(query)
    setMatches(media.matches)

    // Create an event listener
    const listener = () => setMatches(media.matches)

    // Listen for changes
    media.addEventListener("change", listener)

    // Clean up
    return () => media.removeEventListener("change", listener)
  }, [query])

  return matches
}

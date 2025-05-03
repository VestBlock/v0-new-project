"use client"

import { useEffect, useState } from "react"
import { AlertCircle } from "lucide-react"

export function CompatibilityWarning() {
  const [showWarning, setShowWarning] = useState(false)
  const [details, setDetails] = useState<string[]>([])

  useEffect(() => {
    // Check for known compatibility issues
    const issues: string[] = []

    try {
      // Check for browser compatibility issues
      if (typeof window !== "undefined") {
        // Check for browser compatibility
        const userAgent = window.navigator.userAgent
        if (userAgent.includes("MSIE") || userAgent.includes("Trident/")) {
          issues.push("Internet Explorer is not supported")
        }

        // Check for mobile devices with small screens
        if (window.innerWidth < 375) {
          issues.push("Screen size may be too small for optimal experience")
        }

        // Check for localStorage support
        try {
          localStorage.setItem("test", "test")
          localStorage.removeItem("test")
        } catch (e) {
          issues.push("Local storage is not available (required for session management)")
        }

        // Check for cookies enabled
        if (!navigator.cookieEnabled) {
          issues.push("Cookies are disabled (required for authentication)")
        }
      }
    } catch (error) {
      console.error("Error checking compatibility:", error)
      issues.push("Error checking compatibility")
    }

    if (issues.length > 0) {
      setDetails(issues)
      setShowWarning(true)
    }
  }, [])

  if (!showWarning) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-md rounded-lg bg-amber-50 p-4 shadow-lg">
      <div className="flex">
        <div className="flex-shrink-0">
          <AlertCircle className="h-5 w-5 text-amber-400" />
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium text-amber-800">Compatibility Warning</h3>
          <div className="mt-2 text-sm text-amber-700">
            <ul className="list-inside list-disc space-y-1">
              {details.map((detail, index) => (
                <li key={index}>{detail}</li>
              ))}
            </ul>
          </div>
          <div className="mt-4">
            <button
              type="button"
              className="rounded-md bg-amber-50 text-sm font-medium text-amber-800 hover:text-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
              onClick={() => setShowWarning(false)}
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

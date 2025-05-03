"use client"

import { useEffect, useState } from "react"
import { AlertCircle } from "lucide-react"
import React from "react"

export function ReactCompatibilityChecker() {
  const [hasIssues, setHasIssues] = useState(false)
  const [issues, setIssues] = useState<string[]>([])

  useEffect(() => {
    const detectedIssues: string[] = []

    // Safe way to check React version in browser
    const reactVersion = React.version

    if (reactVersion) {
      // Check for known problematic versions
      if (reactVersion.startsWith("17.")) {
        detectedIssues.push(`React version ${reactVersion} may have issues with some components`)
      }

      // Log the version for debugging
      console.log(`[COMPATIBILITY] React version: ${reactVersion}`)
    }

    if (detectedIssues.length > 0) {
      setIssues(detectedIssues)
      setHasIssues(true)
    }
  }, [])

  if (!hasIssues) return null

  return (
    <div className="mb-4 rounded-md bg-blue-50 p-4">
      <div className="flex">
        <div className="flex-shrink-0">
          <AlertCircle className="h-5 w-5 text-blue-400" />
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium text-blue-800">React Compatibility Info</h3>
          <div className="mt-2 text-sm text-blue-700">
            <ul className="list-inside list-disc space-y-1">
              {issues.map((issue, index) => (
                <li key={index}>{issue}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

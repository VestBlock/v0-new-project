"use client"

import React from "react"

export function ReactVersionChecker() {
  return <div className="fixed bottom-0 right-0 bg-yellow-100 p-2 text-xs z-50">React version: {React.version}</div>
}

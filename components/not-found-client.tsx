"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"

// This component uses useSearchParams and must be wrapped in Suspense
function NotFoundClientContent() {
  const searchParams = useSearchParams()
  const from = searchParams.get("from")

  return <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">{from && <p>Redirected from: {from}</p>}</div>
}

// This is the wrapper component that provides the Suspense boundary
export function NotFoundClientWrapper() {
  return (
    <Suspense fallback={<div className="mt-4 text-sm text-gray-500">Loading...</div>}>
      <NotFoundClientContent />
    </Suspense>
  )
}

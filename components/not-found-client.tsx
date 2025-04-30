"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"

function NotFoundClient() {
  const searchParams = useSearchParams()
  const from = searchParams.get("from")

  return <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">{from && <p>Redirected from: {from}</p>}</div>
}

export function NotFoundClientWrapper() {
  return (
    <Suspense fallback={<div className="mt-4 text-sm text-gray-500">Loading...</div>}>
      <NotFoundClient />
    </Suspense>
  )
}

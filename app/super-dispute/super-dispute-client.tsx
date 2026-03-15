"use client"

import dynamic from "next/dynamic"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const SuperDisputeForm = dynamic(() => import("@/components/super-dispute-form"), {
  ssr: false,
  loading: () => (
    <Card>
      <CardHeader>
        <CardTitle>
          <Skeleton className="h-6 w-48" />
        </CardTitle>
        <CardDescription>
          <Skeleton className="h-4 w-96" />
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-10 w-32" />
      </CardContent>
    </Card>
  ),
})

export default function SuperDisputeClient() {
  return <SuperDisputeForm />
}

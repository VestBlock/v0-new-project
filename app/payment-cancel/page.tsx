"use client"

import { Suspense } from "react"
import { useRouter } from "next/navigation"
import { XCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

function PaymentCancelContent() {
  const router = useRouter()

  return (
    <div className="container flex h-[calc(100vh-4rem)] items-center justify-center">
      <Card className="mx-auto w-full max-w-md card-glow">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Payment Cancelled</CardTitle>
          <CardDescription>Your payment process was cancelled</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center p-6">
          <XCircle className="h-16 w-16 text-red-500" />
          <p className="mt-4 text-center text-muted-foreground">
            You've cancelled the payment process. No charges have been made to your account.
          </p>
        </CardContent>
        <CardFooter className="flex justify-center gap-4">
          <Button variant="outline" onClick={() => router.push("/dashboard")}>
            Return to Dashboard
          </Button>
          <Button
            onClick={() => router.push("/pricing")}
            className="bg-gradient-to-r from-cyan-500 via-purple-500 to-blue-500"
          >
            Try Again
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

export default function PaymentCancelPage() {
  return (
    <Suspense
      fallback={
        <div className="container flex h-[calc(100vh-4rem)] items-center justify-center">
          <div className="flex flex-col items-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="mt-4 text-lg">Loading...</p>
          </div>
        </div>
      }
    >
      <PaymentCancelContent />
    </Suspense>
  )
}

"use client"

import { useRouter } from "next/navigation"
import { AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

export default function PaymentCancelPage() {
  const router = useRouter()

  return (
    <div className="container py-10">
      <div className="mx-auto max-w-md">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Payment Cancelled</CardTitle>
            <CardDescription>Your payment process was cancelled</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center py-10">
            <div className="flex flex-col items-center space-y-4">
              <div className="rounded-full bg-amber-100 p-3">
                <AlertCircle className="h-10 w-10 text-amber-600" />
              </div>
              <p className="text-center text-muted-foreground">
                You've cancelled the payment process. No charges have been made to your account.
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-2">
            <Button onClick={() => router.push("/pricing")} className="w-full">
              Return to Pricing
            </Button>
            <Button onClick={() => router.push("/dashboard")} variant="outline" className="w-full">
              Go to Dashboard
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}

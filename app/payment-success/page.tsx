"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Check, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"
import { useAuth } from "@/lib/auth-provider"

export default function PaymentSuccessPage() {
  const [isProcessing, setIsProcessing] = useState(true)
  const [isComplete, setIsComplete] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const { refreshUser } = useAuth()

  const orderId = searchParams.get("token")

  useEffect(() => {
    async function capturePayment() {
      if (!orderId) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Payment information is missing. Please try again.",
        })
        router.push("/pricing")
        return
      }

      try {
        // Capture the payment
        const response = await fetch(`/api/capture-paypal-payment?orderId=${orderId}`, {
          method: "POST",
        })

        if (!response.ok) {
          throw new Error("Failed to capture payment")
        }

        // Refresh user data to get updated Pro status
        await refreshUser()

        setIsComplete(true)
        toast({
          title: "Payment Successful",
          description: "Welcome to VestBlock Pro! You now have access to all features.",
        })
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Payment Error",
          description: "There was an issue processing your payment. Please contact support.",
        })
      } finally {
        setIsProcessing(false)
      }
    }

    capturePayment()
  }, [orderId, toast, router, refreshUser])

  return (
    <div className="container py-10">
      <div className="mx-auto max-w-md">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Payment {isComplete ? "Successful" : "Processing"}</CardTitle>
            <CardDescription>
              {isProcessing ? "Please wait while we process your payment..." : "Thank you for your purchase!"}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center py-10">
            {isProcessing ? (
              <Loader2 className="h-16 w-16 animate-spin text-primary" />
            ) : (
              <div className="flex flex-col items-center space-y-4">
                <div className="rounded-full bg-green-100 p-3">
                  <Check className="h-10 w-10 text-green-600" />
                </div>
                <p className="text-center text-muted-foreground">
                  Your payment has been processed successfully. You now have access to all Pro features.
                </p>
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button onClick={() => router.push("/dashboard")} className="w-full" disabled={isProcessing}>
              Go to Dashboard
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}

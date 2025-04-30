"use client"

import { useEffect, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { CheckCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"
import { useAuth } from "@/lib/auth-provider"

function PaymentSuccessContent() {
  const [isProcessing, setIsProcessing] = useState(true)
  const [isSuccess, setIsSuccess] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const { refreshUser } = useAuth()

  const orderId = searchParams.get("token")

  useEffect(() => {
    const capturePayment = async () => {
      if (!orderId) {
        setIsProcessing(false)
        return
      }

      try {
        const response = await fetch("/api/capture-paypal-payment", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ orderId }),
        })

        if (!response.ok) {
          throw new Error("Failed to capture payment")
        }

        const data = await response.json()

        if (data.success) {
          setIsSuccess(true)
          toast({
            title: "Payment successful",
            description: "Your account has been upgraded to Pro!",
          })

          // Refresh user data to update isPro status
          await refreshUser()
        } else {
          throw new Error(data.message || "Payment capture failed")
        }
      } catch (error) {
        console.error("Payment capture error:", error)
        toast({
          variant: "destructive",
          title: "Payment Error",
          description: "There was an error processing your payment. Please contact support.",
        })
      } finally {
        setIsProcessing(false)
      }
    }

    capturePayment()
  }, [orderId, toast, refreshUser])

  return (
    <div className="container flex h-[calc(100vh-4rem)] items-center justify-center">
      <Card className="mx-auto w-full max-w-md card-glow">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">
            Payment {isProcessing ? "Processing" : isSuccess ? "Successful" : "Failed"}
          </CardTitle>
          <CardDescription>
            {isProcessing
              ? "We're processing your payment..."
              : isSuccess
                ? "Your account has been upgraded to Pro!"
                : "There was an issue with your payment."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center p-6">
          {isProcessing ? (
            <Loader2 className="h-16 w-16 animate-spin text-primary" />
          ) : isSuccess ? (
            <CheckCircle className="h-16 w-16 text-green-500" />
          ) : (
            <div className="text-center text-red-500">
              <p>Payment could not be processed.</p>
              <p className="text-sm text-muted-foreground mt-2">Please try again or contact support.</p>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button
            onClick={() => router.push(isSuccess ? "/dashboard" : "/pricing")}
            disabled={isProcessing}
            className={isSuccess ? "bg-gradient-to-r from-cyan-500 via-purple-500 to-blue-500" : ""}
          >
            {isSuccess ? "Go to Dashboard" : "Try Again"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

export default function PaymentSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="container flex h-[calc(100vh-4rem)] items-center justify-center">
          <div className="flex flex-col items-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="mt-4 text-lg">Processing payment...</p>
          </div>
        </div>
      }
    >
      <PaymentSuccessContent />
    </Suspense>
  )
}

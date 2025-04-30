"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Check, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"
import { useAuth } from "@/lib/auth-provider"

export default function PricingPage() {
  const [isLoading, setIsLoading] = useState(false)
  const { user } = useAuth()
  const router = useRouter()
  const { toast } = useToast()

  const handleUpgrade = async () => {
    if (!user) {
      router.push("/login?redirect=/pricing")
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch("/api/create-paypal-checkout", {
        method: "POST",
      })

      if (!response.ok) {
        throw new Error("Failed to create checkout session")
      }

      const data = await response.json()

      // Redirect to PayPal checkout
      window.location.href = data.url
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to initiate checkout. Please try again.",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="container py-10">
      <div className="mx-auto max-w-md text-center">
        <h1 className="text-3xl font-bold mb-2">Upgrade to Pro</h1>
        <p className="text-muted-foreground mb-8">
          Get full access to all features and unlock your financial potential
        </p>
      </div>

      <div className="mx-auto max-w-md">
        <Card className="card-glow overflow-hidden border-0">
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-purple-500/10 to-blue-500/10" />
          <CardHeader className="relative">
            <CardTitle className="text-2xl">Pro Plan</CardTitle>
            <CardDescription>One-time payment for full access</CardDescription>
            <div className="absolute top-6 right-6">
              <div className="bg-gradient-to-r from-cyan-500 via-purple-500 to-blue-500 rounded-full px-3 py-1 text-xs font-medium text-white">
                Best Value
              </div>
            </div>
          </CardHeader>
          <CardContent className="relative space-y-6">
            <div className="flex items-baseline">
              <span className="text-4xl font-bold">$75</span>
              <span className="ml-1 text-muted-foreground">one-time</span>
            </div>

            <ul className="space-y-2">
              <li className="flex items-start">
                <Check className="mr-2 h-5 w-5 text-green-500 shrink-0" />
                <span className="text-sm">Full credit analysis with personalized recommendations</span>
              </li>
              <li className="flex items-start">
                <Check className="mr-2 h-5 w-5 text-green-500 shrink-0" />
                <span className="text-sm">Custom dispute letters for all negative items</span>
              </li>
              <li className="flex items-start">
                <Check className="mr-2 h-5 w-5 text-green-500 shrink-0" />
                <span className="text-sm">Credit hack strategies to boost your score</span>
              </li>
              <li className="flex items-start">
                <Check className="mr-2 h-5 w-5 text-green-500 shrink-0" />
                <span className="text-sm">Side hustle recommendations based on your profile</span>
              </li>
              <li className="flex items-start">
                <Check className="mr-2 h-5 w-5 text-green-500 shrink-0" />
                <span className="text-sm">AI chat assistant to answer your credit questions</span>
              </li>
              <li className="flex items-start">
                <Check className="mr-2 h-5 w-5 text-green-500 shrink-0" />
                <span className="text-sm">Export PDF reports and dispute letters</span>
              </li>
              <li className="flex items-start">
                <Check className="mr-2 h-5 w-5 text-green-500 shrink-0" />
                <span className="text-sm">Unlimited credit report uploads and analyses</span>
              </li>
            </ul>
          </CardContent>
          <CardFooter className="relative">
            <Button
              onClick={handleUpgrade}
              disabled={isLoading || (user && user.isPro)}
              className="w-full bg-gradient-to-r from-cyan-500 via-purple-500 to-blue-500"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : user && user.isPro ? (
                "Already Upgraded"
              ) : (
                "Pay with PayPal"
              )}
            </Button>
          </CardFooter>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-4">
          Secure payment processing by PayPal. 30-day money-back guarantee.
        </p>
      </div>
    </div>
  )
}

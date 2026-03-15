"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { getSupabaseClient } from "@/lib/supabase/client"
import { Navigation } from "@/components/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Users } from "lucide-react"
import Link from "next/link"

export default function AffiliateRegisterPage()

{
  const { user, isLoading: authLoading, isAuthenticated } = useAuth()
  const supabase = getSupabaseClient()
  const router = useRouter()
  const { toast } = useToast()

  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState(user?.email || "")
  const [websiteUrl, setWebsiteUrl] = useState("")
  const [paypalEmail, setPaypalEmail] = useState("")
  const [promotionMethods, setPromotionMethods] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (user && user.email && !email) {
      setEmail(user.email)
    }
    if (user && user.user_metadata?.full_name && !fullName) {
      setFullName(user.user_metadata.full_name)
    }
  }, [user, email, fullName])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isAuthenticated || !user) {
      toast({
        title: "Authentication Required",
        description: "Please log in or create an account to apply for the affiliate program.",
        variant: "destructive",
        action: (
          <Link href={`/login?redirect=/affiliates/register`} passHref>
            <Button variant="outline" size="sm">
              Login
            </Button>
          </Link>
        ),
      })
      return
    }
    if (!fullName || !email) {
      toast({ title: "Missing Information", description: "Full name and email are required.", variant: "destructive" })
      return
    }
    setIsSubmitting(true)

    try {
      const { data: existingAffiliate, error: fetchError } = await supabase
        .from("affiliates")
        .select("id, status")
        .eq("user_id", user.id)
        .maybeSingle()

      if (fetchError && fetchError.code !== "PGRST116") {
        throw fetchError
      }
      if (existingAffiliate) {
        toast({
          title: "Application Exists",
          description: `You already have an affiliate application with status: ${existingAffiliate.status}. Please check your email or contact support.`,
          variant: "default",
        })
        setIsSubmitting(false)
        if (existingAffiliate.status === "approved") router.push("/affiliates/dashboard")
        return
      }
      const tempAffiliateCode = `${fullName.replace(/\s+/g, "").toUpperCase().substring(0, 5)}${Math.random().toString(36).substring(2, 6).toUpperCase()}`

      const { data, error } = await supabase
        .from("affiliates")
        .insert({
          user_id: user.id,
          full_name: fullName,
          email: email,
          website_url: websiteUrl || null,
          paypal_email: paypalEmail || null,
          notes: `Promotion methods: ${promotionMethods}`,
          affiliate_code: tempAffiliateCode,
        })
        .select()
        .single()

      if (error) throw error

      toast({
        title: "Application Submitted!",
        description: "Thank you for applying. We will review your application and get back to you soon.",
      })
      router.push("/affiliates/application-pending")
    } catch (err: any) {
      console.error("Affiliate application error:", err)
      toast({
        title: "Application Error",
        description: err.message || "Could not submit your application. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navigation />
        <main className="flex-grow flex items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-cyan-500" />
        </main>
      </div>
    )
  }
  return (
    <div className="min-h-screen bg-background circuit-bg">
      <Navigation />
      <main className="pt-24 md:pt-32 px-4 pb-16">
        <div className="container mx-auto max-w-2xl">
          <Card className="bg-card/80 backdrop-blur-sm">
            <CardHeader className="text-center">
              <Users className="h-12 w-12 mx-auto text-cyan-500 mb-3" />
              <CardTitle className="text-3xl font-bold gradient-text">Become a VestBlock Affiliate</CardTitle>
              <CardDescription className="text-muted-foreground text-base">
                Partner with us and earn commissions by promoting VestBlock.io.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!isAuthenticated ? (
                <div className="text-center py-8">
                  <p className="mb-4 text-lg">Please log in or create an account to apply.</p>
                  <Button asChild className="bg-cyan-500 hover:bg-cyan-600">
                    <Link href={`/login?redirect=/affiliates/register`}>Login / Sign Up</Link>
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <Label htmlFor="fullName">Full Name</Label>
                    <Input
                      id="fullName"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="John Doe"
                      required
                      disabled={isSubmitting}
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email Address (for communication)</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      disabled={isSubmitting || Boolean(user?.email)}
                    />
                    {user?.email && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Using your account email. This cannot be changed here.
                      </p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="websiteUrl">Your Website/Blog URL (Optional)</Label>
                    <Input
                      id="websiteUrl"
                      type="url"
                      value={websiteUrl}
                      onChange={(e) => setWebsiteUrl(e.target.value)}
                      placeholder="https://yourwebsite.com"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div>
                    <Label htmlFor="paypalEmail">PayPal Email (for payouts)</Label>
                    <Input
                      id="paypalEmail"
                      type="email"
                      value={paypalEmail}
                      onChange={(e) => setPaypalEmail(e.target.value)}
                      placeholder="paypal@example.com"
                      disabled={isSubmitting}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Ensure this is correct to receive payments. More payout options may be added later.
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="promotionMethods">How do you plan to promote VestBlock?</Label>
                    <Textarea
                      id="promotionMethods"
                      value={promotionMethods}
                      onChange={(e) => setPromotionMethods(e.target.value)}
                      placeholder="e.g., Blog posts, social media, email list, YouTube videos..."
                      rows={4}
                      disabled={isSubmitting}
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-cyan-500 hover:bg-cyan-600"
                    disabled={isSubmitting || authLoading}
                  >
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Submit Application"}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
          <p className="text-center mt-6 text-sm text-muted-foreground">
            Already an affiliate?{" "}
            <Link href="/affiliates/dashboard" className="text-cyan-400 hover:underline">
              Go to Dashboard
            </Link>
          </p>
        </div>
      </main>
    </div>
  )
}

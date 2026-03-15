"use client"

import { useState, useCallback, useEffect } from "react"
import { Navigation } from "@/components/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { useAuth } from "@/contexts/auth-context"
import { getSupabaseClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { FinancialGoalsSelector, FinancialGoal } from "@/components/financial-goals-selector"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

interface UserProfile {
  id: string
  full_name: string | null
  email: string | null
  credit_score: number | null
  financial_goal: FinancialGoal | null
  address_street: string | null
  address_city: string | null
  address_state: string | null
  address_zip: string | null
  phone_number: string | null
  created_at: string
  updated_at: string
}

interface ProfileStateForRoadmapCheck {
  credit_score: number | null
  financial_goal: FinancialGoal | null
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const { user, isLoading: authLoading, isAuthenticated } = useAuth()
  const { toast } = useToast()
  const supabase = getSupabaseClient()
  const router = useRouter()
  const [initialProfileSnapshot, setInitialProfileSnapshot] = useState<ProfileStateForRoadmapCheck | null>(null)

  const fetchProfile = useCallback(
    async (currentUserId: string, currentUserEmail?: string, currentUserFullName?: string) => {
      setIsLoading(true)
      try {
        const { data, error } = await supabase.from("user_profiles").select("*").eq("id", currentUserId).single()

        if (error && error.code !== "PGRST116") {
          throw error
        }

        if (data) {
          setProfile(data as UserProfile)
          setInitialProfileSnapshot({
            credit_score: data.credit_score,
            financial_goal: data.financial_goal,
          })
        } else {
          const newProfileData = {
            id: currentUserId,
            email: currentUserEmail || null,
            full_name: currentUserFullName || currentUserEmail?.split("@")[0] || "New User",
          }

          const { data: insertedProfile, error: insertError } = await supabase
            .from("user_profiles")
            .insert(newProfileData)
            .select()
            .single()

          if (insertError) throw insertError

          setProfile(insertedProfile as UserProfile)
          setInitialProfileSnapshot({
            credit_score: insertedProfile.credit_score,
            financial_goal: insertedProfile.financial_goal,
          })
          toast({
            title: "Profile Created",
            description: "Your profile has been initialized."
          })
        }
      } catch (err: any) {
        console.error("Profile fetch/create error:", err)
        toast({
          title: "Profile Operation Error",
          description: err.message || "Failed to load or create profile.",
          variant: "destructive",
        })
        setProfile(null)
        setInitialProfileSnapshot(null)
      } finally {
        setIsLoading(false)
      }
    },
    [supabase, toast]
  )

  useEffect(() => {
    if (authLoading) return
    if (!isAuthenticated) {
      router.push("/login?redirect=/profile")
      return
    }
    if (user?.id) {
      fetchProfile(user.id, user.email, user.user_metadata?.full_name)
    } else if (!authLoading) {
      setIsLoading(false)
    }
  }, [user, authLoading, isAuthenticated, router, fetchProfile])

  const handleChange = (field: keyof UserProfile, value: any) => {
    setProfile((prev) => (prev ? { ...prev, [field]: value } : null))
  }

  const handleSave = async () => {
    if (!user || !profile) {
      toast({ title: "Error", description: "No user or profile data to save.", variant: "destructive" })
      return
    }

    setIsSaving(true)
    try {
      let financialGoalForDb: Partial<FinancialGoal> | null = null
      if (profile.financial_goal) {
        financialGoalForDb = {
          id: profile.financial_goal.id,
          title: profile.financial_goal.title,
          description: profile.financial_goal.description,
          customDetails: profile.financial_goal.customDetails,
        }
      }

      const updateData = {
        full_name: profile.full_name,
        credit_score: profile.credit_score,
        financial_goal: financialGoalForDb,
        address_street: profile.address_street,
        address_city: profile.address_city,
        address_state: profile.address_state,
        address_zip: profile.address_zip,
        phone_number: profile.phone_number,
        updated_at: new Date().toISOString(),
      }

      const { error } = await supabase.from("user_profiles").update(updateData).eq("id", user.id)

      if (error) throw error

      const wasIncompleteBefore = !(initialProfileSnapshot?.credit_score && initialProfileSnapshot?.financial_goal)
      const isCompleteNow = profile.credit_score && profile.financial_goal

      setInitialProfileSnapshot({
        credit_score: profile.credit_score,
        financial_goal: profile.financial_goal,
      })

      if (isCompleteNow && wasIncompleteBefore) {
        toast({
          title: "Profile Complete!",
          description: "Redirecting you to your financial roadmap...",
          duration: 3500,
        })
        setTimeout(() => {
          router.push("/roadmap")
        }, 3000)
      } else {
        toast({
          title: "Profile Updated",
          description: "Your profile has been successfully updated.",
        })
      }
    } catch (err: any) {
      console.error("Profile update error:", err)
      toast({ title: "Update Error", description: err.message || "Failed to update profile.", variant: "destructive" })
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading || authLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <main className="flex-grow flex items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-cyan-500" />
        </main>
      </div>
    )
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen bg-background">
        <main className="pt-32 px-4 text-center">
          <p>Please log in to view your profile.</p>
          <Button onClick={() => router.push("/login?redirect=/profile")} className="mt-4">
            Go to Login
          </Button>
        </main>
      </div>
    )
  }

  if (!profile && !isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <main className="pt-32 px-4 text-center">
          <p className="text-red-500">
            Could not load or create your profile. Please try refreshing or contact support.
          </p>
          <Button onClick={() => fetchProfile(user.id, user.email, user.user_metadata?.full_name)} className="mt-4">
            Retry Loading Profile
          </Button>
        </main>
      </div>
    )
  }

  if (!profile) return null

  return (
    <div className="min-h-screen bg-background">
      <main className="pt-24 md:pt-32 px-4 pb-16">
        <div className="container mx-auto max-w-3xl">
          <h1 className="text-3xl font-bold mb-8 gradient-text">Your Profile & Settings</h1>
          <Card className="p-6 md:p-8 bg-card/80 backdrop-blur">
            <div className="space-y-6">
              <h2 className="text-xl font-semibold border-b pb-3 mb-4">Personal Information</h2>
              <div>
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  value={profile.full_name || ""}
                  onChange={(e) => handleChange("full_name", e.target.value)}
                  disabled={isSaving}
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={profile.email || ""} disabled className="bg-muted cursor-not-allowed" />
              </div>
              <div>
                <Label htmlFor="addressStreet">Street Address</Label>
                <Input
                  id="addressStreet"
                  value={profile.address_street || ""}
                  onChange={(e) => handleChange("address_street", e.target.value)}
                  placeholder="123 Main St"
                  disabled={isSaving}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="addressCity">City</Label>
                  <Input
                    id="addressCity"
                    value={profile.address_city || ""}
                    onChange={(e) => handleChange("address_city", e.target.value)}
                    placeholder="Anytown"
                    disabled={isSaving}
                  />
                </div>
                <div>
                  <Label htmlFor="addressState">State</Label>
                  <Input
                    id="addressState"
                    value={profile.address_state || ""}
                    onChange={(e) => handleChange("address_state", e.target.value)}
                    placeholder="CA"
                    disabled={isSaving}
                  />
                </div>
                <div>
                  <Label htmlFor="addressZip">ZIP Code</Label>
                  <Input
                    id="addressZip"
                    value={profile.address_zip || ""}
                    onChange={(e) => handleChange("address_zip", e.target.value)}
                    placeholder="90210"
                    disabled={isSaving}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="phoneNumber">Phone Number</Label>
                <Input
                  id="phoneNumber"
                  type="tel"
                  value={profile.phone_number || ""}
                  onChange={(e) => handleChange("phone_number", e.target.value)}
                  placeholder="(555) 123-4567"
                  disabled={isSaving}
                />
              </div>

              <h2 className="text-xl font-semibold border-b pb-3 pt-4 mb-4">Financial Snapshot</h2>
              <div>
                <Label htmlFor="creditScore">Your Estimated Credit Score ({profile.credit_score || "N/A"})</Label>
                <Slider
                  id="creditScore"
                  min={300}
                  max={850}
                  step={1}
                  value={[profile.credit_score || 650]}
                  onValueChange={(value) => handleChange("credit_score", value[0])}
                  className="my-3"
                  disabled={isSaving}
                />
                <p className="text-xs text-muted-foreground">
                  Adjust the slider to your current score. This helps VestBot provide tailored advice.
                </p>
              </div>

              <div className="pt-2">
                <Label className="text-lg font-semibold mb-3 block">Primary Financial Goal</Label>
                <FinancialGoalsSelector
                  onGoalSelected={(goal) => handleChange("financial_goal", goal)}
                  selectedGoal={profile.financial_goal}
                />
              </div>

              <div className="flex justify-end pt-6">
                <Button
                  onClick={handleSave}
                  disabled={isSaving || isLoading}
                  className="bg-cyan-500 hover:bg-cyan-600 min-w-[120px]"
                >
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </main>
    </div>
  )
}

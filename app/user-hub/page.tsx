"use client"

import { useState, useEffect } from "react"
import { InteractiveRoadmap } from "@/components/interactive-roadmap"
import { ChatInterface } from "@/components/chat-interface"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/auth-context"
import { getSupabaseClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { useChat } from "@ai-sdk/react"
import type { FinancialGoal } from "@/components/financial-goals-selector"
import { predefinedGoals } from "@/components/financial-goals-selector"
import { Loader2, AlertTriangle, Target, MessageSquare, FileText } from "lucide-react"
import dynamic from "next/dynamic"

const DisputeLetterGenerator = dynamic(
  () => import("@/components/dispute-letter-generator").then((mod) => mod.DisputeLetterGenerator),
  {
    ssr: false,
    loading: () => (
      <div className="flex justify-center items-center py-10">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
        <p className="ml-3">Loading Tools...</p>
      </div>
    ),
  },
)

interface UserProfileData {
  id: string
  full_name: string | null
  credit_score: number | null
  financial_goal: FinancialGoal | null
  address_street?: string | null
  address_city?: string | null
  address_state?: string | null
  address_zip?: string | null
  phone_number?: string | null
  email?: string | null
}

interface RoadmapStepData {
  title: string
  description: string
  duration?: string
  subSteps?: string[] | { [key: string]: string }
}

interface UserRoadmap {
  id: string
  user_id: string
  financial_goal_id?: string
  roadmap_data: { steps: RoadmapStepData[] }
  created_at: string
}

export default function UserHubPage() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth()
  const supabase = getSupabaseClient()
  const router = useRouter()

  const [activeTab, setActiveTab] = useState("roadmap")
  const [userProfile, setUserProfile] = useState<UserProfileData | null>(null)
  const [roadmap, setRoadmap] = useState<UserRoadmap | null>(null)
  const [isLoadingProfileAndRoadmap, setIsLoadingProfileAndRoadmap] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isGeneratingRoadmap, setIsGeneratingRoadmap] = useState(false)

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading: chatIsLoading,
    error: chatError,
    setMessages,
    setInput,
  } = useChat({
    api: "/api/chat",
    body: {
      // @ts-ignore
      creditScore: userProfile?.credit_score,
      financialGoal: userProfile?.financial_goal
        ? {
            id: userProfile.financial_goal.id,
            title: userProfile.financial_goal.title,
            description: userProfile.financial_goal.description,
            customDetails: userProfile.financial_goal.customDetails,
          }
        : null,
    },
    onError: (err) => {
      console.error("Chat API error:", err)
    },
  })

  useEffect(() => {
    if (authLoading) return
    if (!isAuthenticated) {
      router.push("/login?redirect=/user-hub")
      return
    }

    const fetchData = async () => {
      if (!user) {
        setIsLoadingProfileAndRoadmap(false)
        return
      }
      try {
        setIsLoadingProfileAndRoadmap(true)
        setError(null)

        const { data: profileData, error: profileError } = await supabase
          .from("user_profiles")
          .select(
            "id, full_name, credit_score, financial_goal, address_street, address_city, address_state, address_zip, phone_number",
          )
          .eq("id", user.id)
          .single()

        if (profileError && profileError.code !== "PGRST116") throw profileError

        let fetchedUserProfile: UserProfileData | null = null
        if (profileData) {
          const dbGoalData = profileData.financial_goal as any
          let reconstructedFinancialGoal: FinancialGoal | null = null

          if (dbGoalData && dbGoalData.id) {
            const predefinedMatch = predefinedGoals.find((g) => g.id === dbGoalData.id)
            if (predefinedMatch) {
              reconstructedFinancialGoal = {
                ...predefinedMatch,
                title: dbGoalData.title || predefinedMatch.title,
                description: dbGoalData.description || predefinedMatch.description,
                customDetails: dbGoalData.customDetails || predefinedMatch.customDetails,
              }
            } else if (dbGoalData.id === "other") {
              reconstructedFinancialGoal = {
                id: "other",
                title: dbGoalData.title || "Custom Goal",
                description: dbGoalData.description || "Your custom financial objective.",
                icon: <Target className="w-6 h-6" />,
                customDetails: dbGoalData.customDetails,
              }
            }
          }

          fetchedUserProfile = {
            ...profileData,
            email: user.email || "",
            financial_goal: reconstructedFinancialGoal,
          } as UserProfileData
        }
        setUserProfile(fetchedUserProfile)

        if (!fetchedUserProfile) {
          setError("Profile not found. Please complete your profile first.")
          setIsLoadingProfileAndRoadmap(false)
          return
        }

        const { data: roadmapData, error: roadmapError } = await supabase
          .from("user_roadmaps")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single()

        if (roadmapError && roadmapError.code !== "PGRST116") throw roadmapError
        if (roadmapData) {
          setRoadmap(roadmapData as UserRoadmap)
        }
      } catch (err: any) {
        console.error("Error fetching user hub data:", err)
        setError(err.message || "Failed to load your information.")
      } finally {
        setIsLoadingProfileAndRoadmap(false)
      }
    }

    if (user) fetchData()
    else if (!authLoading) setIsLoadingProfileAndRoadmap(false)
  }, [user, authLoading, isAuthenticated, supabase, router])

  const handleGenerateRoadmap = async () => {
    if (!userProfile || !userProfile.financial_goal || !userProfile.credit_score) {
      setError("Please complete your profile (credit score & financial goal) before generating a roadmap.")
      return
    }
    setIsGeneratingRoadmap(true)
    setError(null)
    try {
      const response = await fetch("/api/generate-roadmap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creditScore: userProfile.credit_score,
          financialGoal: {
            id: userProfile.financial_goal.id,
            title: userProfile.financial_goal.title,
            description: userProfile.financial_goal.description,
            customDetails: userProfile.financial_goal.customDetails,
          },
        }),
      })
      if (!response.ok) {
        const errData = await response.json()
        throw new Error(errData.error || "Failed to generate roadmap.")
      }
      const newRoadmap = await response.json()
      setRoadmap(newRoadmap as UserRoadmap)
    } catch (err: any) {
      console.error("Error generating roadmap:", err)
      setError(err.message || "An unexpected error occurred while generating the roadmap.")
    } finally {
      setIsGeneratingRoadmap(false)
    }
  }

  const handleAskAboutRoadmapStep = (stepTitle: string, stepDescription: string, subSteps?: any) => {
    const subStepsText = subSteps
      ? `\nSub-steps: ${Array.isArray(subSteps) ? subSteps.join(", ") : JSON.stringify(subSteps)}`
      : ""
    const prompt = `I have a question about this step in my financial roadmap:
Step Title: "${stepTitle}"
Description: "${stepDescription}"${subStepsText}
Can you give me more details or advice on this?`
    const userMessage = {
      id: Date.now().toString(),
      role: "user" as const,
      content: prompt,
    }
    setMessages([...messages, userMessage])
    setInput(prompt)
    setActiveTab("chat")
  }

  if (isLoadingProfileAndRoadmap || authLoading) {
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
          <p>Please log in to access your User Hub.</p>
          <Button onClick={() => router.push("/login?redirect=/user-hub")} className="mt-4">
            Go to Login
          </Button>
        </main>
      </div>
    )
  }

  if (error && !isGeneratingRoadmap && !isLoadingProfileAndRoadmap) {
    return (
      <div className="min-h-screen bg-background">
        
        <main className="pt-32 px-4 container mx-auto">
          <Card className="p-6 bg-destructive/10 border-destructive text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2 text-destructive">Error</h2>
            <p className="mb-4">{error}</p>
            {error.includes("Profile not found") ||
            error.includes("financial goal") ||
            error.includes("credit score") ? (
              <Button onClick={() => router.push("/profile")}>Go to Profile</Button>
            ) : (
              <Button onClick={() => window.location.reload()}>Try Again</Button>
            )}
          </Card>
        </main>
      </div>
    )
  }

  if (!userProfile && !isLoadingProfileAndRoadmap) {
    return (
      <div className="min-h-screen bg-background">
        
        <main className="pt-32 px-4 container mx-auto">
          <Card className="p-6 bg-card/80 backdrop-blur text-center">
            <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Profile Not Found</h2>
            <p className="mb-4 text-muted-foreground">
              We couldn't find your profile. Please set up your profile to use the hub.
            </p>
            <Button onClick={() => router.push("/profile")}>Set Up Profile</Button>
          </Card>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      
      <main className="pt-20 md:pt-24 px-2 pb-16 flex-grow">
        <div className="container mx-auto max-w-5xl h-full">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-3 mb-4 sticky top-16 z-10 bg-background/90 backdrop-blur-sm py-2">
              <TabsTrigger
                value="roadmap"
                className="flex items-center gap-2 data-[state=active]:text-cyan-500 data-[state=active]:shadow-sm"
              >
                <Target className="h-4 w-4" />
                Roadmap
              </TabsTrigger>
              <TabsTrigger
                value="chat"
                className="flex items-center gap-2 data-[state=active]:text-cyan-500 data-[state=active]:shadow-sm"
              >
                <MessageSquare className="h-4 w-4" />
                VestBot AI
              </TabsTrigger>
              <TabsTrigger
                value="disputes"
                className="flex items-center gap-2 data-[state=active]:text-cyan-500 data-[state=active]:shadow-sm"
              >
                <FileText className="h-4 w-4" />
                Dispute Letters
              </TabsTrigger>
            </TabsList>

            <TabsContent
              value="roadmap"
              className="flex-grow overflow-y-auto rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <Card className="bg-card/80 backdrop-blur h-full">
                <CardHeader>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <div>
                      <CardTitle className="gradient-text">Your Financial Roadmap</CardTitle>
                      {userProfile?.financial_goal && (
                        <CardDescription>
                          Tailored for your goal: <strong>{userProfile.financial_goal.title}</strong>
                        </CardDescription>
                      )}
                    </div>
                    {!roadmap && userProfile?.financial_goal && userProfile?.credit_score && (
                      <Button
                        onClick={handleGenerateRoadmap}
                        disabled={isGeneratingRoadmap}
                        className="bg-cyan-500 hover:bg-cyan-600 whitespace-nowrap"
                      >
                        {isGeneratingRoadmap ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Target className="mr-2 h-4 w-4" />
                        )}
                        {isGeneratingRoadmap ? "Generating..." : "Generate My Roadmap"}
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-2">
                  {isGeneratingRoadmap && (
                    <div className="text-center p-6">
                      <Loader2 className="h-8 w-8 animate-spin text-cyan-500 mx-auto mb-4" />
                      <p className="text-muted-foreground">Generating your personalized roadmap...</p>
                    </div>
                  )}
                  {error && isGeneratingRoadmap && (
                    <Card className="p-4 bg-destructive/10 border-destructive text-center my-4">
                      <AlertTriangle className="h-6 w-6 text-destructive mx-auto mb-2" />
                      <p className="text-sm text-destructive">{error}</p>
                    </Card>
                  )}
                  {!isGeneratingRoadmap && roadmap?.roadmap_data?.steps && roadmap.roadmap_data.steps.length > 0 ? (
                    <InteractiveRoadmap
                      roadmapSteps={roadmap.roadmap_data.steps}
                      onAskAboutStep={handleAskAboutRoadmapStep}
                    />
                  ) : (
                    !isGeneratingRoadmap &&
                    !error &&
                    userProfile && (
                      <div className="p-8 text-center">
                        <Target className="h-12 w-12 text-cyan-400 mx-auto mb-4" />
                        <h2 className="text-xl font-semibold mb-2">Ready for Your Roadmap?</h2>
                        {!userProfile.financial_goal ? (
                          <p className="text-muted-foreground mb-4">
                            Please select a financial goal in your profile first.
                          </p>
                        ) : !userProfile.credit_score ? (
                          <p className="text-muted-foreground mb-4">
                            Please add your credit score in your profile first.
                          </p>
                        ) : (
                          <p className="text-muted-foreground mb-4">
                            Click the button above to generate your personalized steps.
                          </p>
                        )}
                        {(!userProfile.financial_goal || !userProfile.credit_score) && (
                          <Button onClick={() => router.push("/profile")}>Go to Profile</Button>
                        )}
                      </div>
                    )
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent
              value="chat"
              className="flex-grow flex flex-col overflow-hidden rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <Card className="flex-grow flex flex-col bg-card/80 backdrop-blur h-full">
                <CardHeader className="border-b">
                  <CardTitle className="gradient-text">VestBot AI Assistant</CardTitle>
                </CardHeader>
                <CardContent className="flex-grow p-0 overflow-hidden">
                  <ChatInterface
                    messages={messages}
                    input={input}
                    handleInputChange={handleInputChange}
                    handleSubmit={handleSubmit}
                    isLoading={chatIsLoading}
                    error={chatError}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent
              value="disputes"
              className="flex-grow overflow-y-auto rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <Card className="bg-card/80 backdrop-blur h-full">
                <CardHeader>
                  <CardTitle className="gradient-text">Dispute Letter Generator</CardTitle>
                  <CardDescription>Create and manage your dispute letters.</CardDescription>
                </CardHeader>
                <CardContent>
                  {userProfile ? (
                    <DisputeLetterGenerator />
                  ) : (
                    <p className="text-muted-foreground text-center p-8">
                      Loading user information for dispute letters...
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  )
}

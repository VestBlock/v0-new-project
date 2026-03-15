import { getSupabaseServerSingleton } from "@/lib/supabase/server"
import type { RoadmapData } from "@/types/supabase" // Ensure Roadmap types are imported
import { CreditRoadmapDisplay } from "@/components/credit-roadmap-display"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { AlertCircle, FileText, CheckCircle, Info } from "lucide-react"
import { notFound } from "next/navigation"

interface CreditReportData {
  id: string
  ai_analysis: string | null // General text analysis
  created_at: string
  // Add other fields from credit_reports if needed for display
}

interface FullRoadmapData extends RoadmapData {
  // For clarity, though RoadmapData already has steps
  // Potentially add other top-level roadmap fields here if your AI generates them
}

interface PageProps {
  params: {
    reportId: string
  }
}

async function getCreditDashboardData(
  reportId: string,
  userId: string,
): Promise<{
  report: CreditReportData | null
  roadmap: FullRoadmapData | null
  error?: string
}> {
  const supabase = getSupabaseServerSingleton()

  // Fetch the credit report analysis
  const { data: reportData, error: reportError } = await supabase
    .from("credit_reports")
    .select("id, ai_analysis, created_at")
    .eq("id", reportId)
    .eq("user_id", userId) // Ensure user owns this report
    .single()

  if (reportError || !reportData) {
    console.error(`Error fetching credit report ${reportId} for user ${userId}:`, reportError?.message)
    return { report: null, roadmap: null, error: reportError?.message || "Credit report not found or access denied." }
  }

  // Fetch the corresponding roadmap
  const { data: roadmapData, error: roadmapError } = await supabase
    .from("credit_improvement_roadmaps")
    .select("roadmap_data, generated_at") // roadmap_data is the JSONB field
    .eq("credit_report_id", reportId)
    .eq("user_id", userId) // Ensure user owns this roadmap
    .single()

  if (roadmapError || !roadmapData) {
    console.warn(
      `Roadmap not found for credit report ${reportId} (user ${userId}). This might be okay if generation is pending or failed. Error: ${roadmapError?.message}`,
    )
    // It's possible the roadmap generation failed or is still in progress if the API was interrupted.
    // For now, we'll return the report and null for roadmap. The UI can handle this.
    return { report: reportData as CreditReportData, roadmap: null, error: roadmapError?.message }
  }

  // roadmap_data.roadmap_data should be the object { steps: [...] }
  const parsedRoadmap = roadmapData.roadmap_data as FullRoadmapData

  return {
    report: reportData as CreditReportData,
    roadmap: parsedRoadmap,
  }
}

export default async function CreditDashboardPage({ params }: PageProps) {
  const supabase = getSupabaseServerSingleton()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    // Or redirect to login
    return (
      <div className="container mx-auto p-4 md:p-8 text-center">
        <Card className="max-w-lg mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center justify-center gap-2">
              <AlertCircle /> Authentication Required
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p>Please log in to view your credit dashboard.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { reportId } = params
  const { report, roadmap, error } = await getCreditDashboardData(reportId, user.id)

  if (error && !report) {
    // Critical error, report itself not found
    notFound() // Or a more user-friendly error display
  }

  if (!report) {
    // Should be caught by the above, but as a fallback
    return (
      <div className="container mx-auto p-4 md:p-8 text-center">
        <Card className="max-w-lg mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center justify-center gap-2">
              <AlertCircle /> Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p>Could not load credit report data. Please try again later.</p>
            {error && <p className="text-sm text-muted-foreground mt-2">Details: {error}</p>}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Your Credit Dashboard</h1>
        <p className="text-muted-foreground">
          Analysis of your credit report submitted on {new Date(report.created_at).toLocaleDateString()}.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-8">
          {/* Section for Personalized Roadmap */}
          <Card className="border-primary/20 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <CheckCircle className="h-6 w-6 text-green-500" />
                Personalized Credit Improvement Roadmap
              </CardTitle>
              <CardDescription>
                Actionable steps based on your credit report analysis to help you improve your financial health.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {roadmap && roadmap.steps && roadmap.steps.length > 0 ? (
                <CreditRoadmapDisplay roadmapSteps={roadmap.steps} />
              ) : (
                <div className="text-center py-8">
                  <Info className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="font-semibold">Roadmap Not Available</p>
                  <p className="text-sm text-muted-foreground">
                    {error
                      ? `There was an issue generating your roadmap: ${error}`
                      : "Your personalized roadmap is currently being generated or could not be created."}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Please check back later or try re-analyzing your report if the issue persists.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Section for General AI Analysis */}
        <div className="lg:col-span-1 space-y-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <FileText className="h-6 w-6 text-blue-500" />
                AI Credit Report Analysis
              </CardTitle>
              <CardDescription>A detailed textual analysis of your uploaded credit report.</CardDescription>
            </CardHeader>
            <CardContent>
              {report.ai_analysis ? (
                <div className="prose prose-sm max-w-none dark:prose-invert whitespace-pre-line">
                  {report.ai_analysis}
                </div>
              ) : (
                <p className="text-muted-foreground">No detailed analysis text available.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

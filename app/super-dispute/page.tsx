import type { Metadata } from "next"
import SuperDisputeClient from "./super-dispute-client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Shield, Zap, FileText, CheckCircle } from "lucide-react"

export const metadata: Metadata = {
  title: "Advanced Dispute Draft Builder - VestBlock",
  description: "Advanced credit dispute preparation for organizing report issues, letter drafts, and follow-up steps.",
  robots: {
    index: false,
    follow: false,
  },
}

export default function SuperDisputePage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header Section */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Shield className="h-8 w-8 text-cyan-500" />
          <h1 className="text-4xl font-bold gradient-text">Advanced Dispute Draft Builder</h1>
        </div>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Our most advanced dispute preparation process for analyzing your credit report, organizing possible reporting problems,
          and generating draft letters you can review before sending.
        </p>
        <Badge variant="secondary" className="mt-4">
          <Zap className="h-4 w-4 mr-1" />
          AI-Powered
        </Badge>
      </div>

      {/* Features Grid */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-500" />
              Smart Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              VestBlock analyzes your credit report to identify possible inaccuracies, mixed information, collection
              issues, and other reporting concerns that may need documentation or follow-up.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-500" />
              Automated Letters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Generates professional draft letters for review so you can prepare bureau, collector, or follow-up
              disputes more efficiently.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Better Organization
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              The goal is a cleaner process: clearer reasons, better document tracking, and more disciplined
              follow-up than generic one-size-fits-all templates.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Form */}
      <SuperDisputeClient />

      {/* How It Works Section */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>How The Draft Builder Works</CardTitle>
          <CardDescription>Our advanced 4-step process for clearer dispute preparation</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-cyan-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-cyan-600 font-bold">1</span>
              </div>
              <h3 className="font-semibold mb-2">Upload Report</h3>
              <p className="text-sm text-muted-foreground">
                Upload your credit report and our AI will analyze every line item
              </p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-blue-600 font-bold">2</span>
              </div>
              <h3 className="font-semibold mb-2">AI Analysis</h3>
              <p className="text-sm text-muted-foreground">
                The review identifies possible reporting issues, mixed data, duplicate items, and follow-up needs
              </p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-purple-600 font-bold">3</span>
              </div>
              <h3 className="font-semibold mb-2">Generate Letters</h3>
              <p className="text-sm text-muted-foreground">
                Creates tailored draft letters with factual language based on the issue type
              </p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-green-600 font-bold">4</span>
              </div>
              <h3 className="font-semibold mb-2">Track Results</h3>
              <p className="text-sm text-muted-foreground">
                Monitor dispute progress and get updates on bureau responses
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Methods VestBlock Supports Best</CardTitle>
          <CardDescription>
            Strong credit repair work usually matches the method to the actual reporting problem.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {[
              "Bureau disputes for inaccurate, incomplete, or duplicated report data",
              "Direct furnisher disputes when the source of the reporting needs to correct its own data",
              "Debt validation follow-up for collector-related accounts",
              "Method of verification follow-up after a verified dispute result still looks wrong",
              "Identity theft block and fraud-alert paths for unauthorized accounts",
              "Mixed-file and personal-information correction when the file itself is contaminated",
            ].map((item) => (
              <div key={item} className="flex gap-3 rounded-lg border p-4">
                <CheckCircle className="mt-0.5 h-5 w-5 text-cyan-500" />
                <p className="text-sm text-muted-foreground">{item}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-sm text-muted-foreground">
            VestBlock does not promise deletion of accurate negative information, guaranteed score increases,
            or legal outcomes. The process is built around documentation, user review, and practical follow-up.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

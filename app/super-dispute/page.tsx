import type { Metadata } from "next"
import SuperDisputeClient from "./super-dispute-client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Shield, Zap, FileText, CheckCircle } from "lucide-react"

export const metadata: Metadata = {
  title: "Super Dispute - VestBlock",
  description: "Advanced AI-powered credit dispute system for maximum results",
}

export default function SuperDisputePage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header Section */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Shield className="h-8 w-8 text-cyan-500" />
          <h1 className="text-4xl font-bold gradient-text">Super Dispute System</h1>
        </div>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Our most advanced AI-powered dispute system that analyzes your credit report and generates highly effective,
          personalized dispute letters
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
              Advanced AI analyzes your credit report to identify the most disputable items and creates targeted
              strategies for each negative entry.
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
              Generates professional, legally compliant dispute letters with specific language proven to be effective
              with credit bureaus.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Higher Success Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Our AI-powered approach has shown significantly higher success rates compared to generic dispute
              templates.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Form */}
      <SuperDisputeClient />

      {/* How It Works Section */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>How Super Dispute Works</CardTitle>
          <CardDescription>Our advanced 4-step process for maximum dispute effectiveness</CardDescription>
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
                Advanced algorithms identify disputable items and violation patterns
              </p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-purple-600 font-bold">3</span>
              </div>
              <h3 className="font-semibold mb-2">Generate Letters</h3>
              <p className="text-sm text-muted-foreground">
                Creates personalized dispute letters with specific legal language
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
    </div>
  )
}

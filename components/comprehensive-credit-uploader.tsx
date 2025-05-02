"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, Upload, FileText, ImageIcon, AlertCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/lib/auth-provider"

export default function ComprehensiveCreditUploader() {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [textInput, setTextInput] = useState<string>("")
  const [activeTab, setActiveTab] = useState<string>("file")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()
  const { user, getToken } = useAuth()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0]

      // Check file type
      const validTypes = ["application/pdf", "image/jpeg", "image/png"]
      if (!validTypes.includes(selectedFile.type)) {
        setError("Please upload a PDF or image file (JPEG, PNG)")
        setFile(null)
        return
      }

      // Check file size (10MB limit)
      if (selectedFile.size > 10 * 1024 * 1024) {
        setError("File size exceeds 10MB limit")
        setFile(null)
        return
      }

      setFile(selectedFile)
      setError(null)
    }
  }

  const processReport = async () => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please log in to analyze credit reports",
        variant: "destructive",
      })
      return
    }

    if ((activeTab === "file" && !file) || (activeTab === "text" && !textInput.trim())) {
      toast({
        title: "Input required",
        description: activeTab === "file" ? "Please select a file" : "Please enter text",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const token = await getToken()

      if (activeTab === "file") {
        // Convert file to base64
        const reader = new FileReader()
        reader.readAsDataURL(file!)

        reader.onload = async () => {
          const base64data = reader.result as string

          // Send to API
          const response = await fetch("/api/analyze-credit-report", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              fileData: base64data,
              fileName: file!.name,
            }),
          })

          handleApiResponse(response)
        }

        reader.onerror = () => {
          setError("Failed to read file")
          setLoading(false)
          toast({
            title: "Error",
            description: "Failed to read file",
            variant: "destructive",
          })
        }
      } else {
        // Process text input
        const response = await fetch("/api/analyze-credit-report", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            textContent: textInput,
          }),
        })

        handleApiResponse(response)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
      setLoading(false)
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "An unexpected error occurred",
        variant: "destructive",
      })
    }
  }

  const handleApiResponse = async (response: Response) => {
    try {
      const data = await response.json()

      if (data.success) {
        setResult(data.result)
        toast({
          title: "Analysis Complete",
          description: "Your credit report has been successfully analyzed",
          variant: "default",
        })
      } else {
        setError(data.error || "Failed to process credit report")
        toast({
          title: "Analysis Failed",
          description: data.error || "Failed to process credit report",
          variant: "destructive",
        })
      }
    } catch (err) {
      setError("Failed to parse API response")
      toast({
        title: "Error",
        description: "Failed to parse API response",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFile(null)
    setTextInput("")
    setResult(null)
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl">Credit Report Analysis</CardTitle>
      </CardHeader>
      <CardContent>
        {result ? (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-semibold">Analysis Results</h3>
              <Button variant="outline" onClick={resetForm}>
                Analyze Another Report
              </Button>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Overview</CardTitle>
                </CardHeader>
                <CardContent>
                  {result.overview.score !== null ? (
                    <div className="text-center mb-4">
                      <div className="text-4xl font-bold">{result.overview.score}</div>
                      <div className="text-sm text-muted-foreground">Credit Score</div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 p-3 mb-4 bg-yellow-50 text-yellow-800 rounded-md">
                      <AlertCircle size={16} />
                      <span>No credit score found in report</span>
                    </div>
                  )}

                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium mb-2">Summary</h4>
                      <p className="text-sm">{result.overview.summary}</p>
                    </div>

                    <div>
                      <h4 className="font-medium mb-2">Positive Factors</h4>
                      <ul className="list-disc pl-5 text-sm space-y-1">
                        {result.overview.positiveFactors.map((factor: string, i: number) => (
                          <li key={i}>{factor}</li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <h4 className="font-medium mb-2">Negative Factors</h4>
                      <ul className="list-disc pl-5 text-sm space-y-1">
                        {result.overview.negativeFactors.map((factor: string, i: number) => (
                          <li key={i}>{factor}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Disputes</CardTitle>
                </CardHeader>
                <CardContent>
                  {result.disputes.items.length > 0 ? (
                    <div className="space-y-4">
                      {result.disputes.items.map((item: any, i: number) => (
                        <div key={i} className="border p-3 rounded-md">
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="font-medium">Bureau:</span> {item.bureau}
                            </div>
                            <div>
                              <span className="font-medium">Issue:</span> {item.issueType}
                            </div>
                            <div className="col-span-2">
                              <span className="font-medium">Account:</span> {item.accountName}
                            </div>
                            <div className="col-span-2">
                              <span className="font-medium">Account #:</span> {item.accountNumber}
                            </div>
                            <div className="col-span-2">
                              <span className="font-medium">Recommended Action:</span> {item.recommendedAction}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">No dispute opportunities identified</div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Tabs defaultValue="creditHacks">
              <TabsList className="grid grid-cols-3">
                <TabsTrigger value="creditHacks">Credit Hacks</TabsTrigger>
                <TabsTrigger value="creditCards">Credit Cards</TabsTrigger>
                <TabsTrigger value="sideHustles">Side Hustles</TabsTrigger>
              </TabsList>

              <TabsContent value="creditHacks" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Credit Improvement Strategies</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      {result.creditHacks.recommendations.map((hack: any, i: number) => (
                        <div key={i} className="border p-4 rounded-md">
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-semibold">{hack.title}</h4>
                            <div
                              className={`px-2 py-1 text-xs rounded-full ${
                                hack.impact === "high"
                                  ? "bg-green-100 text-green-800"
                                  : hack.impact === "medium"
                                    ? "bg-yellow-100 text-yellow-800"
                                    : "bg-blue-100 text-blue-800"
                              }`}
                            >
                              {hack.impact.charAt(0).toUpperCase() + hack.impact.slice(1)} Impact
                            </div>
                          </div>
                          <p className="text-sm mb-2">{hack.description}</p>
                          <div className="text-sm">
                            <span className="font-medium">Timeframe:</span> {hack.timeframe}
                          </div>
                          <div className="mt-2">
                            <span className="text-sm font-medium">Steps:</span>
                            <ul className="list-disc pl-5 text-sm mt-1 space-y-1">
                              {hack.steps.map((step: string, j: number) => (
                                <li key={j}>{step}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="creditCards" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Recommended Credit Cards</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {result.creditCards.recommendations.map((card: any, i: number) => (
                        <div key={i} className="border p-4 rounded-md">
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-semibold">{card.name}</h4>
                            <div
                              className={`px-2 py-1 text-xs rounded-full ${
                                card.approvalLikelihood === "high"
                                  ? "bg-green-100 text-green-800"
                                  : card.approvalLikelihood === "medium"
                                    ? "bg-yellow-100 text-yellow-800"
                                    : "bg-red-100 text-red-800"
                              }`}
                            >
                              {card.approvalLikelihood.charAt(0).toUpperCase() + card.approvalLikelihood.slice(1)}{" "}
                              Approval
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="font-medium">Issuer:</span> {card.issuer}
                            </div>
                            <div>
                              <span className="font-medium">Annual Fee:</span> {card.annualFee}
                            </div>
                            <div>
                              <span className="font-medium">APR:</span> {card.apr}
                            </div>
                            <div className="col-span-2">
                              <span className="font-medium">Rewards:</span> {card.rewards}
                            </div>
                            <div className="col-span-2">
                              <span className="font-medium">Best For:</span> {card.bestFor}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="sideHustles" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Income Opportunities</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      {result.sideHustles.recommendations.map((hustle: any, i: number) => (
                        <div key={i} className="border p-4 rounded-md">
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-semibold">{hustle.title}</h4>
                            <div
                              className={`px-2 py-1 text-xs rounded-full ${
                                hustle.difficulty === "easy"
                                  ? "bg-green-100 text-green-800"
                                  : hustle.difficulty === "medium"
                                    ? "bg-yellow-100 text-yellow-800"
                                    : "bg-red-100 text-red-800"
                              }`}
                            >
                              {hustle.difficulty.charAt(0).toUpperCase() + hustle.difficulty.slice(1)} Difficulty
                            </div>
                          </div>
                          <p className="text-sm mb-2">{hustle.description}</p>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="font-medium">Potential Earnings:</span> {hustle.potentialEarnings}
                            </div>
                            <div>
                              <span className="font-medium">Startup Cost:</span> {hustle.startupCost}
                            </div>
                            <div>
                              <span className="font-medium">Time Commitment:</span> {hustle.timeCommitment}
                            </div>
                            <div className="col-span-2">
                              <span className="font-medium">Skills Needed:</span> {hustle.skills.join(", ")}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-2">
              <TabsTrigger value="file" disabled={loading}>
                <FileText className="mr-2 h-4 w-4" />
                Upload File
              </TabsTrigger>
              <TabsTrigger value="text" disabled={loading}>
                <FileText className="mr-2 h-4 w-4" />
                Enter Text
              </TabsTrigger>
            </TabsList>

            <TabsContent value="file" className="mt-4">
              <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-12">
                <input
                  type="file"
                  id="file-upload"
                  ref={fileInputRef}
                  className="hidden"
                  accept="application/pdf,image/jpeg,image/png"
                  onChange={handleFileChange}
                  disabled={loading}
                />
                <label htmlFor="file-upload" className="flex flex-col items-center justify-center cursor-pointer">
                  {file?.type.startsWith("image/") ? (
                    <ImageIcon className="h-12 w-12 text-gray-400 mb-4" />
                  ) : file?.type === "application/pdf" ? (
                    <FileText className="h-12 w-12 text-gray-400 mb-4" />
                  ) : (
                    <Upload className="h-12 w-12 text-gray-400 mb-4" />
                  )}

                  <span className="text-sm text-gray-500 text-center">
                    {file ? file.name : "Click to upload your credit report (PDF or image)"}
                  </span>
                  <span className="text-xs text-gray-400 mt-2 text-center">
                    Supported formats: PDF, JPEG, PNG (max 10MB)
                  </span>
                </label>
              </div>
            </TabsContent>

            <TabsContent value="text" className="mt-4">
              <div className="flex flex-col">
                <textarea
                  className="w-full h-64 p-4 border border-gray-300 rounded-lg"
                  placeholder="Paste the text content of your credit report here..."
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  disabled={loading}
                />
                <p className="text-xs text-gray-500 mt-2">
                  Paste the full text of your credit report for the most accurate analysis.
                </p>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </CardContent>

      {!result && (
        <CardFooter className="flex flex-col items-start gap-4">
          <Button
            onClick={processReport}
            disabled={(activeTab === "file" && !file) || (activeTab === "text" && !textInput.trim()) || loading}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analyzing Credit Report...
              </>
            ) : (
              "Analyze Credit Report"
            )}
          </Button>

          {error && (
            <div className="w-full p-4 bg-red-50 text-red-700 rounded-md flex items-start gap-2">
              <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <div>{error}</div>
            </div>
          )}
        </CardFooter>
      )}
    </Card>
  )
}

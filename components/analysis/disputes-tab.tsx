"use client"

import { useState } from "react"
import { Loader2, Download, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/components/ui/use-toast"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/lib/auth-provider"
import { supabase } from "@/lib/supabase-client"

type DisputeItem = {
  bureau: string
  accountName: string
  accountNumber: string
  issueType: string
  recommendedAction: string
}

type DisputesTabProps = {
  data: {
    items: DisputeItem[]
  }
  analysisId: string
}

export function DisputesTab({ data, analysisId }: DisputesTabProps) {
  const [selectedDispute, setSelectedDispute] = useState<DisputeItem | null>(null)
  const [isGeneratingLetter, setIsGeneratingLetter] = useState(false)
  const [letterContent, setLetterContent] = useState<string | null>(null)
  const { toast } = useToast()
  const { user } = useAuth()

  const handleSelectDispute = (dispute: DisputeItem) => {
    setSelectedDispute(dispute)
    setLetterContent(null)
  }

  const handleGenerateLetter = async () => {
    if (!selectedDispute || !user || !analysisId) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select a dispute item first or ensure you're logged in.",
      })
      return
    }

    setIsGeneratingLetter(true)
    setLetterContent(null)

    try {
      console.log("Generating letter for dispute:", selectedDispute)

      // Get the session token
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      if (!token) {
        throw new Error("Authentication token not found")
      }

      // Call the generate letter API
      const response = await fetch("/api/generate-letter", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          analysisId,
          dispute: selectedDispute,
          userInfo: {
            name: user.fullName || user.email?.split("@")[0] || "User",
            email: user.email || "",
            address: user.address || "", // This will be empty if not in the database
            phone: user.phone || "", // This will be empty if not in the database
          },
        }),
      })

      if (!response.ok) {
        let errorMessage = "Failed to generate letter"
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
        } catch (e) {
          // If JSON parsing fails, try to get text
          const textError = await response.text().catch(() => null)
          if (textError) errorMessage = textError
        }
        throw new Error(errorMessage)
      }

      const data = await response.json()

      if (!data.content) {
        throw new Error("No letter content returned from the server")
      }

      console.log("Letter generated successfully")
      setLetterContent(data.content)
    } catch (error) {
      console.error("Error generating letter:", error)
      toast({
        variant: "destructive",
        title: "Error generating letter",
        description: error instanceof Error ? error.message : "Failed to generate letter. Please try again.",
      })
    } finally {
      setIsGeneratingLetter(false)
    }
  }

  const handleDownloadLetter = () => {
    if (!letterContent) return

    try {
      // Create a blob from the letter content
      const blob = new Blob([letterContent], { type: "text/plain" })
      const url = URL.createObjectURL(blob)

      // Create a link and trigger download
      const a = document.createElement("a")
      a.href = url
      a.download = `dispute-letter-${selectedDispute?.accountName.replace(/\s+/g, "-").toLowerCase() || "letter"}.txt`
      document.body.appendChild(a)
      a.click()

      // Clean up
      URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast({
        title: "Letter Downloaded",
        description: "Your dispute letter has been downloaded successfully.",
      })
    } catch (error) {
      console.error("Error downloading letter:", error)
      toast({
        variant: "destructive",
        title: "Download Failed",
        description: "Failed to download the letter. Please try again.",
      })
    }
  }

  // If there's no real data, show a message
  if (!data.items || data.items.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Disputes Found</CardTitle>
          <CardDescription>
            No dispute items were found in your credit report. This could mean your report is in good standing or the
            analysis couldn't identify any disputable items.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            If you believe there are errors on your credit report that should be disputed, you can:
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1 text-sm text-muted-foreground">
            <li>Manually review your credit report for inaccuracies</li>
            <li>Contact the credit bureaus directly to dispute items</li>
            <li>Try uploading a clearer or more complete credit report</li>
          </ul>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Disputable Items</CardTitle>
          <CardDescription>
            Select an item to generate a customized dispute letter for the credit bureau.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bureau</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Issue Type</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((item, index) => (
                <TableRow
                  key={index}
                  className={selectedDispute === item ? "bg-muted/50" : ""}
                  onClick={() => handleSelectDispute(item)}
                  style={{ cursor: "pointer" }}
                >
                  <TableCell>
                    <Badge variant="outline">{item.bureau}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">{item.accountName}</TableCell>
                  <TableCell>{item.issueType}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleSelectDispute(item)
                      }}
                    >
                      Select
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dispute Letter Generator</CardTitle>
          <CardDescription>
            Generate a customized dispute letter for the selected item to send to the credit bureau.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {selectedDispute ? (
            <div className="space-y-4">
              <div className="rounded-md bg-muted p-4">
                <h3 className="font-medium mb-2">Selected Item</h3>
                <div className="space-y-2 text-sm">
                  <p>
                    <span className="font-medium">Bureau:</span> {selectedDispute.bureau}
                  </p>
                  <p>
                    <span className="font-medium">Account:</span> {selectedDispute.accountName}
                  </p>
                  <p>
                    <span className="font-medium">Account Number:</span>{" "}
                    {selectedDispute.accountNumber || "Not available"}
                  </p>
                  <p>
                    <span className="font-medium">Issue Type:</span> {selectedDispute.issueType}
                  </p>
                  <p>
                    <span className="font-medium">Recommended Action:</span> {selectedDispute.recommendedAction}
                  </p>
                </div>
              </div>

              {letterContent ? (
                <div className="space-y-4">
                  <div className="rounded-md border p-4 max-h-60 overflow-y-auto">
                    <pre className="text-xs whitespace-pre-wrap">{letterContent}</pre>
                  </div>
                  <Button onClick={handleDownloadLetter} className="w-full">
                    <Download className="mr-2 h-4 w-4" />
                    Download Letter
                  </Button>
                </div>
              ) : (
                <Button onClick={handleGenerateLetter} disabled={isGeneratingLetter} className="w-full">
                  {isGeneratingLetter ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <FileText className="mr-2 h-4 w-4" />
                      Generate Dispute Letter
                    </>
                  )}
                </Button>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Item Selected</h3>
              <p className="text-muted-foreground">
                Select a dispute item from the list to generate a customized letter.
              </p>
            </div>
          )}
        </CardContent>
        <CardFooter className="text-xs text-muted-foreground">
          <p>
            Tip: After downloading the letter, print it, sign it, and mail it to the credit bureau with copies of any
            supporting documentation.
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}

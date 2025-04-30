"use client"

import { useState } from "react"
import { Loader2, FileText, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { useAuth } from "@/lib/auth-provider"

type DisputesTabProps = {
  data: {
    items: Array<{
      bureau: string
      accountName: string
      accountNumber: string
      issueType: string
      recommendedAction: string
    }>
  }
}

export function DisputesTab({ data }: DisputesTabProps) {
  const [selectedBureau, setSelectedBureau] = useState<string>("All Bureaus")
  const [isGenerating, setIsGenerating] = useState<string | null>(null)
  const [letterContent, setLetterContent] = useState<string>("")
  const [openDialog, setOpenDialog] = useState(false)
  const { user } = useAuth()
  const { toast } = useToast()

  const handleGenerateLetter = async (item: DisputesTabProps["data"]["items"][0]) => {
    if (!user) return

    setIsGenerating(item.accountNumber)

    try {
      const response = await fetch("/api/generate-letter", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          analysisId: "current-analysis-id", // This would be passed from the parent component
          bureau: item.bureau,
          accountName: item.accountName,
          accountNumber: item.accountNumber,
          issueType: item.issueType,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to generate letter")
      }

      const data = await response.json()
      setLetterContent(data.letter.letter_content)
      setOpenDialog(true)

      toast({
        title: "Letter Generated",
        description: "Your dispute letter has been generated successfully.",
      })
    } catch (error) {
      console.error("Error generating letter:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to generate dispute letter. Please try again.",
      })
    } finally {
      setIsGenerating(null)
    }
  }

  const handleDownloadLetter = () => {
    const blob = new Blob([letterContent], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "dispute-letter.txt"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const filteredItems =
    selectedBureau === "All Bureaus"
      ? data.items
      : data.items.filter((item) => item.bureau === selectedBureau || item.bureau === "All Bureaus")

  return (
    <div className="space-y-6">
      <Card className="card-glow">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Dispute Items</CardTitle>
              <CardDescription>Items on your credit report that you may want to dispute.</CardDescription>
            </div>
            <Select value={selectedBureau} onValueChange={setSelectedBureau}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select Bureau" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All Bureaus">All Bureaus</SelectItem>
                <SelectItem value="Experian">Experian</SelectItem>
                <SelectItem value="Equifax">Equifax</SelectItem>
                <SelectItem value="TransUnion">TransUnion</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {filteredItems.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">No dispute items found.</p>
          ) : (
            <div className="space-y-4">
              {filteredItems.map((item, index) => (
                <Card key={index} className="overflow-hidden">
                  <div className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium">{item.accountName}</h3>
                        <p className="text-sm text-muted-foreground">Account #: {item.accountNumber}</p>
                      </div>
                      <Button onClick={() => handleGenerateLetter(item)} disabled={isGenerating === item.accountNumber}>
                        {isGenerating === item.accountNumber ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <FileText className="mr-2 h-4 w-4" />
                            Generate Letter
                          </>
                        )}
                      </Button>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-xs font-medium">Issue Type</p>
                        <p className="text-sm">{item.issueType}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium">Recommended Action</p>
                        <p className="text-sm">{item.recommendedAction}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium">Bureau</p>
                        <p className="text-sm">{item.bureau}</p>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Dispute Letter</DialogTitle>
            <DialogDescription>Review your dispute letter before downloading or printing.</DialogDescription>
          </DialogHeader>
          <div className="bg-muted p-4 rounded-md">
            <pre className="whitespace-pre-wrap text-sm">{letterContent}</pre>
          </div>
          <DialogFooter>
            <Button onClick={handleDownloadLetter}>
              <Download className="mr-2 h-4 w-4" />
              Download Letter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

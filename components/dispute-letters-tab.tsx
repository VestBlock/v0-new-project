"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { FileText, Download, Send, Copy } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

interface DisputeLettersTabProps {
  negativeItems: any[]
  creditScore?: number
}

export function DisputeLettersTab({ negativeItems, creditScore }: DisputeLettersTabProps) {
  const [generatingLetter, setGeneratingLetter] = useState<string | null>(null)
  const [generatedLetters, setGeneratedLetters] = useState<Record<string, string>>({})
  const { toast } = useToast()

  const generateLetter = async (item: any) => {
    setGeneratingLetter(item.id || item.creditor)

    try {
      // Simulate letter generation
      await new Promise((resolve) => setTimeout(resolve, 2000))

      const letterContent = `
Dear ${item.creditor || "Creditor"},

I am writing to dispute the following item on my credit report:

Account: ${item.accountNumber || "N/A"}
Balance: $${item.balance || "0"}
Status: ${item.status || "Unknown"}

Under the Fair Credit Reporting Act (FCRA), I have the right to dispute any inaccurate information on my credit report. I am requesting that you investigate this matter and provide verification of this debt.

If you cannot verify this information, I request that it be removed from my credit report immediately.

Thank you for your prompt attention to this matter.

Sincerely,
[Your Name]
      `.trim()

      setGeneratedLetters((prev) => ({
        ...prev,
        [item.id || item.creditor]: letterContent,
      }))

      toast({
        title: "Letter Generated",
        description: "Your dispute letter has been created successfully.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate letter. Please try again.",
        variant: "destructive",
      })
    } finally {
      setGeneratingLetter(null)
    }
  }

  const copyToClipboard = (content: string) => {
    navigator.clipboard.writeText(content)
    toast({
      title: "Copied",
      description: "Letter copied to clipboard.",
    })
  }

  if (!negativeItems || negativeItems.length === 0) {
    return (
      <div className="text-center py-8">
        <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">No negative items found to dispute.</p>
        <p className="text-sm text-muted-foreground mt-2">Great news! Your credit report appears to be clean.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="mb-4">
        <h3 className="text-lg font-semibold mb-2">Dispute Letters</h3>
        <p className="text-sm text-muted-foreground">
          Generate professional dispute letters for negative items on your credit report.
        </p>
      </div>

      {negativeItems.map((item, index) => (
        <Card key={item.id || index} className="p-4">
          <div className="flex justify-between items-start mb-3">
            <div>
              <h4 className="font-medium">{item.creditor || "Unknown Creditor"}</h4>
              <p className="text-sm text-muted-foreground">{item.accountNumber && `Account: ${item.accountNumber}`}</p>
              <div className="flex gap-2 mt-2">
                <Badge variant="destructive">{item.type || "Negative Item"}</Badge>
                {item.balance && <Badge variant="outline">${item.balance}</Badge>}
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => generateLetter(item)}
              disabled={generatingLetter === (item.id || item.creditor)}
            >
              {generatingLetter === (item.id || item.creditor)
                ? "Generating..."
                : generatedLetters[item.id || item.creditor]
                  ? "Regenerate"
                  : "Generate Letter"}
            </Button>
          </div>

          {generatedLetters[item.id || item.creditor] && (
            <div className="mt-4 p-3 bg-muted rounded-lg">
              <pre className="text-sm whitespace-pre-wrap font-sans">{generatedLetters[item.id || item.creditor]}</pre>
              <div className="flex gap-2 mt-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(generatedLetters[item.id || item.creditor])}
                >
                  <Copy className="h-4 w-4 mr-1" />
                  Copy
                </Button>
                <Button size="sm" variant="outline">
                  <Download className="h-4 w-4 mr-1" />
                  Download PDF
                </Button>
                <Button size="sm" variant="outline">
                  <Send className="h-4 w-4 mr-1" />
                  Send via Mail
                </Button>
              </div>
            </div>
          )}
        </Card>
      ))}
    </div>
  )
}

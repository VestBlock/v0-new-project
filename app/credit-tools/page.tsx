import type { Metadata } from "next"
import ComprehensiveCreditUploader from "@/components/comprehensive-credit-uploader"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import CreditChat from "@/components/credit-chat"

export const metadata: Metadata = {
  title: "Credit Analysis Tools | VestBlock",
  description: "Analyze your credit report and chat with our AI assistant",
}

export default function CreditToolsPage() {
  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-8">Credit Analysis Tools</h1>

      <Tabs defaultValue="analyzer" className="w-full">
        <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 mb-8">
          <TabsTrigger value="analyzer">Credit Analyzer</TabsTrigger>
          <TabsTrigger value="chat">AI Chat Assistant</TabsTrigger>
        </TabsList>

        <TabsContent value="analyzer">
          <ComprehensiveCreditUploader />
        </TabsContent>

        <TabsContent value="chat">
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-lg shadow-lg border h-[600px]">
              <CreditChat analysisId="latest" />
            </div>
            <p className="text-sm text-muted-foreground mt-4 text-center">
              Note: To use the chat assistant, you need to first analyze a credit report.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

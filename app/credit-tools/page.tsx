import CreditReportUploader from "@/components/credit-report-uploader"
import MinimalChat from "@/components/minimal-chat"
import ApiKeyTester from "@/components/api-key-tester"

export default function CreditToolsPage() {
  return (
    <div className="container py-10">
      <h1 className="text-3xl font-bold mb-6">Credit Tools</h1>

      <div className="mb-8">
        <ApiKeyTester />
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        <div>
          <h2 className="text-xl font-semibold mb-4">Upload Credit Report</h2>
          <CreditReportUploader />
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-4">Chat with Credit Assistant</h2>
          <MinimalChat />
        </div>
      </div>
    </div>
  )
}

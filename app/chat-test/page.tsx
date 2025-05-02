import SimpleChat from "@/components/simple-chat"

export default function ChatTestPage() {
  return (
    <div className="container py-10">
      <h1 className="text-3xl font-bold mb-6">Chat Test</h1>
      <div className="max-w-2xl mx-auto">
        <SimpleChat context="The user has a credit score of 720 with 3 credit cards and a mortgage." />
      </div>
    </div>
  )
}

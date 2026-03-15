import { OpenAITest } from '@/components/openai-test';

export default function TestPage() {
  return (
    <div className="min-h-screen bg-background">
      <main className="pt-32 px-4">
        <div className="container mx-auto max-w-3xl">
          <h1 className="text-3xl font-bold mb-8 gradient-text">
            API Connection Tests
          </h1>
          <div className="space-y-8">
            <OpenAITest />
          </div>
        </div>
      </main>
    </div>
  );
}

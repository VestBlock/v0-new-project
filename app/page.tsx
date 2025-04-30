import Link from "next/link"
import Image from "next/image"
import { ArrowRight, CreditCard, FileText, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function Home() {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative py-20 md:py-32 overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,rgba(var(--primary-rgb),0.15),transparent_50%)]" />
        <div className="container px-4 md:px-6">
          <div className="grid gap-6 lg:grid-cols-[1fr_400px] lg:gap-12 xl:grid-cols-[1fr_600px]">
            <div className="flex flex-col justify-center space-y-4">
              <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tighter sm:text-5xl xl:text-6xl/none">
                  <span className="gradient-text">AI-Powered</span> Credit Repair & Financial Empowerment
                </h1>
                <p className="max-w-[600px] text-muted-foreground md:text-xl">
                  Analyze your credit, get personalized recommendations, and improve your financial future with
                  AI-powered insights.
                </p>
              </div>
              <div className="flex flex-col gap-2 min-[400px]:flex-row">
                <Button asChild className="bg-gradient-to-r from-cyan-500 via-purple-500 to-blue-500 text-white">
                  <Link href="/free-analysis">
                    Analyze for Free <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/pricing">Upgrade to Pro</Link>
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-center">
              <Image
                src="/futuristic-robot-vestblock.png"
                alt="VestBlock AI Assistant"
                width={400}
                height={400}
                className="rounded-lg object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-12 md:py-24">
        <div className="container px-4 md:px-6">
          <div className="grid gap-6 md:grid-cols-3 lg:gap-12">
            <div className="card-glow p-6 flex flex-col items-center text-center space-y-4">
              <div className="p-2 rounded-full bg-cyan-500/10">
                <CreditCard className="h-6 w-6 text-cyan-400" />
              </div>
              <h3 className="text-xl font-bold">Credit Analysis</h3>
              <p className="text-muted-foreground">
                Get AI-powered insights on your credit profile and personalized recommendations.
              </p>
            </div>
            <div className="card-glow p-6 flex flex-col items-center text-center space-y-4">
              <div className="p-2 rounded-full bg-purple-500/10">
                <FileText className="h-6 w-6 text-purple-400" />
              </div>
              <h3 className="text-xl font-bold">Dispute Assistance</h3>
              <p className="text-muted-foreground">
                Generate custom dispute letters and strategies to improve your credit score.
              </p>
            </div>
            <div className="card-glow p-6 flex flex-col items-center text-center space-y-4">
              <div className="p-2 rounded-full bg-blue-500/10">
                <TrendingUp className="h-6 w-6 text-blue-400" />
              </div>
              <h3 className="text-xl font-bold">Financial Growth</h3>
              <p className="text-muted-foreground">
                Discover side hustles and credit card recommendations tailored to your profile.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-12 md:py-24 bg-gradient-to-b from-background to-muted/20">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col items-center justify-center space-y-4 text-center">
            <div className="space-y-2">
              <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
                <span className="gradient-text">Powerful Features</span> for Your Financial Future
              </h2>
              <p className="max-w-[900px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                Our AI-powered platform provides everything you need to repair your credit and build a stronger
                financial foundation.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

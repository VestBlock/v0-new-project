import Link from "next/link"
import Image from "next/image"
import { ArrowRight, Check, CreditCard, PieChart, Shield, TrendingUp, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="w-full py-12 md:py-24 lg:py-32 bg-brand-black text-white">
        <div className="container px-4 md:px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div className="flex flex-col space-y-6">
              <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl/none">
                <span className="text-brand-blue">AI-Powered</span> <br />
                <span className="text-brand-purple">Credit Repair</span>
              </h1>
              <p className="text-gray-300 md:text-xl max-w-[600px]">
                Upload your credit report and get personalized dispute letters, improvement strategies, and income
                opportunities in minutes.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button asChild size="lg" className="bg-brand-blue hover:bg-brand-blue/90 text-white">
                  <Link href="/register">Get Started Free</Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="border-brand-purple text-brand-purple hover:bg-brand-purple/10"
                >
                  <Link href="/pricing">View Pricing</Link>
                </Button>
              </div>
            </div>
            <div className="flex justify-center md:justify-end">
              <div className="relative w-full max-w-md">
                <Image
                  src="/vestblock-robot-logo.png"
                  alt="VestBlock AI Credit Repair Robot"
                  width={600}
                  height={600}
                  className="object-contain"
                  priority
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="w-full py-12 md:py-24 lg:py-32 bg-gray-950">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col items-center justify-center space-y-4 text-center">
            <div className="space-y-2">
              <div className="inline-block rounded-lg bg-brand-blue/20 px-3 py-1 text-sm text-brand-blue">
                Key Features
              </div>
              <h2 className="text-3xl font-bold tracking-tighter md:text-4xl text-white">
                Everything You Need to <span className="text-brand-blue">Repair Your Credit</span>
              </h2>
              <p className="max-w-[900px] text-gray-400 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                Our AI-powered platform analyzes your credit report and provides personalized recommendations to help
                you improve your credit score.
              </p>
            </div>
          </div>
          <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 mt-12">
            <Card className="bg-gray-900 border-brand-blue/20 shadow-lg shadow-brand-blue/5">
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className="rounded-full bg-brand-blue/10 p-2">
                    <CreditCard className="h-6 w-6 text-brand-blue" />
                  </div>
                  <CardTitle className="text-white">Credit Analysis</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-gray-400">
                  Upload your credit report and get an instant analysis of your credit score, positive factors, and
                  areas for improvement.
                </p>
              </CardContent>
            </Card>
            <Card className="bg-gray-900 border-brand-blue/20 shadow-lg shadow-brand-blue/5">
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className="rounded-full bg-brand-blue/10 p-2">
                    <Shield className="h-6 w-6 text-brand-blue" />
                  </div>
                  <CardTitle className="text-white">Dispute Letters</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-gray-400">
                  Generate customized dispute letters for each credit bureau to challenge inaccurate or unverifiable
                  items on your report.
                </p>
              </CardContent>
            </Card>
            <Card className="bg-gray-900 border-brand-blue/20 shadow-lg shadow-brand-blue/5">
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className="rounded-full bg-brand-blue/10 p-2">
                    <TrendingUp className="h-6 w-6 text-brand-blue" />
                  </div>
                  <CardTitle className="text-white">Credit Hacks</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-gray-400">
                  Discover proven strategies to boost your credit score quickly and maintain good credit habits for the
                  long term.
                </p>
              </CardContent>
            </Card>
            <Card className="bg-gray-900 border-brand-blue/20 shadow-lg shadow-brand-blue/5">
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className="rounded-full bg-brand-blue/10 p-2">
                    <PieChart className="h-6 w-6 text-brand-blue" />
                  </div>
                  <CardTitle className="text-white">Income Opportunities</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-gray-400">
                  Get personalized recommendations for side hustles and income opportunities based on your skills and
                  situation.
                </p>
              </CardContent>
            </Card>
            <Card className="bg-gray-900 border-brand-blue/20 shadow-lg shadow-brand-blue/5">
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className="rounded-full bg-brand-blue/10 p-2">
                    <Users className="h-6 w-6 text-brand-blue" />
                  </div>
                  <CardTitle className="text-white">AI Assistant</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-gray-400">
                  Chat with our AI assistant to get answers to your credit questions and personalized advice for your
                  situation.
                </p>
              </CardContent>
            </Card>
            <Card className="bg-gray-900 border-brand-blue/20 shadow-lg shadow-brand-blue/5">
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className="rounded-full bg-brand-blue/10 p-2">
                    <Check className="h-6 w-6 text-brand-blue" />
                  </div>
                  <CardTitle className="text-white">Progress Tracking</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-gray-400">
                  Track your credit score improvement over time and see the results of your dispute letters and credit
                  repair efforts.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="w-full py-12 md:py-24 lg:py-32 bg-gray-900">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col items-center justify-center space-y-4 text-center">
            <div className="space-y-2">
              <div className="inline-block rounded-lg bg-brand-purple/20 px-3 py-1 text-sm text-brand-purple">
                How It Works
              </div>
              <h2 className="text-3xl font-bold tracking-tighter md:text-4xl text-white">Simple 3-Step Process</h2>
              <p className="max-w-[900px] text-gray-400 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                Repairing your credit has never been easier. Our platform automates the entire process.
              </p>
            </div>
          </div>
          <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 md:grid-cols-3 mt-12">
            <div className="flex flex-col items-center space-y-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-blue/10">
                <span className="text-2xl font-bold text-brand-blue">1</span>
              </div>
              <h3 className="text-xl font-bold text-white">Upload Your Report</h3>
              <p className="text-sm text-gray-400">
                Simply upload your credit report from any bureau (Experian, Equifax, or TransUnion).
              </p>
            </div>
            <div className="flex flex-col items-center space-y-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-blue/10">
                <span className="text-2xl font-bold text-brand-blue">2</span>
              </div>
              <h3 className="text-xl font-bold text-white">AI Analysis</h3>
              <p className="text-sm text-gray-400">
                Our AI analyzes your report to identify errors, opportunities for improvement, and income strategies.
              </p>
            </div>
            <div className="flex flex-col items-center space-y-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-blue/10">
                <span className="text-2xl font-bold text-brand-blue">3</span>
              </div>
              <h3 className="text-xl font-bold text-white">Take Action</h3>
              <p className="text-sm text-gray-400">
                Use our generated dispute letters, credit hacks, and income opportunities to improve your financial
                health.
              </p>
            </div>
          </div>
          <div className="flex justify-center mt-12">
            <Button asChild size="lg" className="bg-brand-blue hover:bg-brand-blue/90 text-white">
              <Link href="/register">
                Get Started Now <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="w-full py-12 md:py-24 lg:py-32 bg-gray-950">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col items-center justify-center space-y-4 text-center">
            <div className="space-y-2">
              <div className="inline-block rounded-lg bg-brand-purple/20 px-3 py-1 text-sm text-brand-purple">
                Testimonials
              </div>
              <h2 className="text-3xl font-bold tracking-tighter md:text-4xl text-white">What Our Users Say</h2>
              <p className="max-w-[900px] text-gray-400 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                See how VestBlock has helped thousands of people improve their credit scores and financial health.
              </p>
            </div>
          </div>
          <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-3 mt-12">
            <Card className="bg-gray-900 border-brand-purple/20 shadow-lg shadow-brand-purple/5">
              <CardContent className="pt-6">
                <div className="flex flex-col space-y-4">
                  <div className="flex items-center space-x-4">
                    <div className="rounded-full bg-brand-purple/10 p-1">
                      <Image
                        src="/diverse-person-portrait.png"
                        alt="User Avatar"
                        width={40}
                        height={40}
                        className="rounded-full"
                      />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">Sarah Johnson</p>
                      <p className="text-xs text-brand-blue">Credit Score: 580 → 720</p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-400">
                    "VestBlock helped me remove 4 incorrect items from my credit report. My score jumped 140 points in
                    just 3 months! I was able to qualify for a mortgage with a great rate."
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gray-900 border-brand-purple/20 shadow-lg shadow-brand-purple/5">
              <CardContent className="pt-6">
                <div className="flex flex-col space-y-4">
                  <div className="flex items-center space-x-4">
                    <div className="rounded-full bg-brand-purple/10 p-1">
                      <Image
                        src="/thoughtful-man.png"
                        alt="User Avatar"
                        width={40}
                        height={40}
                        className="rounded-full"
                      />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">Michael Torres</p>
                      <p className="text-xs text-brand-blue">Credit Score: 510 → 680</p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-400">
                    "The dispute letters were incredibly effective. I also followed the credit hack strategies and saw
                    my score improve by 170 points. The side hustle recommendations helped me earn extra income too."
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gray-900 border-brand-purple/20 shadow-lg shadow-brand-purple/5">
              <CardContent className="pt-6">
                <div className="flex flex-col space-y-4">
                  <div className="flex items-center space-x-4">
                    <div className="rounded-full bg-brand-purple/10 p-1">
                      <Image
                        src="/diverse-woman-portrait.png"
                        alt="User Avatar"
                        width={40}
                        height={40}
                        className="rounded-full"
                      />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">Jennifer Williams</p>
                      <p className="text-xs text-brand-blue">Credit Score: 620 → 790</p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-400">
                    "I was skeptical at first, but VestBlock delivered. The AI analysis was spot-on, and the dispute
                    letters worked like magic. I'm now in the excellent credit range for the first time in my life!"
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="w-full py-12 md:py-24 lg:py-32 bg-brand-black text-white">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col items-center justify-center space-y-4 text-center">
            <div className="space-y-2">
              <h2 className="text-3xl font-bold tracking-tighter md:text-4xl">
                Ready to <span className="text-brand-blue">Transform</span> Your{" "}
                <span className="text-brand-purple">Credit</span>?
              </h2>
              <p className="max-w-[600px] text-gray-300 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                Join thousands of satisfied users who have improved their credit scores and financial health with
                VestBlock.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 min-[400px]:items-center justify-center">
              <Button asChild size="lg" className="bg-brand-blue hover:bg-brand-blue/90 text-white">
                <Link href="/register">Start Your Free Analysis</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="border-brand-purple text-brand-purple hover:bg-brand-purple/10"
              >
                <Link href="/pricing">View Pricing Plans</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

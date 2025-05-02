import Link from "next/link"
import Image from "next/image"
import { ArrowRight, Check, CreditCard, PieChart, Shield, TrendingUp, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="w-full py-12 md:py-24 lg:py-32 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
        <div className="container px-4 md:px-6 flex flex-col items-center space-y-4 text-center">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl lg:text-6xl/none">
              AI-Powered Credit Repair & Financial Empowerment
            </h1>
            <p className="mx-auto max-w-[700px] text-gray-300 md:text-xl">
              Upload your credit report and get personalized dispute letters, improvement strategies, and income
              opportunities in minutes.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 min-[400px]:items-center justify-center">
            <Button
              asChild
              size="lg"
              className="bg-gradient-to-r from-cyan-500 via-purple-500 to-blue-500 text-white hover:opacity-90"
            >
              <Link href="/register">Get Started Free</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="border-gray-500 text-gray-300">
              <Link href="/pricing">View Pricing</Link>
            </Button>
          </div>
          <div className="mt-12 relative w-full max-w-3xl aspect-video mx-auto">
            <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/20 via-purple-500/20 to-blue-500/20 rounded-xl backdrop-blur-sm"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <Image
                src="/credit-analysis-dashboard.png"
                alt="VestBlock Dashboard"
                width={1280}
                height={720}
                className="rounded-xl shadow-2xl"
                priority
              />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="w-full py-12 md:py-24 lg:py-32">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col items-center justify-center space-y-4 text-center">
            <div className="space-y-2">
              <div className="inline-block rounded-lg bg-muted px-3 py-1 text-sm">Key Features</div>
              <h2 className="text-3xl font-bold tracking-tighter md:text-4xl">
                Everything You Need to Repair Your Credit
              </h2>
              <p className="max-w-[900px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                Our AI-powered platform analyzes your credit report and provides personalized recommendations to help
                you improve your credit score.
              </p>
            </div>
          </div>
          <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 mt-12">
            <Card className="card-glow">
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className="rounded-full bg-primary/10 p-2">
                    <CreditCard className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>Credit Analysis</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Upload your credit report and get an instant analysis of your credit score, positive factors, and
                  areas for improvement.
                </p>
              </CardContent>
            </Card>
            <Card className="card-glow">
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className="rounded-full bg-primary/10 p-2">
                    <Shield className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>Dispute Letters</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Generate customized dispute letters for each credit bureau to challenge inaccurate or unverifiable
                  items on your report.
                </p>
              </CardContent>
            </Card>
            <Card className="card-glow">
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className="rounded-full bg-primary/10 p-2">
                    <TrendingUp className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>Credit Hacks</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Discover proven strategies to boost your credit score quickly and maintain good credit habits for the
                  long term.
                </p>
              </CardContent>
            </Card>
            <Card className="card-glow">
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className="rounded-full bg-primary/10 p-2">
                    <PieChart className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>Income Opportunities</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Get personalized recommendations for side hustles and income opportunities based on your skills and
                  situation.
                </p>
              </CardContent>
            </Card>
            <Card className="card-glow">
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className="rounded-full bg-primary/10 p-2">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>AI Assistant</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Chat with our AI assistant to get answers to your credit questions and personalized advice for your
                  situation.
                </p>
              </CardContent>
            </Card>
            <Card className="card-glow">
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className="rounded-full bg-primary/10 p-2">
                    <Check className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>Progress Tracking</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Track your credit score improvement over time and see the results of your dispute letters and credit
                  repair efforts.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="w-full py-12 md:py-24 lg:py-32 bg-slate-50 dark:bg-slate-900">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col items-center justify-center space-y-4 text-center">
            <div className="space-y-2">
              <div className="inline-block rounded-lg bg-muted px-3 py-1 text-sm">How It Works</div>
              <h2 className="text-3xl font-bold tracking-tighter md:text-4xl">Simple 3-Step Process</h2>
              <p className="max-w-[900px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                Repairing your credit has never been easier. Our platform automates the entire process.
              </p>
            </div>
          </div>
          <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 md:grid-cols-3 mt-12">
            <div className="flex flex-col items-center space-y-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <span className="text-2xl font-bold text-primary">1</span>
              </div>
              <h3 className="text-xl font-bold">Upload Your Report</h3>
              <p className="text-sm text-muted-foreground">
                Simply upload your credit report from any bureau (Experian, Equifax, or TransUnion).
              </p>
            </div>
            <div className="flex flex-col items-center space-y-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <span className="text-2xl font-bold text-primary">2</span>
              </div>
              <h3 className="text-xl font-bold">AI Analysis</h3>
              <p className="text-sm text-muted-foreground">
                Our AI analyzes your report to identify errors, opportunities for improvement, and income strategies.
              </p>
            </div>
            <div className="flex flex-col items-center space-y-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <span className="text-2xl font-bold text-primary">3</span>
              </div>
              <h3 className="text-xl font-bold">Take Action</h3>
              <p className="text-sm text-muted-foreground">
                Use our generated dispute letters, credit hacks, and income opportunities to improve your financial
                health.
              </p>
            </div>
          </div>
          <div className="flex justify-center mt-12">
            <Button asChild size="lg" className="bg-gradient-to-r from-cyan-500 via-purple-500 to-blue-500 text-white">
              <Link href="/register">
                Get Started Now <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="w-full py-12 md:py-24 lg:py-32">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col items-center justify-center space-y-4 text-center">
            <div className="space-y-2">
              <div className="inline-block rounded-lg bg-muted px-3 py-1 text-sm">Testimonials</div>
              <h2 className="text-3xl font-bold tracking-tighter md:text-4xl">What Our Users Say</h2>
              <p className="max-w-[900px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                See how VestBlock has helped thousands of people improve their credit scores and financial health.
              </p>
            </div>
          </div>
          <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-3 mt-12">
            <Card className="card-glow">
              <CardContent className="pt-6">
                <div className="flex flex-col space-y-4">
                  <div className="flex items-center space-x-4">
                    <div className="rounded-full bg-primary/10 p-1">
                      <Image
                        src="/diverse-person-portrait.png"
                        alt="User Avatar"
                        width={40}
                        height={40}
                        className="rounded-full"
                      />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Sarah Johnson</p>
                      <p className="text-xs text-muted-foreground">Credit Score: 580 → 720</p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    "VestBlock helped me remove 4 incorrect items from my credit report. My score jumped 140 points in
                    just 3 months! I was able to qualify for a mortgage with a great rate."
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card className="card-glow">
              <CardContent className="pt-6">
                <div className="flex flex-col space-y-4">
                  <div className="flex items-center space-x-4">
                    <div className="rounded-full bg-primary/10 p-1">
                      <Image
                        src="/thoughtful-man.png"
                        alt="User Avatar"
                        width={40}
                        height={40}
                        className="rounded-full"
                      />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Michael Torres</p>
                      <p className="text-xs text-muted-foreground">Credit Score: 510 → 680</p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    "The dispute letters were incredibly effective. I also followed the credit hack strategies and saw
                    my score improve by 170 points. The side hustle recommendations helped me earn extra income too."
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card className="card-glow">
              <CardContent className="pt-6">
                <div className="flex flex-col space-y-4">
                  <div className="flex items-center space-x-4">
                    <div className="rounded-full bg-primary/10 p-1">
                      <Image
                        src="/diverse-woman-portrait.png"
                        alt="User Avatar"
                        width={40}
                        height={40}
                        className="rounded-full"
                      />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Jennifer Williams</p>
                      <p className="text-xs text-muted-foreground">Credit Score: 620 → 790</p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
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
      <section className="w-full py-12 md:py-24 lg:py-32 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col items-center justify-center space-y-4 text-center">
            <div className="space-y-2">
              <h2 className="text-3xl font-bold tracking-tighter md:text-4xl">Ready to Transform Your Credit?</h2>
              <p className="max-w-[600px] text-gray-300 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                Join thousands of satisfied users who have improved their credit scores and financial health with
                VestBlock.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 min-[400px]:items-center justify-center">
              <Button
                asChild
                size="lg"
                className="bg-gradient-to-r from-cyan-500 via-purple-500 to-blue-500 text-white hover:opacity-90"
              >
                <Link href="/register">Start Your Free Analysis</Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="border-gray-500 text-gray-300">
                <Link href="/pricing">View Pricing Plans</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

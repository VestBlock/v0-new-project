import Link from "next/link"
import Image from "next/image"
import { ArrowRight, BookOpen, Calendar, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const articles = [
  {
    id: "understanding-credit-scores",
    category: "credit-basics",
    title: "Understanding Credit Scores: What They Mean and How They're Calculated",
    description:
      "Learn about the factors that impact your credit score and how lenders use this information to make decisions.",
    imageUrl: "/credit-score-chart.png",
    date: "April 25, 2025",
    readTime: "8 min read",
  },
  {
    id: "dispute-letter-templates",
    category: "credit-repair",
    title: "5 Effective Dispute Letter Templates for Common Credit Report Errors",
    description: "Use these professionally crafted templates to dispute inaccurate information on your credit report.",
    imageUrl: "/placeholder.svg?key=23etp",
    date: "April 20, 2025",
    readTime: "10 min read",
  },
  {
    id: "side-hustles-2025",
    category: "income",
    title: "Top 10 Side Hustles for 2025: Boost Your Income While Building Skills",
    description:
      "Discover flexible ways to earn extra money that fit around your existing commitments and build valuable skills.",
    imageUrl: "/cafe-laptop-work.png",
    date: "April 18, 2025",
    readTime: "12 min read",
  },
  {
    id: "paying-off-debt",
    category: "debt-management",
    title: "Debt Snowball vs. Debt Avalanche: Choosing the Right Payoff Method",
    description:
      "Compare two popular debt repayment strategies and determine which approach will work best for your situation.",
    imageUrl: "/decreasing-debt-graph.png",
    date: "April 15, 2025",
    readTime: "9 min read",
  },
  {
    id: "credit-report-errors",
    category: "credit-repair",
    title: "How to Identify Common Errors on Your Credit Report",
    description:
      "Learn how to spot mistakes on your credit report that could be artificially lowering your credit score.",
    imageUrl: "/document-review.png",
    date: "April 10, 2025",
    readTime: "7 min read",
  },
  {
    id: "building-credit-fast",
    category: "credit-building",
    title: "7 Strategies to Build Credit Quickly When Starting from Zero",
    description:
      "Accelerate your credit building journey with these proven strategies for establishing credit from scratch.",
    imageUrl: "/placeholder.svg?key=l2yuf",
    date: "April 5, 2025",
    readTime: "11 min read",
  },
]

export default function ResourcesPage() {
  return (
    <div className="container py-10">
      <div className="flex flex-col items-center text-center mb-10">
        <h1 className="text-3xl font-bold mb-2">Credit Repair Resources & Guides</h1>
        <p className="text-muted-foreground max-w-2xl">
          Explore our collection of articles, guides, and resources to help you improve your credit score and financial
          health.
        </p>
      </div>

      <Tabs defaultValue="all" className="space-y-6">
        <div className="flex justify-center">
          <TabsList>
            <TabsTrigger value="all">All Resources</TabsTrigger>
            <TabsTrigger value="credit-basics">Credit Basics</TabsTrigger>
            <TabsTrigger value="credit-repair">Credit Repair</TabsTrigger>
            <TabsTrigger value="credit-building">Credit Building</TabsTrigger>
            <TabsTrigger value="debt-management">Debt Management</TabsTrigger>
            <TabsTrigger value="income">Income Strategies</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="all" className="mt-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {articles.map((article) => (
              <ResourceCard key={article.id} article={article} />
            ))}
          </div>
        </TabsContent>

        {["credit-basics", "credit-repair", "credit-building", "debt-management", "income"].map((category) => (
          <TabsContent key={category} value={category} className="mt-6">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {articles
                .filter((article) => article.category === category)
                .map((article) => (
                  <ResourceCard key={article.id} article={article} />
                ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      <div className="mt-16 rounded-lg bg-slate-50 dark:bg-slate-900 p-8 text-center">
        <div className="mx-auto max-w-2xl">
          <BookOpen className="mx-auto h-12 w-12 text-primary mb-4" />
          <h2 className="text-2xl font-bold mb-2">Free Credit Repair eBook</h2>
          <p className="text-muted-foreground mb-6">
            Download our comprehensive guide to repairing your credit score, with step-by-step instructions and proven
            strategies.
          </p>
          <Button asChild size="lg" className="bg-gradient-to-r from-cyan-500 via-purple-500 to-blue-500">
            <Link href="#download">Download Free eBook</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}

function ResourceCard({ article }: { article: (typeof articles)[0] }) {
  return (
    <Card className="card-glow overflow-hidden flex flex-col">
      <div className="relative aspect-video overflow-hidden">
        <Image
          src={article.imageUrl || "/placeholder.svg"}
          alt={article.title}
          fill
          className="object-cover transition-transform hover:scale-105"
        />
      </div>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center mb-2">
          <div className="text-xs font-medium bg-primary/10 text-primary rounded-full px-2 py-1">
            {article.category
              .split("-")
              .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
              .join(" ")}
          </div>
          <div className="flex items-center text-xs text-muted-foreground">
            <Clock className="h-3 w-3 mr-1" />
            {article.readTime}
          </div>
        </div>
        <CardTitle className="text-lg line-clamp-2">{article.title}</CardTitle>
        <CardDescription className="flex items-center text-xs">
          <Calendar className="h-3 w-3 mr-1" />
          {article.date}
        </CardDescription>
      </CardHeader>
      <CardContent className="pb-2 flex-grow">
        <p className="text-sm text-muted-foreground line-clamp-3">{article.description}</p>
      </CardContent>
      <CardFooter>
        <Button asChild variant="ghost" size="sm" className="w-full">
          <Link href={`/resources/${article.id}`}>
            Read Article <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  )
}

"use client"

import { useState } from "react"
import Link from "next/link"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"

const faqs = [
  {
    category: "Getting Started",
    items: [
      {
        question: "How does VestBlock help me repair my credit?",
        answer:
          "VestBlock uses advanced AI technology to analyze your credit report, identify errors and negative items, generate custom dispute letters, and provide personalized recommendations to improve your credit score. Our platform automates the credit repair process, saving you time and money compared to traditional credit repair services.",
      },
      {
        question: "What do I need to get started?",
        answer:
          "To get started, you'll need to create an account and upload a copy of your credit report from any of the three major credit bureaus (Experian, Equifax, or TransUnion). Our system will then analyze your report and provide personalized recommendations and dispute letters.",
      },
      {
        question: "How do I upload my credit report?",
        answer:
          "After logging in, navigate to your dashboard and click on the 'Upload Credit Report' button. You can upload your credit report as a PDF, JPG, or PNG file. Our OCR technology will scan and extract the relevant information for analysis.",
      },
      {
        question: "Is my information secure?",
        answer:
          "Yes, we take security very seriously. All your data is encrypted using industry-standard encryption methods. We do not share your personal information with third parties without your consent. Our privacy policy outlines how we collect, use, and protect your data.",
      },
    ],
  },
  {
    category: "Credit Repair Process",
    items: [
      {
        question: "How long does the credit repair process take?",
        answer:
          "The credit repair process varies depending on your specific situation. Some users see improvements in their credit scores within 30-60 days, while more complex cases may take 3-6 months. Consistency and following our recommendations are key to success.",
      },
      {
        question: "How do dispute letters work?",
        answer:
          "Dispute letters are formal requests to credit bureaus to investigate and remove inaccurate or unverifiable information from your credit report. Our AI generates customized dispute letters based on your specific credit report issues. You can download, print, and mail these letters to the appropriate credit bureaus.",
      },
      {
        question: "Can you guarantee a specific credit score increase?",
        answer:
          "While we can't guarantee specific results as each credit situation is unique, our users typically see significant improvements in their credit scores by following our recommendations and using our dispute letters. Success depends on factors like your current credit situation, the accuracy of items on your report, and your financial behavior.",
      },
      {
        question: "What if the credit bureau rejects my dispute?",
        answer:
          "If a dispute is rejected, we provide guidance on next steps, which may include sending follow-up letters, providing additional documentation, or pursuing alternative strategies. Our AI assistant can help you understand the reasons for rejection and recommend appropriate actions.",
      },
    ],
  },
  {
    category: "Account & Billing",
    items: [
      {
        question: "What's included in the free plan?",
        answer:
          "The free plan includes a basic credit analysis, limited access to credit improvement recommendations, and the ability to view a summary of your credit report. To access full features like customized dispute letters, AI chat assistance, and unlimited analyses, you'll need to upgrade to our Pro plan.",
      },
      {
        question: "How much does the Pro plan cost?",
        answer:
          "Our Pro plan is a one-time payment of $75. This gives you lifetime access to all premium features, including unlimited credit analyses, customized dispute letters, credit improvement strategies, side hustle recommendations, and access to our AI assistant.",
      },
      {
        question: "Do you offer refunds?",
        answer:
          "Yes, we offer a 30-day money-back guarantee if you're not satisfied with our service. Simply contact our support team within 30 days of your purchase to request a refund.",
      },
      {
        question: "How do I cancel my subscription?",
        answer:
          "Since our Pro plan is a one-time payment rather than a subscription, there's no need to cancel. Once you purchase the Pro plan, you have lifetime access to all premium features without recurring charges.",
      },
    ],
  },
  {
    category: "Technical Support",
    items: [
      {
        question: "What browsers are supported?",
        answer:
          "VestBlock works best on modern browsers like Chrome, Firefox, Safari, and Edge. We recommend keeping your browser updated to the latest version for optimal performance and security.",
      },
      {
        question: "Can I use VestBlock on my mobile device?",
        answer:
          "Yes, VestBlock is fully responsive and works on mobile devices. You can upload credit reports, view analyses, and access all features from your smartphone or tablet.",
      },
      {
        question: "What if I encounter technical issues?",
        answer:
          "If you experience technical issues, please contact our support team through the contact form on our website or by emailing support@vestblock.io. Please include details about the issue, including any error messages and steps to reproduce the problem.",
      },
      {
        question: "Is there a limit to how many credit reports I can analyze?",
        answer:
          "Free users can analyze one credit report. Pro users have unlimited access to credit report analyses, allowing you to upload reports from different bureaus or track your progress over time with updated reports.",
      },
    ],
  },
]

export default function FAQPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [expandedCategories, setExpandedCategories] = useState<string[]>([])

  // Filter FAQs based on search query
  const filteredFaqs = faqs
    .map((category) => ({
      ...category,
      items: category.items.filter(
        (item) =>
          item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.answer.toLowerCase().includes(searchQuery.toLowerCase()),
      ),
    }))
    .filter((category) => category.items.length > 0)

  // Toggle category expansion
  const toggleCategory = (category: string) => {
    if (expandedCategories.includes(category)) {
      setExpandedCategories(expandedCategories.filter((c) => c !== category))
    } else {
      setExpandedCategories([...expandedCategories, category])
    }
  }

  return (
    <div className="container py-10">
      <div className="flex flex-col items-center text-center mb-10">
        <h1 className="text-3xl font-bold mb-2">Frequently Asked Questions</h1>
        <p className="text-muted-foreground max-w-2xl mb-6">
          Find answers to common questions about VestBlock and credit repair. If you can't find what you're looking for,
          feel free to contact us.
        </p>
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search FAQs..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {filteredFaqs.length === 0 ? (
        <Card className="text-center">
          <CardContent className="pt-6">
            <p className="mb-4">No FAQs found matching "{searchQuery}"</p>
            <Button variant="outline" onClick={() => setSearchQuery("")}>
              Clear Search
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {filteredFaqs.map((category) => (
            <Card key={category.category} className="card-glow">
              <CardHeader className="cursor-pointer" onClick={() => toggleCategory(category.category)}>
                <CardTitle>{category.category}</CardTitle>
                <CardDescription>
                  {category.items.length} question{category.items.length !== 1 ? "s" : ""}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="w-full">
                  {category.items.map((item, index) => (
                    <AccordionItem key={index} value={`item-${index}`}>
                      <AccordionTrigger className="text-left">{item.question}</AccordionTrigger>
                      <AccordionContent>
                        <p className="text-muted-foreground">{item.answer}</p>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="mt-12 text-center">
        <h2 className="text-2xl font-bold mb-4">Still have questions?</h2>
        <p className="text-muted-foreground mb-6">
          If you couldn't find the answer to your question, feel free to contact our support team.
        </p>
        <Button asChild size="lg">
          <Link href="/contact">Contact Us</Link>
        </Button>
      </div>
    </div>
  )
}

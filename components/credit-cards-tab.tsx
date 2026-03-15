import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CreditCard, Star, ExternalLink, ShieldCheck } from "lucide-react"

interface CreditCardRecommendation {
  name: string
  description: string
  bestFor: string
  minimumCredit: string
  features?: string[]
  annualFee?: string
  category?: string
  link?: string
  featured?: boolean
}

interface CreditCardProps {
  creditScore?: number | null
  recommendedCards?: CreditCardRecommendation[]
}

export function CreditCardsTab({ creditScore, recommendedCards }: CreditCardProps) {
  const defaultCreditCards: CreditCardRecommendation[] = [
    {
      name: "Kikoff Credit Builder",
      description:
        "Build credit history with as little as $10/month. No credit check required. Reports to all 3 major credit bureaus.",
      features: ["No credit check", "Reports to all 3 bureaus", "$10/month", "Builds payment history"],
      minimumCredit: "No Credit Check",
      annualFee: "$0",
      category: "Credit Builder",
      link: "https://kikoff.com",
      featured: true,
      bestFor: "Building Credit",
    },
    {
      name: "Discover it® Secured",
      description: "Earn 2% cash back at gas stations and restaurants. No annual fee. Reports to all 3 bureaus.",
      features: ["Cash back rewards", "No annual fee", "Path to upgrade", "Security deposit required"],
      minimumCredit: "350+",
      annualFee: "$0",
      category: "Secured",
      link: "https://www.discover.com/credit-cards/secured/",
      bestFor: "Cash Back & Building",
    },
    {
      name: "Capital One Platinum Secured",
      description: "Start with a low security deposit. Get considered for higher credit line in as little as 6 months.",
      features: ["Low deposit options", "No annual fee", "Credit line increases", "Mobile app access"],
      minimumCredit: "300+",
      annualFee: "$0",
      category: "Secured",
      link: "https://www.capitalone.com/credit-cards/platinum-secured/",
      bestFor: "Low Deposit",
    },
    {
      name: "OpenSky® Secured Visa®",
      description: "No credit check necessary. Choose your own credit line with security deposit.",
      features: ["No credit check", "Choose your credit line", "Reports to all bureaus", "Financial education"],
      minimumCredit: "No Credit Check",
      annualFee: "$35",
      category: "Secured",
      link: "https://www.openskycc.com/",
      bestFor: "No Credit Check Option",
    },
    {
      name: "Petal® 2 Visa®",
      description:
        "No fees whatsoever. 1% to 1.5% cash back on all purchases. Uses banking history instead of credit score for approval.",
      features: ["No fees", "Cash back rewards", "Credit limit up to $10,000", "Mobile app"],
      minimumCredit: "550+ or Banking History",
      annualFee: "$0",
      category: "Unsecured",
      link: "https://www.petalcard.com/",
      bestFor: "Fair Credit/Alt Approval",
    },
    {
      name: "Chase Freedom Rise℠",
      description: "Designed for students and those new to credit. Earn cash back on purchases. No annual fee.",
      features: ["Good for students", "Cash back rewards", "Build credit history", "No annual fee"],
      minimumCredit: "Limited/No History",
      annualFee: "$0",
      category: "Student/Beginner",
      link: "https://creditcards.chase.com/cash-back-credit-cards/freedom/rise",
      bestFor: "New to Credit",
    },
    {
      name: "Capital One QuicksilverOne Cash Rewards",
      description:
        "Unlimited 1.5% cash back on every purchase. Designed for those with fair credit. Annual fee applies.",
      features: ["1.5% cash back", "For fair credit", "Credit line increase opportunities"],
      minimumCredit: "580-669 (Fair)",
      annualFee: "$39",
      category: "Cash Back",
      link: "https://www.capitalone.com/credit-cards/quicksilverone/",
      bestFor: "Fair Credit Cash Back",
    },
    {
      name: "AvantCard Credit Card",
      description: "Unsecured card for those rebuilding credit. Transparent terms and mobile app access.",
      features: ["Unsecured option", "Reports to 3 bureaus", "Mobile app", "Potentially high APR"],
      minimumCredit: "580+",
      annualFee: "$39-$59 (Varies)",
      category: "Rebuilding Credit",
      link: "https://www.avant.com/credit-card",
      bestFor: "Rebuilding Unsecured",
    },
  ]

  let cardsToDisplay: CreditCardRecommendation[] = []

  if (recommendedCards && recommendedCards.length > 0) {
    cardsToDisplay = recommendedCards.map((rc) => ({
      name: rc.name || "Unnamed Card",
      description: rc.description || "No description available.",
      bestFor: rc.bestFor || "General Use",
      minimumCredit: rc.minimumCredit || "Varies",
      features:
        rc.features || (rc.description ? [rc.description.substring(0, 70) + "..."] : ["Key feature not specified"]),
      annualFee: rc.annualFee || "$0",
      category: rc.category || "General",
      link: rc.link || "#",
      featured: rc.featured || rc.name?.toLowerCase().includes("kikoff"),
    }))
  } else if (creditScore !== undefined && creditScore !== null) {
    cardsToDisplay = defaultCreditCards.filter((card) => {
      if (card.minimumCredit === "No Credit Check" || card.minimumCredit === "Limited/No History") return true
      const scoreMatch = card.minimumCredit.match(/\d+/)
      if (scoreMatch) {
        return Number.parseInt(scoreMatch[0]) <= creditScore
      }
      return true // Default to show if parsing fails, can be refined
    })
    // Ensure at least 5 cards are shown if possible, or all defaults if filtered list is too small
    if (cardsToDisplay.length < 5 && defaultCreditCards.length >= 5) {
      cardsToDisplay = defaultCreditCards.slice(0, Math.max(5, defaultCreditCards.length)) // Show at least 5, or all if less than 5 defaults
    } else if (cardsToDisplay.length === 0) {
      cardsToDisplay = defaultCreditCards // Fallback to all defaults if filtering results in none
    }
  } else {
    cardsToDisplay = defaultCreditCards // Show all defaults if no score and no specific recommendations
  }

  // Ensure we don't exceed 10 cards unless specifically provided more
  if (!recommendedCards || recommendedCards.length === 0) {
    cardsToDisplay = cardsToDisplay.slice(0, 10)
  }

  const sortedCards = [...cardsToDisplay].sort((a, b) => {
    if (a.featured && !b.featured) return -1
    if (!a.featured && b.featured) return 1
    const scoreA =
      a.minimumCredit === "No Credit Check" || a.minimumCredit === "Limited/No History"
        ? 0
        : Number.parseInt(a.minimumCredit.match(/\d+/)?.[0] || "999")
    const scoreB =
      b.minimumCredit === "No Credit Check" || b.minimumCredit === "Limited/No History"
        ? 0
        : Number.parseInt(b.minimumCredit.match(/\d+/)?.[0] || "999")
    return scoreA - scoreB
  })

  return (
    <div className="space-y-8">
      <div className="bg-card/50 p-6 rounded-lg border border-cyan-400/20 backdrop-blur-sm">
        <h3 className="text-2xl font-bold gradient-text mb-3">Credit Card Recommendations</h3>
        <p className="text-base text-muted-foreground leading-relaxed">
          The right credit card can help you build credit history, earn rewards, and improve your financial situation.
          {creditScore
            ? ` Based on your credit score of ${creditScore}, here are cards you may qualify for.`
            : recommendedCards && recommendedCards.length > 0
              ? " Here are some card recommendations based on your goal."
              : " Here are cards that can help you build or improve your credit."}
        </p>
      </div>

      {sortedCards.length === 0 && (
        <p className="text-muted-foreground text-center py-8">
          No specific card recommendations available at this time. Consider general purpose secured cards to build
          credit.
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {sortedCards.map((card, index) => (
          <Card
            key={index}
            className={`bg-card/60 backdrop-blur-sm border-primary/20 hover:border-cyan-400/60 transition-all duration-300 hover:shadow-2xl hover:shadow-cyan-500/10 flex flex-col ${
              card.featured ? "border-cyan-400/80 shadow-lg shadow-cyan-500/10" : ""
            }`}
          >
            <CardHeader className="pb-4">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="gradient-text font-bold flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-cyan-400" />
                    {card.name}
                  </CardTitle>
                  <CardDescription className="mt-1 text-cyan-100/70">{card.category}</CardDescription>
                </div>
                {card.featured && <Badge className="bg-cyan-500 text-background font-semibold">Featured</Badge>}
              </div>
            </CardHeader>
            <CardContent className="flex-grow">
              <p className="text-sm mb-4 text-muted-foreground">{card.description}</p>

              {card.features && card.features.length > 0 && (
                <div className="space-y-2 mb-4">
                  {card.features.map((feature, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Star className="h-4 w-4 text-yellow-400/80" />
                      <p className="text-sm text-foreground/90">{feature}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 text-sm pt-4 border-t border-white/10">
                <div>
                  <p className="text-xs text-muted-foreground">Annual Fee</p>
                  <p className="font-medium text-lg text-foreground">{card.annualFee}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Min. Credit</p>
                  <p className="font-medium text-lg text-foreground">{card.minimumCredit}</p>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button
                asChild
                variant="outline"
                className="w-full bg-transparent border-cyan-400/50 text-cyan-300 hover:bg-cyan-400/10 hover:text-cyan-200 transition-colors"
              >
                <a href={card.link || "#"} target="_blank" rel="noopener noreferrer">
                  Learn More
                  <ExternalLink className="h-4 w-4 ml-2" />
                </a>
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      <div className="p-4 bg-muted/50 rounded-lg border border-white/10 flex items-center gap-3">
        <ShieldCheck className="h-5 w-5 text-cyan-400" />
        <p className="text-sm text-muted-foreground">
          <strong>Note:</strong> Card approval depends on your complete credit profile and the issuer's current
          criteria. Pre-qualification is recommended where available to avoid hard inquiries.
        </p>
      </div>
    </div>
  )
}

export default CreditCardsTab

import { CardFooter } from "@/components/ui/card"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Briefcase, ExternalLink, DollarSign, Clock, BarChart, Zap, Users, Palette } from "lucide-react"

interface SideHustleRecommendation {
  name: string
  description: string
  potentialEarnings: string
  timeCommitment: string
  difficulty: "easy" | "medium" | "hard" | string
  category?: string
  startupCost?: string
  skills?: string[]
  platforms?: Array<{ name: string; url: string }>
}

interface SideHustleProps {
  income?: number
  goals?: string
  recommendedHustles?: SideHustleRecommendation[]
}

export function SideHustlesTab({ income, goals, recommendedHustles }: SideHustleProps) {
  const defaultSideHustles: SideHustleRecommendation[] = [
    {
      name: "Virtual Assistant Services",
      description:
        "Provide administrative, technical, or creative assistance to clients remotely. Tasks include email management, scheduling, social media, and customer service.",
      potentialEarnings: "$15-50/hour",
      timeCommitment: "10-30 hours/week",
      difficulty: "Medium",
      startupCost: "Low ($0-$100)",
      skills: ["Organization", "Communication", "Tech Savvy", "Time Management"],
      platforms: [
        { name: "Upwork", url: "https://www.upwork.com" },
        { name: "Fiverr", url: "https://www.fiverr.com" },
        { name: "Belay", url: "https://belaysolutions.com/" },
      ],
      category: "Remote Admin",
    },
    {
      name: "Freelance Content Writing",
      description:
        "Create blog posts, articles, website copy, and marketing materials for businesses. Specialize in a niche for higher rates.",
      potentialEarnings: "$50-500+/article",
      timeCommitment: "Flexible",
      difficulty: "Medium",
      startupCost: "None",
      skills: ["Writing", "Research", "SEO Basics", "Grammar"],
      platforms: [
        { name: "Contently", url: "https://contently.com" },
        { name: "ProBlogger Jobs", url: "https://problogger.com/jobs" },
        { name: "ClearVoice", url: "https://www.clearvoice.com/" },
      ],
      category: "Creative/Writing",
    },
    {
      name: "Online Tutoring / Teaching",
      description:
        "Teach students K-12, college, or adults in subjects you're proficient in. ESL teaching is also popular.",
      potentialEarnings: "$15-60/hour",
      timeCommitment: "5-20 hours/week",
      difficulty: "Medium",
      startupCost: "Low (Good internet & webcam)",
      skills: ["Subject Matter Expert", "Patience", "Communication"],
      platforms: [
        { name: "VIPKid", url: "https://www.vipkid.com/" },
        { name: "TutorMe", url: "https://tutorme.com/" },
        { name: "Outschool", url: "https://outschool.com/" },
      ],
      category: "Education",
    },
    {
      name: "Graphic Design Services",
      description: "Create logos, branding materials, social media graphics, and website designs for clients.",
      potentialEarnings: "$25-100+/hour",
      timeCommitment: "Project-based",
      difficulty: "Medium-Hard",
      startupCost: "Medium (Software like Adobe CC)",
      skills: ["Design Software", "Creativity", "Visual Communication"],
      platforms: [
        { name: "99designs", url: "https://99designs.com/" },
        { name: "Dribbble Hiring", url: "https://dribbble.com/hiring" },
        { name: "DesignCrowd", url: "https://www.designcrowd.com/" },
      ],
      category: "Creative/Design",
    },
    {
      name: "Social Media Management",
      description:
        "Manage social media accounts for small businesses, including content creation, scheduling, and engagement.",
      potentialEarnings: "$200-2000+/month per client",
      timeCommitment: "10-20 hours/week",
      difficulty: "Medium",
      startupCost: "Low (Scheduling tools optional)",
      skills: ["Social Media Platforms", "Content Creation", "Analytics"],
      platforms: [
        { name: "LinkedIn ProFinder", url: "https://www.linkedin.com/profinder" },
        { name: "Facebook Groups", url: "#" }, // General search
      ],
      category: "Marketing",
    },
    {
      name: "Delivery Driver (Food/Groceries)",
      description: "Deliver food, groceries, or packages using your own vehicle. Flexible hours.",
      potentialEarnings: "$15-25/hour (before expenses)",
      timeCommitment: "Flexible",
      difficulty: "Easy",
      startupCost: "Low (Vehicle, smartphone)",
      skills: ["Driving", "Navigation", "Customer Service"],
      platforms: [
        { name: "DoorDash", url: "https://dasher.doordash.com/" },
        { name: "Uber Eats", url: "https://www.uber.com/us/en/drive/delivery/" },
        { name: "Instacart", url: "https://shoppers.instacart.com/" },
      ],
      category: "Gig Economy",
    },
    {
      name: "Pet Sitting / Dog Walking",
      description: "Care for pets while their owners are away or walk dogs for busy professionals.",
      potentialEarnings: "$20-50/visit or $15-30/walk",
      timeCommitment: "Flexible",
      difficulty: "Easy-Medium",
      startupCost: "Very Low",
      skills: ["Animal Lover", "Reliability", "Responsibility"],
      platforms: [
        { name: "Rover", url: "https://www.rover.com/" },
        { name: "Wag!", url: "https://wagwalking.com/" },
      ],
      category: "Services",
    },
    {
      name: "Notary Public Services",
      description:
        "Become a certified notary and offer document notarization services. Can be especially lucrative as a mobile notary for real estate closings.",
      potentialEarnings: "$75-200/signing (Mobile)",
      timeCommitment: "Part-time/By appointment",
      difficulty: "Low",
      startupCost: "Medium ($100-500 for certification/supplies)",
      skills: ["Attention to detail", "Reliability", "Basic legal understanding"],
      platforms: [
        { name: "National Notary Association", url: "https://www.nationalnotary.org/" },
        { name: "Snapdocs", url: "https://www.snapdocs.com" },
      ],
      category: "Professional Services",
    },
  ]

  let hustlesToDisplay: SideHustleRecommendation[] = []

  if (recommendedHustles && recommendedHustles.length > 0) {
    hustlesToDisplay = recommendedHustles.map((rh) => ({
      name: rh.name || "Unnamed Hustle",
      description: rh.description || "No description available.",
      potentialEarnings: rh.potentialEarnings || "Varies",
      timeCommitment: rh.timeCommitment || "Flexible",
      difficulty: rh.difficulty || "medium",
      category: rh.category || "General",
      startupCost: rh.startupCost || "Low",
      skills: rh.skills || (rh.description ? [rh.description.substring(0, 50) + "..."] : ["General skills"]),
      platforms: rh.platforms || [{ name: "Online Search", url: "https://google.com" }],
    }))
  } else {
    // If no specific recommendations, show all default hustles (up to 10)
    hustlesToDisplay = defaultSideHustles.slice(0, 10)
  }

  // Ensure we don't exceed 10 hustles unless specifically provided more
  if (!recommendedHustles || recommendedHustles.length === 0) {
    hustlesToDisplay = hustlesToDisplay.slice(0, 10)
  }

  const getDifficultyClass = (difficulty: string) => {
    switch (difficulty?.toLowerCase()) {
      case "low":
      case "easy":
        return "text-green-400"
      case "medium":
        return "text-yellow-400"
      case "medium-high":
      case "hard":
        return "text-red-400"
      default:
        return "text-muted-foreground"
    }
  }

  const getDifficultyGlow = (difficulty: string) => {
    switch (difficulty?.toLowerCase()) {
      case "low":
      case "easy":
        return "bg-green-500 shadow-[0_0_6px_#22c55e]"
      case "medium":
        return "bg-yellow-500 shadow-[0_0_6px_#eab308]"
      case "medium-high":
      case "hard":
        return "bg-red-500 shadow-[0_0_6px_#ef4444]"
      default:
        return "bg-gray-500"
    }
  }

  const getCategoryIcon = (category?: string) => {
    switch (category?.toLowerCase()) {
      case "remote admin":
        return <Users className="h-4 w-4 text-purple-400/80" />
      case "creative/writing":
        return <Palette className="h-4 w-4 text-purple-400/80" /> // Using Palette for creative
      case "education":
        return <Briefcase className="h-4 w-4 text-purple-400/80" /> // Re-using briefcase, consider specific icon
      case "creative/design":
        return <Palette className="h-4 w-4 text-purple-400/80" />
      case "marketing":
        return <Users className="h-4 w-4 text-purple-400/80" /> // Re-using Users, consider specific icon
      case "gig economy":
        return <Zap className="h-4 w-4 text-purple-400/80" />
      case "services":
        return <Briefcase className="h-4 w-4 text-purple-400/80" />
      case "professional services":
        return <Briefcase className="h-4 w-4 text-purple-400/80" />
      default:
        return <Briefcase className="h-4 w-4 text-purple-400/80" />
    }
  }

  return (
    <div className="space-y-8">
      <div className="bg-card/50 p-6 rounded-lg border border-purple-400/20 backdrop-blur-sm">
        <h3 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-500 mb-3">
          Side Hustle Opportunities
        </h3>
        <p className="text-base text-muted-foreground leading-relaxed">
          Explore these AI-curated side hustles to increase your income and accelerate your financial goals.
          {goals && ` These are tailored to help you achieve your goal of "${goals}".`}
        </p>
      </div>

      {hustlesToDisplay.length === 0 && (
        <p className="text-muted-foreground text-center py-8">
          No specific side hustle recommendations available at this time. Consider leveraging your existing skills for
          freelance work.
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {hustlesToDisplay.map((hustle, index) => (
          <Card
            key={index}
            className="bg-card/60 backdrop-blur-sm border-primary/20 hover:border-purple-400/60 transition-all duration-300 hover:shadow-2xl hover:shadow-purple-500/10 flex flex-col"
          >
            <CardHeader className="pb-4">
              <div className="flex justify-between items-start">
                <CardTitle className="gradient-text font-bold flex items-center gap-2">
                  {getCategoryIcon(hustle.category)}
                  {hustle.name}
                </CardTitle>
                {hustle.category && (
                  <Badge variant="outline" className="border-purple-400/50 text-purple-300">
                    {hustle.category}
                  </Badge>
                )}
              </div>
              <CardDescription className="mt-2 text-muted-foreground">{hustle.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow">
              <div className="grid grid-cols-2 gap-4 mb-4 py-4 border-y border-white/10">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-green-400 drop-shadow-[0_0_4px_rgba(52,211,153,0.6)]" />
                  <div>
                    <p className="text-xs text-muted-foreground">Earnings</p>
                    <p className="font-medium text-foreground">{hustle.potentialEarnings}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-blue-400 drop-shadow-[0_0_4px_rgba(96,165,250,0.6)]" />
                  <div>
                    <p className="text-xs text-muted-foreground">Time</p>
                    <p className="font-medium text-foreground">{hustle.timeCommitment}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <BarChart className="h-5 w-5 text-purple-400 drop-shadow-[0_0_4px_rgba(192,132,252,0.6)]" />
                  <div>
                    <p className="text-xs text-muted-foreground">Difficulty</p>
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${getDifficultyGlow(hustle.difficulty)}`}></div>
                      <p className={`font-medium text-sm ${getDifficultyClass(hustle.difficulty)}`}>
                        {hustle.difficulty.charAt(0).toUpperCase() + hustle.difficulty.slice(1)}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-orange-400 drop-shadow-[0_0_4px_rgba(251,146,60,0.6)]" />
                  <div>
                    <p className="text-xs text-muted-foreground">Startup Cost</p>
                    <p className="font-medium text-foreground">{hustle.startupCost}</p>
                  </div>
                </div>
              </div>

              {hustle.skills && hustle.skills.length > 0 && (
                <div className="space-y-2 mb-4">
                  <p className="text-xs font-medium text-muted-foreground">Required Skills:</p>
                  <div className="flex flex-wrap gap-2">
                    {hustle.skills.map((skill, idx) => (
                      <Badge key={idx} variant="secondary" className="bg-primary/10 text-primary-foreground/80">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
            {hustle.platforms && hustle.platforms.length > 0 && (
              <CardFooter className="flex-col items-start gap-2 pt-4 border-t border-white/10">
                <p className="text-xs font-medium text-muted-foreground">Popular Platforms:</p>
                <div className="flex flex-wrap gap-2">
                  {hustle.platforms.map((platform, idx) => (
                    <Button
                      key={idx}
                      asChild
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs bg-transparent border-purple-400/50 text-purple-300 hover:bg-purple-400/10 hover:text-purple-200 transition-colors"
                    >
                      <a href={platform.url} target="_blank" rel="noopener noreferrer">
                        {platform.name}
                        <ExternalLink className="h-3 w-3 ml-1.5" />
                      </a>
                    </Button>
                  ))}
                </div>
              </CardFooter>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}

export default SideHustlesTab

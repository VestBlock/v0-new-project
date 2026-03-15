"use client"

import type React from "react"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Home,
  Car,
  GraduationCap,
  CreditCard,
  Building,
  TrendingUp,
  Target,
  DollarSign,
  Briefcase,
  Store,
  Laptop,
  Utensils,
  Stethoscope,
  HardHat,
  Users,
  PiggyBank,
  Shield,
} from "lucide-react"

export interface FinancialGoal {
  id: string
  title: string
  description: string
  icon: React.ReactNode
  customDetails?: string
}

export const predefinedGoals: FinancialGoal[] = [
  // Personal Goals
  {
    id: "buy-home",
    title: "Buy a Home",
    description: "Purchase your first home or upgrade to a better one",
    icon: <Home className="w-6 h-6" />,
  },
  {
    id: "buy-car",
    title: "Buy a Car",
    description: "Finance a new or used vehicle with the best rates",
    icon: <Car className="w-6 h-6" />,
  },
  {
    id: "education-funding",
    title: "Education Funding",
    description: "Pay for college, graduate school, or professional training",
    icon: <GraduationCap className="w-6 h-6" />,
  },
  {
    id: "debt-consolidation",
    title: "Debt Consolidation",
    description: "Consolidate high-interest debt into lower-rate loans",
    icon: <CreditCard className="w-6 h-6" />,
  },
  {
    id: "emergency-fund",
    title: "Emergency Fund",
    description: "Build a safety net for unexpected expenses",
    icon: <Shield className="w-6 h-6" />,
  },
  {
    id: "retirement-planning",
    title: "Retirement Planning",
    description: "Save and invest for a comfortable retirement",
    icon: <PiggyBank className="w-6 h-6" />,
  },

  // Business Goals
  {
    id: "start-business",
    title: "Start a Business",
    description: "Launch your own business or side hustle",
    icon: <Briefcase className="w-6 h-6" />,
  },
  {
    id: "expand-business",
    title: "Expand Business",
    description: "Grow your existing business operations",
    icon: <TrendingUp className="w-6 h-6" />,
  },
  {
    id: "franchise-business",
    title: "Buy a Franchise",
    description: "Purchase and operate a franchise business",
    icon: <Store className="w-6 h-6" />,
  },
  {
    id: "ecommerce-business",
    title: "E-commerce Business",
    description: "Start an online retail or dropshipping business",
    icon: <Laptop className="w-6 h-6" />,
  },
  {
    id: "tech-startup",
    title: "Tech Startup",
    description: "Launch a technology or software company",
    icon: <Laptop className="w-6 h-6" />,
  },
  {
    id: "restaurant-business",
    title: "Restaurant Business",
    description: "Open a restaurant, cafe, or food service business",
    icon: <Utensils className="w-6 h-6" />,
  },
  {
    id: "medical-practice",
    title: "Medical Practice",
    description: "Start or expand a medical or dental practice",
    icon: <Stethoscope className="w-6 h-6" />,
  },
  {
    id: "construction-business",
    title: "Construction Business",
    description: "Start a construction, contracting, or trades business",
    icon: <HardHat className="w-6 h-6" />,
  },
  {
    id: "consulting-firm",
    title: "Consulting Firm",
    description: "Launch a professional consulting or services firm",
    icon: <Users className="w-6 h-6" />,
  },

  // Investment Goals
  {
    id: "investment-property",
    title: "Investment Property",
    description: "Purchase rental or investment real estate",
    icon: <Building className="w-6 h-6" />,
  },
  {
    id: "fix-and-flip",
    title: "Fix & Flip Properties",
    description: "Buy, renovate, and sell properties for profit",
    icon: <Home className="w-6 h-6" />,
  },
  {
    id: "stock-portfolio",
    title: "Stock Portfolio",
    description: "Build a diversified investment portfolio",
    icon: <TrendingUp className="w-6 h-6" />,
  },
  {
    id: "cryptocurrency",
    title: "Cryptocurrency Investment",
    description: "Invest in Bitcoin, Ethereum, and other cryptocurrencies",
    icon: <DollarSign className="w-6 h-6" />,
  },

  // Custom Goal
  {
    id: "other",
    title: "Other Goal",
    description: "Describe your specific financial objective",
    icon: <Target className="w-6 h-6" />,
  },
]

interface FinancialGoalsSelectorProps {
  onGoalSelected: (goal: FinancialGoal) => void
  selectedGoal?: FinancialGoal | null
}

export function FinancialGoalsSelector({ onGoalSelected, selectedGoal }: FinancialGoalsSelectorProps) {
  const [showCustomForm, setShowCustomForm] = useState(false)
  const [customGoal, setCustomGoal] = useState({
    title: "",
    description: "",
  })
  const [selectedCategory, setSelectedCategory] = useState<string>("all")

  const categories = [
    { id: "all", label: "All Goals" },
    { id: "personal", label: "Personal" },
    { id: "business", label: "Business" },
    { id: "investment", label: "Investment" },
  ]

  const getGoalsByCategory = (category: string) => {
    if (category === "all") return predefinedGoals

    const categoryMap: { [key: string]: string[] } = {
      personal: [
        "buy-home",
        "buy-car",
        "education-funding",
        "debt-consolidation",
        "emergency-fund",
        "retirement-planning",
      ],
      business: [
        "start-business",
        "expand-business",
        "franchise-business",
        "ecommerce-business",
        "tech-startup",
        "restaurant-business",
        "medical-practice",
        "construction-business",
        "consulting-firm",
      ],
      investment: ["investment-property", "fix-and-flip", "stock-portfolio", "cryptocurrency"],
    }

    return predefinedGoals.filter((goal) => categoryMap[category]?.includes(goal.id) || goal.id === "other")
  }

  const handleGoalSelect = (goal: FinancialGoal) => {
    if (goal.id === "other") {
      setShowCustomForm(true)
    } else {
      setShowCustomForm(false)
      onGoalSelected(goal)
    }
  }

  const handleCustomGoalSubmit = () => {
    if (customGoal.title.trim()) {
      const customFinancialGoal: FinancialGoal = {
        id: "other",
        title: customGoal.title,
        description: customGoal.description || "Custom financial goal",
        icon: <Target className="w-6 h-6" />,
        customDetails: customGoal.description,
      }
      onGoalSelected(customFinancialGoal)
      setShowCustomForm(false)
    }
  }

  const filteredGoals = getGoalsByCategory(selectedCategory)

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">What's your primary financial goal?</h3>

        {/* Category Filter */}
        <div className="flex flex-wrap gap-2 mb-6">
          {categories.map((category) => (
            <Button
              key={category.id}
              variant={selectedCategory === category.id ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(category.id)}
            >
              {category.label}
            </Button>
          ))}
        </div>

        {/* Goals Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredGoals.map((goal) => (
            <Card
              key={goal.id}
              className={`cursor-pointer transition-all hover:shadow-md ${
                selectedGoal?.id === goal.id ? "ring-2 ring-cyan-500 bg-cyan-50/50" : ""
              }`}
              onClick={() => handleGoalSelect(goal)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="text-cyan-500 mt-1">{goal.icon}</div>
                  <div className="flex-1">
                    <h4 className="font-medium text-sm">{goal.title}</h4>
                    <p className="text-xs text-muted-foreground mt-1">{goal.description}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Custom Goal Form */}
      {showCustomForm && (
        <Card className="border-cyan-200">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="w-5 h-5 text-cyan-500" />
              Describe Your Custom Goal
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="customTitle">Goal Title</Label>
              <Input
                id="customTitle"
                placeholder="e.g., Start a food truck business"
                value={customGoal.title}
                onChange={(e) => setCustomGoal({ ...customGoal, title: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="customDescription">Goal Description</Label>
              <Textarea
                id="customDescription"
                placeholder="Describe your financial goal in detail..."
                value={customGoal.description}
                onChange={(e) => setCustomGoal({ ...customGoal, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCustomGoalSubmit} disabled={!customGoal.title.trim()}>
                Save Custom Goal
              </Button>
              <Button variant="outline" onClick={() => setShowCustomForm(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Selected Goal Display */}
      {selectedGoal && !showCustomForm && (
        <Card className="border-green-200 bg-green-50/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="text-green-600">{selectedGoal.icon}</div>
              <div>
                <h4 className="font-medium text-green-800">Selected Goal: {selectedGoal.title}</h4>
                <p className="text-sm text-green-700">{selectedGoal.description}</p>
                {selectedGoal.customDetails && (
                  <p className="text-xs text-green-600 mt-1">Details: {selectedGoal.customDetails}</p>
                )}
              </div>
              <Badge variant="secondary" className="ml-auto">
                Selected
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

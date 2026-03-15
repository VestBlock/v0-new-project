"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ChevronDown, ChevronRight, CheckCircle, Circle, MessageCircle, Star, Clock, Target } from "lucide-react"

interface RoadmapStep {
  id: string
  title: string
  description: string
  priority: "high" | "medium" | "low"
  category: string
  completed: boolean
  estimatedTime: string
  actionItems: string[]
  expectedOutcome: string
}

interface InteractiveRoadmapProps {
  roadmapSteps?: RoadmapStep[]
  onAskAboutStep?: (step: RoadmapStep) => void
}

const defaultSteps: RoadmapStep[] = [
  {
    id: "1",
    title: "Review Credit Reports",
    description: "Obtain and thoroughly review your credit reports from all three major bureaus",
    priority: "high",
    category: "Credit Analysis",
    completed: false,
    estimatedTime: "1-2 hours",
    actionItems: [
      "Request free credit reports from annualcreditreport.com",
      "Review each report for errors and discrepancies",
      "Document any inaccurate information",
      "Note accounts that need attention",
    ],
    expectedOutcome:
      "Complete understanding of your current credit profile and identification of improvement opportunities",
  },
  {
    id: "2",
    title: "Dispute Inaccurate Information",
    description: "File disputes for any errors found on your credit reports",
    priority: "high",
    category: "Credit Repair",
    completed: false,
    estimatedTime: "2-3 hours",
    actionItems: [
      "Gather supporting documentation",
      "Draft dispute letters for each error",
      "Submit disputes to credit bureaus",
      "Track dispute progress and responses",
    ],
    expectedOutcome: "Removal of inaccurate negative items and potential score improvement of 20-100 points",
  },
  {
    id: "3",
    title: "Pay Down High Balances",
    description: "Reduce credit card balances to improve utilization ratio",
    priority: "high",
    category: "Debt Management",
    completed: false,
    estimatedTime: "Ongoing",
    actionItems: [
      "List all credit card balances and limits",
      "Calculate current utilization ratios",
      "Prioritize highest utilization cards",
      "Create payment plan to reduce balances",
    ],
    expectedOutcome: "Lower credit utilization below 30% (ideally under 10%) for significant score boost",
  },
  {
    id: "4",
    title: "Set Up Payment Reminders",
    description: "Ensure all future payments are made on time",
    priority: "medium",
    category: "Payment Management",
    completed: false,
    estimatedTime: "30 minutes",
    actionItems: [
      "Set up automatic payments for minimum amounts",
      "Create calendar reminders for payment due dates",
      "Consider using payment apps or bank alerts",
      "Review payment history monthly",
    ],
    expectedOutcome: "Perfect payment history moving forward, preventing future score damage",
  },
  {
    id: "5",
    title: "Consider Authorized User Status",
    description: "Become an authorized user on a family member's account with good history",
    priority: "medium",
    category: "Credit Building",
    completed: false,
    estimatedTime: "1 hour",
    actionItems: [
      "Identify family members with excellent credit",
      "Discuss authorized user arrangement",
      "Ensure the account reports to credit bureaus",
      "Monitor impact on your credit score",
    ],
    expectedOutcome: "Potential score increase from inherited positive payment history and lower overall utilization",
  },
  {
    id: "6",
    title: "Apply for Credit Builder Products",
    description: "Consider secured cards or credit builder loans to establish positive history",
    priority: "low",
    category: "Credit Building",
    completed: false,
    estimatedTime: "2 hours",
    actionItems: [
      "Research secured credit card options",
      "Compare credit builder loan programs",
      "Apply for appropriate products",
      "Use new credit responsibly",
    ],
    expectedOutcome: "Additional positive payment history and improved credit mix",
  },
]

export function InteractiveRoadmap({ roadmapSteps, onAskAboutStep }: InteractiveRoadmapProps) {
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set())
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set())

  // Use provided steps or fall back to default steps
  const steps = roadmapSteps && roadmapSteps.length > 0 ? roadmapSteps : defaultSteps

  const toggleStep = (stepId: string) => {
    const newExpanded = new Set(expandedSteps)
    if (newExpanded.has(stepId)) {
      newExpanded.delete(stepId)
    } else {
      newExpanded.add(stepId)
    }
    setExpandedSteps(newExpanded)
  }

  const toggleCompletion = (stepId: string) => {
    const newCompleted = new Set(completedSteps)
    if (newCompleted.has(stepId)) {
      newCompleted.delete(stepId)
    } else {
      newCompleted.add(stepId)
    }
    setCompletedSteps(newCompleted)
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-100 text-red-800 border-red-200"
      case "medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "low":
        return "bg-green-100 text-green-800 border-green-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const completionPercentage = (completedSteps.size / steps.length) * 100

  if (!steps || steps.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Credit Improvement Roadmap
          </CardTitle>
          <CardDescription>Your personalized step-by-step guide to better credit</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-muted-foreground">
              Upload your credit report to generate a personalized roadmap, or use our default improvement steps below.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Progress Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Credit Improvement Roadmap
          </CardTitle>
          <CardDescription>Your personalized step-by-step guide to better credit</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Overall Progress</span>
              <span className="text-sm text-muted-foreground">
                {completedSteps.size} of {steps.length} steps completed
              </span>
            </div>
            <Progress value={completionPercentage} className="h-2" />
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <span>High Priority</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                <span>Medium Priority</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span>Low Priority</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Roadmap Steps */}
      <div className="space-y-4">
        {steps.map((step, index) => {
          const isExpanded = expandedSteps.has(step.id)
          const isCompleted = completedSteps.has(step.id) || step.completed

          return (
            <Card key={step.id} className={`transition-all ${isCompleted ? "bg-green-50 border-green-200" : ""}`}>
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <CardHeader
                    className="cursor-pointer hover:bg-accent/50 transition-colors"
                    onClick={() => toggleStep(step.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleCompletion(step.id)
                          }}
                          className="p-0 h-auto"
                        >
                          {isCompleted ? (
                            <CheckCircle className="h-5 w-5 text-green-600" />
                          ) : (
                            <Circle className="h-5 w-5 text-muted-foreground" />
                          )}
                        </Button>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-muted-foreground">Step {index + 1}</span>
                            <Badge variant="outline" className={getPriorityColor(step.priority)}>
                              {step.priority}
                            </Badge>
                            <Badge variant="secondary">{step.category}</Badge>
                          </div>
                          <CardTitle className={`text-lg ${isCompleted ? "line-through text-muted-foreground" : ""}`}>
                            {step.title}
                          </CardTitle>
                          <CardDescription className="mt-1">{step.description}</CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          {step.estimatedTime}
                        </div>
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0">
                    <div className="space-y-4">
                      {/* Action Items */}
                      <div>
                        <h4 className="font-medium mb-2 flex items-center gap-2">
                          <Star className="h-4 w-4" />
                          Action Items
                        </h4>
                        <ul className="space-y-2">
                          {step.actionItems?.map((item, itemIndex) => (
                            <li key={itemIndex} className="flex items-start gap-2 text-sm">
                              <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full mt-2 flex-shrink-0"></div>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Expected Outcome */}
                      <div>
                        <h4 className="font-medium mb-2 flex items-center gap-2">
                          <Target className="h-4 w-4" />
                          Expected Outcome
                        </h4>
                        <p className="text-sm text-muted-foreground bg-blue-50 p-3 rounded-lg border border-blue-200">
                          {step.expectedOutcome}
                        </p>
                      </div>

                      {/* Ask About Step Button */}
                      {onAskAboutStep && (
                        <div className="pt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onAskAboutStep(step)}
                            className="flex items-center gap-2"
                          >
                            <MessageCircle className="h-4 w-4" />
                            Ask VestBot about this step
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          )
        })}
      </div>

      {/* Completion Message */}
      {completedSteps.size === steps.length && (
        <Card className="bg-green-50 border-green-200">
          <CardContent className="pt-6">
            <div className="text-center">
              <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-green-800 mb-2">Congratulations! 🎉</h3>
              <p className="text-green-700">
                You've completed all steps in your credit improvement roadmap. Keep monitoring your credit and
                maintaining good habits!
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

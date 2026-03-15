"use client"

import type React from "react"

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Info, Zap, TrendingUp, Target, ShieldCheck, FileWarning, UserCheck, History } from "lucide-react"
import type { RoadmapStep } from "@/types/supabase" // Ensure this path is correct

interface CreditRoadmapDisplayProps {
  roadmapSteps: RoadmapStep[]
  // onStepStatusChange?: (stepId: string, newStatus: RoadmapStep['status']) => void; // For future progress tracking
}

const categoryIcons: Record<RoadmapStep["category"], React.ElementType> = {
  "Credit Utilization": Zap,
  "Debt Management": TrendingUp,
  "Payment History": History,
  "Dispute Resolution": FileWarning,
  "Credit Building": UserCheck,
  "Credit Mix": ShieldCheck, // Example, choose appropriate
  Inquiries: Info, // Example
}

const priorityColors: Record<RoadmapStep["priority"], string> = {
  High: "bg-red-500/10 text-red-700 border-red-500/50",
  Medium: "bg-yellow-500/10 text-yellow-700 border-yellow-500/50",
  Low: "bg-green-500/10 text-green-700 border-green-500/50",
}

export function CreditRoadmapDisplay({ roadmapSteps }: CreditRoadmapDisplayProps) {
  if (!roadmapSteps || roadmapSteps.length === 0) {
    return (
      <Card className="text-center py-8">
        <CardContent>
          <Info className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="font-semibold">No Roadmap Steps Available</p>
          <p className="text-sm text-muted-foreground">Your personalized roadmap could not be generated or is empty.</p>
        </CardContent>
      </Card>
    )
  }

  // Group steps by category for a more organized view (optional)
  const groupedSteps = roadmapSteps.reduce(
    (acc, step) => {
      if (!acc[step.category]) {
        acc[step.category] = []
      }
      acc[step.category].push(step)
      return acc
    },
    {} as Record<RoadmapStep["category"], RoadmapStep[]>,
  )

  return (
    <div className="space-y-6">
      {Object.entries(groupedSteps).map(([category, steps]) => {
        const CategoryIcon = categoryIcons[category as RoadmapStep["category"]] || Target
        return (
          <div key={category}>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <CategoryIcon className="h-5 w-5 text-primary" />
              {category}
            </h3>
            <Accordion type="multiple" className="w-full space-y-3">
              {steps.map((step) => (
                <AccordionItem
                  value={step.id}
                  key={step.id}
                  className="border rounded-lg bg-card shadow-sm hover:shadow-md transition-shadow"
                >
                  <AccordionTrigger className="p-4 hover:no-underline">
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-3">
                        {/* Checkbox for future progress tracking - disabled for now */}
                        {/* <Checkbox
                          id={`step-${step.id}`}
                          checked={step.status === "Completed"}
                          disabled // Enable when onStepStatusChange is implemented
                          aria-label={`Mark step ${step.title} as ${step.status === "Completed" ? "incomplete" : "complete"}`}
                        /> */}
                        <span className="font-medium text-left">{step.title}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={`text-xs ${priorityColors[step.priority]}`}>
                          {step.priority} Priority
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {step.status}
                        </Badge>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="p-4 pt-0">
                    <p className="text-sm text-muted-foreground whitespace-pre-line">{step.description}</p>
                    {/* Future: Add links to resources, tools, or specific actions */}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        )
      })}
    </div>
  )
}

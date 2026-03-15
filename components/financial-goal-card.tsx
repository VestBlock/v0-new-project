import React from "react"
import { Card } from "@/components/ui/card"
import type { FinancialGoal } from "./financial-goals-selector"
import { Target, ShieldQuestion } from "lucide-react"

interface FinancialGoalCardProps {
  goal: FinancialGoal | null
  className?: string
}

export function FinancialGoalCard({ goal, className = "" }: FinancialGoalCardProps) {
  if (!goal) {
    return (
      <Card className={`p-4 bg-muted/30 border border-dashed border-muted-foreground/30 ${className}`}>
        <div className="flex items-center gap-3">
          <ShieldQuestion className="h-6 w-6 text-muted-foreground/50" />
          <div>
            <h3 className="font-medium text-muted-foreground">No Financial Goal Set</h3>
            <p className="text-sm text-muted-foreground/80">
              Select a primary goal in your profile to get personalized AI insights.
            </p>
          </div>
        </div>
      </Card>
    )
  }

  const iconToDisplay = goal.icon ? (
    React.cloneElement(goal.icon, {
      className: "h-8 w-8 text-cyan-400 drop-shadow-[0_0_5px_rgba(34,211,238,0.7)] flex-shrink-0",
    })
  ) : (
    <Target className="h-8 w-8 text-cyan-400 drop-shadow-[0_0_5px_rgba(34,211,238,0.7)] flex-shrink-0" />
  )

  return (
    <Card className={`p-4 bg-card/60 backdrop-blur-sm border border-cyan-400/30 ${className}`}>
      <div className="flex items-center gap-4">
        {iconToDisplay}
        <div className="overflow-hidden">
          <h3 className="text-sm text-muted-foreground">Primary Financial Goal</h3>
          <p className="text-lg font-bold gradient-text truncate" title={goal.title}>
            {goal.title}
          </p>
          {goal.customDetails && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-1" title={goal.customDetails}>
              {goal.customDetails}
            </p>
          )}
        </div>
      </div>
    </Card>
  )
}

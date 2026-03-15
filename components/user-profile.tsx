"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { Bot, CreditCard, DollarSign, Building, Target } from "lucide-react"
import { Slider } from "@/components/ui/slider"
import { FinancialGoalCard } from "@/components/financial-goal-card"
import type { FinancialGoal } from "@/components/financial-goals-selector"

interface UserData {
  creditScore?: number
  negativeItems?: string[]
  goals?: string
  income?: number
  businessEIN?: string
  country?: string
  reportText?: string
  financialGoal?: FinancialGoal
}

interface UserProfileProps {
  userData: UserData
  setUserData: React.Dispatch<React.SetStateAction<UserData>>
}

export function UserProfile({ userData, setUserData }: UserProfileProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [tempData, setTempData] = useState<UserData>(userData)

  const handleSave = () => {
    setUserData(tempData)
    setIsEditing(false)
  }

  const handleCancel = () => {
    setTempData(userData)
    setIsEditing(false)
  }

  const getCreditScoreColor = (score?: number) => {
    if (!score) return "text-muted-foreground"
    if (score < 580) return "text-red-500"
    if (score < 670) return "text-orange-500"
    if (score < 740) return "text-yellow-500"
    if (score < 800) return "text-green-500"
    return "text-cyan-400"
  }

  const getCreditScoreLabel = (score?: number) => {
    if (!score) return "Not Available"
    if (score < 580) return "Poor"
    if (score < 670) return "Fair"
    if (score < 740) return "Good"
    if (score < 800) return "Very Good"
    return "Excellent"
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold flex items-center">
          <Bot className="mr-2 h-5 w-5 text-cyan-400" />
          Financial Profile
        </h2>
        {!isEditing ? (
          <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
            Edit Profile
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleCancel}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} className="bg-cyan-500 hover:bg-cyan-600">
              Save
            </Button>
          </div>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-4">
          <div>
            <Label htmlFor="creditScore">Credit Score</Label>
            <div className="flex items-center gap-4">
              <Slider
                id="creditScore"
                min={300}
                max={850}
                step={1}
                value={[tempData.creditScore || 650]}
                onValueChange={(value) => setTempData({ ...tempData, creditScore: value[0] })}
                className="flex-1"
              />
              <span className="w-12 text-center">{tempData.creditScore || 650}</span>
            </div>
          </div>

          <div>
            <Label htmlFor="goals">Financial Goals</Label>
            <Input
              id="goals"
              value={tempData.goals || ""}
              onChange={(e) => setTempData({ ...tempData, goals: e.target.value })}
              placeholder="e.g., improve credit, get funding, start side hustle"
            />
          </div>

          <div>
            <Label htmlFor="income">Monthly Income ($)</Label>
            <Input
              id="income"
              type="number"
              value={tempData.income || ""}
              onChange={(e) => setTempData({ ...tempData, income: Number(e.target.value) })}
              placeholder="e.g., 4000"
            />
          </div>

          <div>
            <Label htmlFor="businessEIN">Business EIN (Optional)</Label>
            <Input
              id="businessEIN"
              value={tempData.businessEIN || ""}
              onChange={(e) => setTempData({ ...tempData, businessEIN: e.target.value })}
              placeholder="e.g., 12-3456789"
            />
          </div>

          <div>
            <Label htmlFor="country">Country</Label>
            <Input
              id="country"
              value={tempData.country || "United States"}
              onChange={(e) => setTempData({ ...tempData, country: e.target.value })}
            />
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <Card className="p-4 bg-muted">
            <div className="flex items-center gap-3">
              <CreditCard className="h-5 w-5 text-cyan-400" />
              <div>
                <h3 className="font-medium">Credit Score</h3>
                <p className={`text-2xl font-bold ${getCreditScoreColor(userData.creditScore)}`}>
                  {userData.creditScore || "Not Available"}
                  <span className="text-sm font-normal ml-2">{getCreditScoreLabel(userData.creditScore)}</span>
                </p>
              </div>
            </div>
          </Card>

          {userData.financialGoal && <FinancialGoalCard goal={userData.financialGoal} />}

          <Card className="p-4 bg-muted">
            <div className="flex items-center gap-3">
              <Target className="h-5 w-5 text-cyan-400" />
              <div>
                <h3 className="font-medium">Financial Goals</h3>
                <p className="text-muted-foreground">{userData.goals || "No goals specified"}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4 bg-muted">
            <div className="flex items-center gap-3">
              <DollarSign className="h-5 w-5 text-cyan-400" />
              <div>
                <h3 className="font-medium">Monthly Income</h3>
                <p className="text-muted-foreground">
                  {userData.income ? `$${userData.income.toLocaleString()}` : "Not specified"}
                </p>
              </div>
            </div>
          </Card>

          {userData.businessEIN && (
            <Card className="p-4 bg-muted">
              <div className="flex items-center gap-3">
                <Building className="h-5 w-5 text-cyan-400" />
                <div>
                  <h3 className="font-medium">Business EIN</h3>
                  <p className="text-muted-foreground">{userData.businessEIN}</p>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

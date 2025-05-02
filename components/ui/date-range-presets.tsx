"use client"

import { Button } from "@/components/ui/button"
import { getDateRange } from "@/lib/date-utils"

interface DateRangePresetsProps {
  onSelectRange: (range: { start: Date; end: Date }) => void
  className?: string
}

export function DateRangePresets({ onSelectRange, className }: DateRangePresetsProps) {
  const presets = [
    { label: "Today", value: "today" },
    { label: "Yesterday", value: "yesterday" },
    { label: "This Week", value: "thisWeek" },
    { label: "Last Week", value: "lastWeek" },
    { label: "This Month", value: "thisMonth" },
    { label: "Last Month", value: "lastMonth" },
    { label: "Last 7 Days", value: "last7Days" },
    { label: "Last 30 Days", value: "last30Days" },
  ] as const

  return (
    <div className={className}>
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        {presets.map((preset) => (
          <Button
            key={preset.value}
            variant="outline"
            size="sm"
            className="min-h-9 text-xs sm:text-sm" // Ensure touch-friendly height and readable text
            onClick={() => {
              const range = getDateRange(preset.value)
              onSelectRange(range)
            }}
          >
            {preset.label}
          </Button>
        ))}
      </div>
    </div>
  )
}

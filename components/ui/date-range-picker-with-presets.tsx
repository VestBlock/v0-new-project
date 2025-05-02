"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Calendar, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { DateRangePresets } from "@/components/ui/date-range-presets"
import { useMediaQuery } from "@/hooks/use-media-query"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"

interface DateRangePickerWithPresetsProps {
  startDate: Date | null
  endDate: Date | null
  onRangeChange: (range: { start: Date | null; end: Date | null }) => void
  className?: string
  placeholder?: string
  disabled?: boolean
}

export function DateRangePickerWithPresets({
  startDate,
  endDate,
  onRangeChange,
  className,
  placeholder = "Select date range",
  disabled = false,
}: DateRangePickerWithPresetsProps) {
  const [open, setOpen] = useState(false)
  const isMobile = useMediaQuery("(max-width: 640px)")

  const displayText = () => {
    if (startDate && endDate) {
      return isMobile
        ? `${format(startDate, "MM/dd/yy")} - ${format(endDate, "MM/dd/yy")}`
        : `${format(startDate, "PP")} - ${format(endDate, "PP")}`
    }
    if (startDate) {
      return isMobile ? `${format(startDate, "MM/dd/yy")} - ...` : `${format(startDate, "PP")} - Select end date`
    }
    return placeholder
  }

  const handleClear = () => {
    onRangeChange({ start: null, end: null })
    setOpen(false)
  }

  const triggerButton = (
    <Button
      variant="outline"
      className={cn(
        "w-full justify-start text-left font-normal",
        !startDate && !endDate && "text-muted-foreground",
        "min-h-10", // Ensure touch-friendly height
      )}
      disabled={disabled}
    >
      <Calendar className="mr-2 h-4 w-4" />
      {displayText()}
    </Button>
  )

  const content = (
    <div className="p-3 space-y-3">
      <DateRangePresets
        onSelectRange={(range) => {
          onRangeChange({ start: range.start, end: range.end })
          setOpen(false)
        }}
        className="grid grid-cols-2 md:flex md:flex-wrap"
      />
      <div className="border-t pt-3">
        <CalendarComponent
          mode="range"
          selected={startDate && endDate ? [startDate, endDate] : undefined}
          onSelect={(range) => {
            if (Array.isArray(range) && range.length === 2) {
              onRangeChange({ start: range[0], end: range[1] })
            }
          }}
          numberOfMonths={isMobile ? 1 : 2}
          disabled={disabled}
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" className="min-h-9" onClick={handleClear}>
          Clear
        </Button>
        <Button size="sm" className="min-h-9" onClick={() => setOpen(false)}>
          Apply
        </Button>
      </div>
    </div>
  )

  return (
    <div className={cn("relative", className)}>
      {isMobile ? (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>{triggerButton}</SheetTrigger>
          <SheetContent side="bottom" className="h-[80vh] overflow-y-auto">
            {content}
          </SheetContent>
        </Sheet>
      ) : (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>{triggerButton}</PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            {content}
          </PopoverContent>
        </Popover>
      )}
      {(startDate || endDate) && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="absolute right-0 top-0 h-full px-3 py-2"
          onClick={handleClear}
          disabled={disabled}
          aria-label="Clear date range"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}

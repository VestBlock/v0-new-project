"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Calendar, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { useMediaQuery } from "@/hooks/use-media-query"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"

interface DatePickerWithPresetsProps {
  date: Date | null
  onDateChange: (date: Date | null) => void
  className?: string
  placeholder?: string
  disabled?: boolean
}

export function DatePickerWithPresets({
  date,
  onDateChange,
  className,
  placeholder = "Pick a date",
  disabled = false,
}: DatePickerWithPresetsProps) {
  const [open, setOpen] = useState(false)
  const isMobile = useMediaQuery("(max-width: 640px)")

  const presets = [
    { label: "Today", value: new Date() },
    { label: "Yesterday", value: new Date(new Date().setDate(new Date().getDate() - 1)) },
    { label: "Start of week", value: new Date(new Date().setDate(new Date().getDate() - new Date().getDay())) },
    { label: "Start of month", value: new Date(new Date().setDate(1)) },
  ]

  const handleSelect = (selectedDate: Date) => {
    onDateChange(selectedDate)
    setOpen(false)
  }

  const handleClear = () => {
    onDateChange(null)
    setOpen(false)
  }

  const triggerButton = (
    <Button
      variant="outline"
      className={cn(
        "w-full justify-start text-left font-normal",
        !date && "text-muted-foreground",
        "min-h-10", // Ensure touch-friendly height
      )}
      disabled={disabled}
    >
      <Calendar className="mr-2 h-4 w-4" />
      {date ? format(date, "PPP") : placeholder}
    </Button>
  )

  const content = (
    <div className="p-3 space-y-3">
      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => (
          <Button
            key={preset.label}
            variant="outline"
            size="sm"
            className="min-h-9" // Ensure touch-friendly height
            onClick={() => handleSelect(preset.value)}
          >
            {preset.label}
          </Button>
        ))}
      </div>
      <div className="border-t pt-3">
        <CalendarComponent
          mode="single"
          selected={date || undefined}
          onSelect={(selectedDate) => selectedDate && handleSelect(selectedDate)}
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
      {date && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="absolute right-0 top-0 h-full px-3 py-2"
          onClick={() => {
            onDateChange(null)
            setOpen(false)
          }}
          disabled={disabled}
          aria-label="Clear date"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}

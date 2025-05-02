"use client"

import { useState, useEffect } from "react"
import ReactDatePicker from "react-datepicker"
import { Button } from "@/components/ui/button"
import { Calendar, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { useMediaQuery } from "@/hooks/use-media-query"

// Import the CSS for react-datepicker
import "react-datepicker/dist/react-datepicker.css"

interface DatePickerProps {
  date: Date | undefined
  setDate: (date: Date | undefined) => void
  className?: string
  placeholder?: string
  disabled?: boolean
}

export function DatePicker({
  date,
  setDate,
  className,
  placeholder = "Pick a date",
  disabled = false,
}: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const isMobile = useMediaQuery("(max-width: 640px)")

  // Close the date picker when clicking outside on mobile
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (isMobile && open && !target.closest(".react-datepicker") && !target.closest("button")) {
        setOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isMobile, open])

  return (
    <div className={cn("relative", className)}>
      <div className="relative">
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !date && "text-muted-foreground",
            "min-h-10", // Ensure touch-friendly height
          )}
          onClick={() => setOpen(!open)}
          disabled={disabled}
          aria-expanded={open}
          aria-haspopup="dialog"
        >
          <Calendar className="mr-2 h-4 w-4" />
          {date ? format(date, "PPP") : placeholder}
        </Button>
        {date && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-0 top-0 h-full px-3 py-2"
            onClick={(e) => {
              e.stopPropagation()
              setDate(undefined)
              setOpen(false)
            }}
            disabled={disabled}
            aria-label="Clear date"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      <ReactDatePicker
        selected={date}
        onChange={(date) => {
          setDate(date as Date)
          setOpen(false)
        }}
        onClickOutside={() => setOpen(false)}
        open={open}
        disabled={disabled}
        wrapperClassName="w-full"
        popperClassName={cn("react-datepicker-right", isMobile && "react-datepicker-mobile")}
        customInput={<div style={{ display: "none" }} />}
        portalId="date-picker-portal"
        withPortal={isMobile}
        showMonthDropdown
        showYearDropdown
        dropdownMode="select"
        fixedHeight
      />
      <div id="date-picker-portal" />
    </div>
  )
}

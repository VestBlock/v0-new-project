"use client"

import type React from "react"

import { useState, useEffect } from "react"
import ReactDatePicker from "react-datepicker"
import { Button } from "@/components/ui/button"
import { Calendar, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { useMediaQuery } from "@/hooks/use-media-query"

// Import the CSS for react-datepicker
import "react-datepicker/dist/react-datepicker.css"

interface DateRangePickerProps {
  startDate: Date | null
  endDate: Date | null
  setStartDate: (date: Date | null) => void
  setEndDate: (date: Date | null) => void
  className?: string
  placeholder?: string
  disabled?: boolean
}

export function DateRangePicker({
  startDate,
  endDate,
  setStartDate,
  setEndDate,
  className,
  placeholder = "Select date range",
  disabled = false,
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false)
  const isMobile = useMediaQuery("(max-width: 640px)")

  const handleChange = (dates: [Date | null, Date | null]) => {
    const [start, end] = dates
    setStartDate(start)
    setEndDate(end)
    if (start && end) {
      setOpen(false)
    }
  }

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

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    setStartDate(null)
    setEndDate(null)
    setOpen(false)
  }

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
            !startDate && !endDate && "text-muted-foreground",
            "min-h-10", // Ensure touch-friendly height
          )}
          onClick={() => setOpen(!open)}
          disabled={disabled}
          aria-expanded={open}
          aria-haspopup="dialog"
        >
          <Calendar className="mr-2 h-4 w-4" />
          {displayText()}
        </Button>
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
      <ReactDatePicker
        selected={startDate}
        onChange={handleChange}
        startDate={startDate}
        endDate={endDate}
        selectsRange
        onClickOutside={() => setOpen(false)}
        open={open}
        disabled={disabled}
        wrapperClassName="w-full"
        popperClassName={cn("react-datepicker-right", isMobile && "react-datepicker-mobile")}
        customInput={<div style={{ display: "none" }} />}
        portalId="date-range-picker-portal"
        withPortal={isMobile}
        showMonthDropdown
        showYearDropdown
        dropdownMode="select"
        monthsShown={isMobile ? 1 : 2}
        fixedHeight
      />
      <div id="date-range-picker-portal" />
    </div>
  )
}

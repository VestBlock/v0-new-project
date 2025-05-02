"use client"
import ReactDatePicker from "react-datepicker"
import { cn } from "@/lib/utils"
import { useMediaQuery } from "@/hooks/use-media-query"

// Import the CSS for react-datepicker
import "react-datepicker/dist/react-datepicker.css"

interface CalendarProps {
  mode?: "single" | "range" | "multiple"
  selected?: Date | Date[] | null
  onSelect?: (date: Date | Date[] | null) => void
  disabled?: boolean
  className?: string
  numberOfMonths?: number
  showOutsideDays?: boolean
  fixedWeeks?: boolean
  locale?: string
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6
}

export function Calendar({
  mode = "single",
  selected,
  onSelect,
  disabled = false,
  className,
  numberOfMonths = 1,
  showOutsideDays = true,
  fixedWeeks = false,
  locale = "en-US",
  weekStartsOn = 0,
}: CalendarProps) {
  const isMobile = useMediaQuery("(max-width: 640px)")
  const actualMonths = isMobile ? 1 : numberOfMonths

  const handleChange = (date: Date | null) => {
    if (onSelect) {
      if (mode === "single") {
        onSelect(date)
      } else if (mode === "multiple" && date && Array.isArray(selected)) {
        onSelect([...selected, date])
      }
    }
  }

  const handleRangeChange = (dates: [Date | null, Date | null]) => {
    if (onSelect && mode === "range") {
      onSelect(dates)
    }
  }

  return (
    <div className={cn("p-3", className)}>
      {mode === "single" && (
        <ReactDatePicker
          selected={selected as Date | null}
          onChange={handleChange}
          inline
          disabled={disabled}
          monthsShown={actualMonths}
          showMonthDropdown
          showYearDropdown
          dropdownMode="select"
          calendarStartDay={weekStartsOn}
          fixedHeight={fixedWeeks}
          showPopperArrow={false}
          className={cn("react-datepicker-calendar", isMobile && "react-datepicker-calendar-mobile")}
        />
      )}
      {mode === "range" && (
        <ReactDatePicker
          selected={(selected as Date[] | null)?.[0] || null}
          onChange={handleRangeChange}
          startDate={(selected as Date[] | null)?.[0] || null}
          endDate={(selected as Date[] | null)?.[1] || null}
          selectsRange
          inline
          disabled={disabled}
          monthsShown={actualMonths}
          showMonthDropdown
          showYearDropdown
          dropdownMode="select"
          calendarStartDay={weekStartsOn}
          fixedHeight={fixedWeeks}
          showPopperArrow={false}
          className={cn("react-datepicker-calendar", isMobile && "react-datepicker-calendar-mobile")}
        />
      )}
      {mode === "multiple" && (
        <ReactDatePicker
          selected={null}
          onChange={handleChange}
          highlightDates={Array.isArray(selected) ? selected : []}
          inline
          disabled={disabled}
          monthsShown={actualMonths}
          showMonthDropdown
          showYearDropdown
          dropdownMode="select"
          calendarStartDay={weekStartsOn}
          fixedHeight={fixedWeeks}
          showPopperArrow={false}
          className={cn("react-datepicker-calendar", isMobile && "react-datepicker-calendar-mobile")}
        />
      )}
    </div>
  )
}

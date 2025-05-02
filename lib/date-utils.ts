import {
  format,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subDays,
  subWeeks,
  subMonths,
} from "date-fns"

// Format a date with the specified format
export function formatDate(date: Date | null | undefined, formatString = "PP"): string {
  if (!date) return ""
  return format(date, formatString)
}

// Format a date range for display
export function formatDateRange(
  startDate: Date | null | undefined,
  endDate: Date | null | undefined,
  formatString = "PP",
  separator = " - ",
): string {
  if (!startDate) return ""
  if (!endDate) return `${formatDate(startDate, formatString)} - ...`
  return `${formatDate(startDate, formatString)}${separator}${formatDate(endDate, formatString)}`
}

// Get a date range based on a preset
export function getDateRange(preset: string): { start: Date; end: Date } {
  const today = new Date()

  switch (preset) {
    case "today":
      return {
        start: startOfDay(today),
        end: endOfDay(today),
      }
    case "yesterday": {
      const yesterday = subDays(today, 1)
      return {
        start: startOfDay(yesterday),
        end: endOfDay(yesterday),
      }
    }
    case "thisWeek":
      return {
        start: startOfWeek(today, { weekStartsOn: 0 }),
        end: endOfWeek(today, { weekStartsOn: 0 }),
      }
    case "lastWeek": {
      const lastWeek = subWeeks(today, 1)
      return {
        start: startOfWeek(lastWeek, { weekStartsOn: 0 }),
        end: endOfWeek(lastWeek, { weekStartsOn: 0 }),
      }
    }
    case "thisMonth":
      return {
        start: startOfMonth(today),
        end: endOfDay(today),
      }
    case "lastMonth": {
      const lastMonth = subMonths(today, 1)
      return {
        start: startOfMonth(lastMonth),
        end: endOfMonth(lastMonth),
      }
    }
    case "last7Days":
      return {
        start: startOfDay(subDays(today, 6)),
        end: endOfDay(today),
      }
    case "last30Days":
      return {
        start: startOfDay(subDays(today, 29)),
        end: endOfDay(today),
      }
    default:
      return {
        start: startOfDay(today),
        end: endOfDay(today),
      }
  }
}

// Parse a date string to a Date object
export function parseDate(dateString: string): Date | null {
  const date = new Date(dateString)
  return isNaN(date.getTime()) ? null : date
}

// Check if a date is valid
export function isValidDate(date: any): boolean {
  return date instanceof Date && !isNaN(date.getTime())
}

// Get a formatted date string for API requests
export function getApiDateString(date: Date | null | undefined): string {
  if (!date) return ""
  return format(date, "yyyy-MM-dd")
}

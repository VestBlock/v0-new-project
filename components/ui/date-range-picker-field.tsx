"use client"

import { DateRangePicker } from "@/components/ui/date-range-picker"
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { useFormContext } from "react-hook-form"

interface DateRangePickerFieldProps {
  startName: string
  endName: string
  label?: string
  description?: string
  placeholder?: string
  disabled?: boolean
  required?: boolean
}

export function DateRangePickerField({
  startName,
  endName,
  label,
  description,
  placeholder,
  disabled = false,
  required = false,
}: DateRangePickerFieldProps) {
  const form = useFormContext()

  return (
    <FormItem className="flex flex-col">
      {label && (
        <FormLabel>
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </FormLabel>
      )}
      <div className="flex items-center gap-2">
        <FormField
          control={form.control}
          name={startName}
          render={({ field: startField }) => (
            <FormField
              control={form.control}
              name={endName}
              render={({ field: endField }) => (
                <FormControl>
                  <DateRangePicker
                    startDate={startField.value}
                    endDate={endField.value}
                    setStartDate={startField.onChange}
                    setEndDate={endField.onChange}
                    placeholder={placeholder}
                    disabled={disabled}
                  />
                </FormControl>
              )}
            />
          )}
        />
      </div>
      {description && <FormDescription>{description}</FormDescription>}
      <div className="flex gap-2">
        <div className="flex-1">
          <FormMessage name={startName} />
        </div>
        <div className="flex-1">
          <FormMessage name={endName} />
        </div>
      </div>
    </FormItem>
  )
}

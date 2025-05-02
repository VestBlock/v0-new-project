"use client"

import type React from "react"

import { useState } from "react"

type ValidationRule<T> = {
  validate: (value: any, formData: T) => boolean
  message: string
}

type FieldValidation<T> = {
  [K in keyof T]?: ValidationRule<T>[]
}

export function useFormValidation<T extends Record<string, any>>(
  initialValues: T,
  validationRules: FieldValidation<T>,
) {
  const [formData, setFormData] = useState<T>(initialValues)
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({})
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({})

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))

    // Mark field as touched
    setTouched((prev) => ({ ...prev, [name]: true }))

    // Clear error when user types
    if (errors[name as keyof T]) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[name as keyof T]
        return newErrors
      })
    }
  }

  const validateField = (name: keyof T) => {
    const fieldRules = validationRules[name]
    if (!fieldRules) return true

    for (const rule of fieldRules) {
      if (!rule.validate(formData[name], formData)) {
        setErrors((prev) => ({ ...prev, [name]: rule.message }))
        return false
      }
    }

    // Clear error if validation passes
    setErrors((prev) => {
      const newErrors = { ...prev }
      delete newErrors[name]
      return newErrors
    })

    return true
  }

  const validateForm = () => {
    let isValid = true
    const newErrors: Partial<Record<keyof T, string>> = {}

    // Validate all fields
    for (const field in validationRules) {
      const fieldName = field as keyof T
      const fieldRules = validationRules[fieldName]

      if (fieldRules) {
        for (const rule of fieldRules) {
          if (!rule.validate(formData[fieldName], formData)) {
            newErrors[fieldName] = rule.message
            isValid = false
            break
          }
        }
      }
    }

    setErrors(newErrors)
    return isValid
  }

  const resetForm = () => {
    setFormData(initialValues)
    setErrors({})
    setTouched({})
  }

  return {
    formData,
    errors,
    touched,
    setFormData,
    handleChange,
    validateField,
    validateForm,
    resetForm,
  }
}

// Common validation rules
export const validationRules = {
  required: (message = "This field is required") => ({
    validate: (value: any) => !!value && (typeof value !== "string" || value.trim() !== ""),
    message,
  }),

  minLength: (length: number, message = `Must be at least ${length} characters`) => ({
    validate: (value: string) => !value || value.length >= length,
    message,
  }),

  maxLength: (length: number, message = `Must be at most ${length} characters`) => ({
    validate: (value: string) => !value || value.length <= length,
    message,
  }),

  email: (message = "Please enter a valid email address") => ({
    validate: (value: string) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    message,
  }),

  match: <T extends Record<string, any>>(field: keyof T, message = "Fields do not match") => ({
    validate: (value: any, formData: T) => value === formData[field],
    message,
  }),

  pattern: (regex: RegExp, message = "Invalid format") => ({
    validate: (value: string) => !value || regex.test(value),
    message,
  }),
}

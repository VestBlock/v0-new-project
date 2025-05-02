/**
 * Form Compatibility Checker
 *
 * This utility helps diagnose and fix common issues with react-hook-form
 * in the context of React 18 and Next.js.
 */

import { version as reactVersion } from "react"

export function checkFormCompatibility() {
  try {
    // Check React version
    console.log(`React version: ${reactVersion}`)

    // Try to dynamically import react-hook-form to check its version
    import("react-hook-form")
      .then((rhf) => {
        // @ts-ignore - Accessing version which might not be in the type definitions
        const rhfVersion = rhf.version || "unknown"
        console.log(`react-hook-form version: ${rhfVersion}`)

        // Compatibility check
        if (reactVersion.startsWith("18.2") && !rhfVersion.startsWith("7.45")) {
          console.warn(
            "Potential compatibility issue: For React 18.2.0, react-hook-form 7.45.x is recommended. " +
              'Current versions might cause "r is not a function" errors.',
          )
        }
      })
      .catch((err) => {
        console.error("Failed to check react-hook-form version:", err)
      })
  } catch (error) {
    console.error("Error checking form compatibility:", error)
  }
}

/**
 * Common fixes for react-hook-form issues:
 *
 * 1. "r is not a function" error:
 *    - Downgrade react-hook-form to 7.45.4
 *    - Add explicit mode: "onSubmit" to useForm
 *    - Ensure defaultValues are properly initialized
 *
 * 2. Form not validating:
 *    - Check that zodResolver is properly configured
 *    - Ensure form fields have correct names matching the schema
 *
 * 3. Form not submitting:
 *    - Verify the onSubmit handler is correctly bound
 *    - Check for any preventDefault() calls that might block submission
 */

export function debugFormSubmission(formData: any) {
  console.log("Form submission data:", formData)
  // Add any additional debugging logic here
  return formData
}

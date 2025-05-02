/**
 * VestBlock Dependency Manifest
 *
 * This file documents all critical dependencies and their compatible versions.
 * Use this as a reference when adding new dependencies or updating existing ones.
 */

export const DEPENDENCY_MANIFEST = {
  // Core dependencies
  core: {
    react: "18.2.0", // IMPORTANT: Must be 18.2.0 for compatibility with react-day-picker
    reactDom: "18.2.0", // Must match React version
    next: "14.0.4", // Latest stable Next.js version compatible with our setup
  },

  // UI and component libraries
  ui: {
    reactHookForm: "^7.49.2", // For form handling
    hookformResolvers: "^3.3.2", // For form validation with Zod
    radixUi: "^1.0.0", // Various UI primitives
    lucideReact: "^0.294.0", // Icons
    tailwindMerge: "^2.1.0", // Utility for merging Tailwind classes
    tailwindcssAnimate: "^1.0.7", // Animation utilities for Tailwind
    classVarianceAuthority: "^0.7.0", // For component variants
    dateFns: "^2.30.0", // Date utilities
    reactDayPicker: "8.10.1", // Date picker (requires React 18)
  },

  // Data and state management
  data: {
    zod: "^3.22.4", // Schema validation
    supabaseJs: "^2.39.0", // Supabase client
    supabaseAuthHelpers: "^0.8.7", // Supabase auth helpers for Next.js
  },

  // API and integration
  api: {
    ai: "^2.2.31", // AI SDK
    aiSdkOpenai: "^1.0.0", // OpenAI integration for AI SDK
    pRetry: "^6.1.0", // Retry utility for API calls
  },

  // Visualization
  visualization: {
    chartJs: "^4.4.1", // Chart library
    reactChartJs2: "^5.2.0", // React wrapper for Chart.js
  },

  // Content and formatting
  content: {
    reactMarkdown: "^9.0.1", // Markdown rendering
  },
}

/**
 * Compatibility notes for future reference:
 *
 * 1. React 18.2.0 is required for compatibility with react-day-picker 8.10.1
 * 2. Next.js 14+ requires Node.js 18.17.0 or later
 * 3. Supabase JS v2 is not compatible with v1 API patterns
 * 4. AI SDK requires specific OpenAI API patterns
 */

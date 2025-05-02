/**
 * Comprehensive error handling system for VestBlock
 *
 * This file provides utilities for consistent error handling,
 * logging, and reporting across the application.
 */

import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { sanitizeForJson } from "./json-utils"
import { createErrorResponse } from "./api-patterns"

// Create Supabase client for error logging
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Error types for better categorization
export enum ErrorType {
  VALIDATION = "validation",
  AUTHENTICATION = "authentication",
  AUTHORIZATION = "authorization",
  NOT_FOUND = "not_found",
  RATE_LIMIT = "rate_limit",
  EXTERNAL_API = "external_api",
  DATABASE = "database",
  SERVER = "server",
  NETWORK = "network",
  UNKNOWN = "unknown",
}

// Error severity levels
export enum ErrorSeverity {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical",
}

// Error context interface
export interface ErrorContext {
  userId?: string
  requestId?: string
  path?: string
  method?: string
  input?: any
  additionalInfo?: Record<string, any>
}

// Application error class
export class AppError extends Error {
  type: ErrorType
  code?: string
  severity: ErrorSeverity
  context?: ErrorContext
  cause?: Error
  statusCode: number

  constructor({
    message,
    type = ErrorType.UNKNOWN,
    code,
    severity = ErrorSeverity.MEDIUM,
    context,
    cause,
    statusCode,
  }: {
    message: string
    type?: ErrorType
    code?: string
    severity?: ErrorSeverity
    context?: ErrorContext
    cause?: Error
    statusCode?: number
  }) {
    super(message)
    this.name = "AppError"
    this.type = type
    this.code = code
    this.severity = severity
    this.context = context
    this.cause = cause

    // Determine appropriate status code based on error type
    this.statusCode = statusCode || determineStatusCode(type)

    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError)
    }
  }
}

// Determine HTTP status code based on error type
function determineStatusCode(type: ErrorType): number {
  switch (type) {
    case ErrorType.VALIDATION:
      return 400
    case ErrorType.AUTHENTICATION:
      return 401
    case ErrorType.AUTHORIZATION:
      return 403
    case ErrorType.NOT_FOUND:
      return 404
    case ErrorType.RATE_LIMIT:
      return 429
    case ErrorType.DATABASE:
    case ErrorType.SERVER:
    case ErrorType.EXTERNAL_API:
    case ErrorType.NETWORK:
    case ErrorType.UNKNOWN:
    default:
      return 500
  }
}

/**
 * Log an error to the database and console
 */
export async function logError(error: Error | AppError, context?: ErrorContext): Promise<void> {
  try {
    const isAppError = error instanceof AppError
    const errorType = isAppError ? error.type : ErrorType.UNKNOWN
    const severity = isAppError ? error.severity : ErrorSeverity.MEDIUM
    const errorContext = isAppError ? error.context || context : context

    // Log to console first (this always works even if DB fails)
    console.error(`[ERROR][${errorType}][${severity}] ${error.message}`, {
      context: errorContext,
      stack: error.stack,
    })

    // Then log to database
    await supabase.from("error_logs").insert({
      error_type: errorType,
      message: error.message,
      severity: severity,
      user_id: errorContext?.userId,
      request_id: errorContext?.requestId || `req_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`,
      path: errorContext?.path,
      method: errorContext?.method,
      input: sanitizeForJson(errorContext?.input),
      additional_info: sanitizeForJson(errorContext?.additionalInfo),
      stack_trace: error.stack,
      timestamp: new Date().toISOString(),
    })
  } catch (logError) {
    // If logging fails, at least log to console
    console.error("Failed to log error to database:", logError)
    console.error("Original error:", error)
  }
}

/**
 * API route error handler wrapper
 */
export function withErrorHandler(
  handler: (req: NextRequest) => Promise<NextResponse>,
): (req: NextRequest) => Promise<NextResponse> {
  return async (req: NextRequest) => {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`
    const startTime = Date.now()

    try {
      // Add request ID to headers
      const response = await handler(req)
      response.headers.set("X-Request-ID", requestId)
      return response
    } catch (error) {
      // Determine if this is an AppError or convert it
      const appError =
        error instanceof AppError
          ? error
          : new AppError({
              message: error instanceof Error ? error.message : "An unexpected error occurred",
              cause: error instanceof Error ? error : undefined,
              context: {
                requestId,
                path: req.nextUrl.pathname,
                method: req.method,
              },
            })

      // Log the error
      await logError(appError)

      // Return appropriate error response
      return NextResponse.json(
        createErrorResponse(
          appError.message,
          appError.code,
          process.env.NODE_ENV === "development"
            ? {
                type: appError.type,
                stack: appError.stack,
                cause: appError.cause,
              }
            : undefined,
          {
            requestId,
            timestamp: new Date().toISOString(),
            processingTimeMs: Date.now() - startTime,
          },
        ),
        { status: appError.statusCode },
      )
    }
  }
}

/**
 * Create the error_logs table if it doesn't exist
 */
export async function ensureErrorLogsTable(): Promise<void> {
  try {
    // Check if the table exists
    const { error: checkError } = await supabase.from("error_logs").select("id").limit(1)

    // If the table doesn't exist, create it
    if (checkError && checkError.message.includes("does not exist")) {
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS error_logs (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          error_type TEXT NOT NULL,
          message TEXT NOT NULL,
          severity TEXT NOT NULL,
          user_id UUID,
          request_id TEXT,
          path TEXT,
          method TEXT,
          input JSONB,
          additional_info JSONB,
          stack_trace TEXT,
          timestamp TIMESTAMPTZ NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_error_logs_timestamp ON error_logs(timestamp);
        CREATE INDEX IF NOT EXISTS idx_error_logs_user_id ON error_logs(user_id);
        CREATE INDEX IF NOT EXISTS idx_error_logs_error_type ON error_logs(error_type);
        CREATE INDEX IF NOT EXISTS idx_error_logs_severity ON error_logs(severity);
      `

      // Execute the SQL using Supabase's rpc
      const { error: createError } = await supabase.rpc("exec_sql", { sql: createTableSQL })

      if (createError) {
        console.error("Failed to create error_logs table:", createError)
      } else {
        console.log("Created error_logs table successfully")
      }
    }
  } catch (error) {
    console.error("Error ensuring error_logs table:", error)
  }
}

/**
 * Validate request data against a schema
 */
export function validateRequest<T>(data: unknown, schema: any): T {
  try {
    return schema.parse(data) as T
  } catch (error) {
    throw new AppError({
      message: "Validation error: Invalid request data",
      type: ErrorType.VALIDATION,
      severity: ErrorSeverity.LOW,
      context: {
        input: data,
        additionalInfo: { validationError: error },
      },
    })
  }
}

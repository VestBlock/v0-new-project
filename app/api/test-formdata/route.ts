import { type NextRequest, NextResponse } from "next/server"
import { requireInternalDiagnosticsAccess } from "@/lib/debug/access"

export async function POST(req: NextRequest) {
  const access = await requireInternalDiagnosticsAccess()
  if (access.error) {
    return access.error
  }

  try {
    const contentType = req.headers.get("content-type") || "not-set"

    // Try to parse as FormData
    try {
      const formData = await req.formData()
      const entries: Record<string, any> = {}

      // Get all form data entries
      for (const [key, value] of formData.entries()) {
        if (value instanceof File) {
          entries[key] = {
            type: "file",
            name: value.name,
            size: value.size,
            mimeType: value.type,
          }
        } else {
          entries[key] = value
        }
      }

      return NextResponse.json({
        success: true,
        contentType,
        formDataEntries: entries,
      })
    } catch (formError) {
      return NextResponse.json({
        success: false,
        contentType,
        error: "Failed to parse FormData",
        details:
          process.env.NODE_ENV === "production"
            ? undefined
            : formError instanceof Error
              ? formError.message
              : String(formError),
      })
    }
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: "Server error",
      details:
        process.env.NODE_ENV === "production"
          ? undefined
          : error instanceof Error
            ? error.message
            : String(error),
    })
  }
}

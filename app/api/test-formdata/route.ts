import { type NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "not-set"
    console.log("Test FormData - Content-Type:", contentType)

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
        details: formError instanceof Error ? formError.message : String(formError),
      })
    }
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: "Server error",
      details: error instanceof Error ? error.message : String(error),
    })
  }
}

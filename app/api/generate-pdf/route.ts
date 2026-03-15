import { getSupabaseServer } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const { html, fileName, userId } = await req.json()

    if (!html || !fileName) {
      return NextResponse.json(
        {
          error: "Missing required parameters",
        },
        { status: 400 },
      )
    }

    // Get the PDF.co API key - Use the non-public version for server-side
    const apiKey = process.env.PDFCO_API_KEY

    if (!apiKey) {
      console.error("PDF.co API key (PDFCO_API_KEY) is not configured on the server.")
      return NextResponse.json(
        {
          error: "PDF.co API key is not configured",
        },
        { status: 500 },
      )
    }

    // Generate the PDF using PDF.co
    const response = await fetch("https://api.pdf.co/v1/pdf/convert/from/html", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        html,
        name: fileName,
        async: false,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error("PDF.co API error:", error)
      return NextResponse.json(
        {
          error: "Failed to generate PDF",
          details: error,
        },
        { status: response.status },
      )
    }

    const data = await response.json()

    if (data.error) {
      console.error("PDF.co data error:", data.error)
      return NextResponse.json(
        {
          error: data.error.message || "PDF.co returned an error.",
          details: data.error.details,
        },
        { status: data.error.status || 500 },
      )
    }

    // If userId is provided, save the PDF URL to the user's account
    if (userId) {
      const supabase = getSupabaseServer()

      const { error: dbError } = await supabase.from("user_documents").insert({
        user_id: userId,
        document_name: fileName,
        document_url: data.url,
        document_type: "dispute_letter",
        created_at: new Date().toISOString(),
      })

      if (dbError) {
        console.error("Supabase error saving document:", dbError)
        // Non-critical error for the PDF generation itself, but good to log
        // You might decide if this should return an error to the client or not
      }
    }

    return NextResponse.json({ url: data.url })
  } catch (error: any) {
    console.error("PDF generation API error:", error)
    return NextResponse.json(
      {
        error: "Failed to generate PDF",
        details: error.message,
      },
      { status: 500 },
    )
  }
}

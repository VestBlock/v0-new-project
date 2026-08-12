import { registerUserDocument } from "@/lib/documents/service"
import { getServerUser } from "@/lib/auth/admin"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const user = await getServerUser()
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    const { html, fileName } = await req.json()

    if (
      typeof html !== "string" ||
      !html ||
      html.length > 500_000 ||
      typeof fileName !== "string" ||
      !/^[a-z0-9][a-z0-9._ -]{0,119}$/i.test(fileName)
    ) {
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
      signal: AbortSignal.timeout(20_000),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error("PDF.co API error:", error)
      return NextResponse.json(
        {
          error: "Failed to generate PDF",
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
        },
        { status: data.error.status || 500 },
      )
    }

    try {
        await registerUserDocument({
          userId: user.id,
          documentName: fileName,
          documentUrl: data.url,
          documentType: "dispute_letter",
          status: "ready",
          metadataJson: {
            source: "generate-pdf",
          },
        })
    } catch (dbError) {
        console.error("Supabase error saving document:", dbError)
    }

    return NextResponse.json({ url: data.url })
  } catch (error: any) {
    console.error("PDF generation API error:", error)
    return NextResponse.json(
      {
        error: "Failed to generate PDF",
      },
      { status: 500 },
    )
  }
}

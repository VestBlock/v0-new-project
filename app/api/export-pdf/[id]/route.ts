import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import PDFDocument from "pdfkit"
import { sanitizeForJson } from "@/lib/json-utils"

// Create Supabase client
const supabaseUrl = process.env.SUPABASE_URL || ""
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Set the runtime config for the route
export const config = {
  runtime: "nodejs",
  maxDuration: 60, // Maximum duration allowed by Vercel
}

// Cache for recently generated PDFs to reduce regeneration
const pdfCache = new Map<string, { buffer: Buffer; timestamp: number }>()
const PDF_CACHE_TTL = 300000 // 5 minutes cache TTL
const MAX_PDF_CACHE_SIZE = 20 // Maximum number of PDFs to cache

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const startTime = performance.now()
  try {
    // Get the current user
    const authHeader = request.headers.get("authorization")
    let userId = null

    if (authHeader) {
      const token = authHeader.split(" ")[1]
      const {
        data: { user },
      } = await supabase.auth.getUser(token)
      userId = user?.id
    }

    // Get the analysis ID from the URL
    const analysisId = params.id

    // Check cache first
    const cacheKey = `${userId || "public"}:${analysisId}`
    const cachedPdf = pdfCache.get(cacheKey)

    if (cachedPdf && Date.now() - cachedPdf.timestamp < PDF_CACHE_TTL) {
      console.log(`Using cached PDF for analysis ${analysisId}`)

      // Return the cached PDF
      return new NextResponse(cachedPdf.buffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="vestblock-credit-analysis-${analysisId}.pdf"`,
          "X-Cache": "HIT",
          "X-Generation-Time-Ms": "0", // Cached, so generation time is 0
        },
      })
    }

    // Get the analysis from the database
    const { data: analysis, error } = await supabase.from("analyses").select("*").eq("id", analysisId).single()

    if (error || !analysis) {
      return NextResponse.json({ error: "Analysis not found" }, { status: 404 })
    }

    // Check if the user is authorized to access this analysis
    if (userId && analysis.user_id !== userId) {
      // Check if the user is an admin
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).single()

      if (!profile || profile.role !== "admin") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
    }

    // Get user information for the PDF
    const { data: userProfile } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", analysis.user_id)
      .single()

    const userName = userProfile?.full_name || "VestBlock User"
    const userEmail = userProfile?.email || ""

    // Create a PDF document with custom options
    const doc = new PDFDocument({
      margin: 50,
      size: "letter",
      info: {
        Title: `VestBlock Credit Analysis - ${analysisId}`,
        Author: "VestBlock.io",
        Subject: "Credit Report Analysis",
        Keywords: "credit, analysis, report, vestblock",
        CreationDate: new Date(),
      },
      compress: true, // Enable compression for smaller file size
    })

    const chunks: Buffer[] = []

    doc.on("data", (chunk) => {
      chunks.push(chunk)
    })

    // Promise to wait for the PDF to be generated
    const pdfPromise = new Promise<Buffer>((resolve) => {
      doc.on("end", () => {
        const result = Buffer.concat(chunks)
        resolve(result)
      })
    })

    // Helper function to add section title
    const addSectionTitle = (title: string) => {
      doc.moveDown(1)
      doc.font("Helvetica-Bold").fontSize(16).fillColor("#333333").text(title, { align: "left" })
      doc.moveDown(0.5)
    }

    // Helper function to add subsection title
    const addSubsectionTitle = (title: string) => {
      doc.moveDown(0.5)
      doc.font("Helvetica-Bold").fontSize(14).fillColor("#555555").text(title, { align: "left" })
      doc.moveDown(0.5)
    }

    // Helper function to add a paragraph
    const addParagraph = (text: string) => {
      doc.font("Helvetica").fontSize(12).fillColor("#333333").text(text, { align: "left" })
      doc.moveDown(0.5)
    }

    // Helper function to add a list item
    const addListItem = (text: string) => {
      doc.font("Helvetica").fontSize(12).fillColor("#333333").text(`• ${text}`, { align: "left", indent: 20 })
      doc.moveDown(0.25)
    }

    // Helper function to add a table
    const addTable = (headers: string[], rows: string[][]) => {
      const colWidths = [150, 350]
      const rowHeight = 20
      let y = doc.y

      // Draw headers
      doc.font("Helvetica-Bold").fontSize(12).fillColor("#333333")
      headers.forEach((header, i) => {
        doc.text(header, doc.x + (i === 0 ? 0 : colWidths[0]), y, { width: colWidths[i] })
      })

      y += rowHeight
      doc
        .moveTo(doc.x, y)
        .lineTo(doc.x + colWidths[0] + colWidths[1], y)
        .stroke()
      y += 5

      // Draw rows
      doc.font("Helvetica").fontSize(12).fillColor("#333333")
      rows.forEach((row) => {
        // Check if we need a new page
        if (y > doc.page.height - 100) {
          doc.addPage()
          y = doc.y
        }

        row.forEach((cell, i) => {
          doc.text(cell, doc.x + (i === 0 ? 0 : colWidths[0]), y, { width: colWidths[i] })
        })
        y += rowHeight * 2
      })

      doc.y = y
    }

    // Add a styled header to each page
    const addHeader = () => {
      const originalY = doc.y
      doc.font("Helvetica-Bold").fontSize(10).fillColor("#888888").text("VestBlock Credit Analysis", 50, 20)
      doc.font("Helvetica").fontSize(10).fillColor("#888888").text(new Date().toLocaleDateString(), 50, 35)
      doc.y = originalY
    }

    // Add a styled footer to each page with page numbers
    const addFooter = (pageNumber: number, totalPages: number) => {
      const footerY = doc.page.height - 50
      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor("#888888")
        .text(
          `Page ${pageNumber} of ${totalPages} | © ${new Date().getFullYear()} VestBlock.io | Confidential`,
          50,
          footerY,
          { align: "center" },
        )
    }

    // Add cover page
    doc.rect(0, 0, doc.page.width, doc.page.height).fill("#f8fafc")
    doc
      .font("Helvetica-Bold")
      .fontSize(28)
      .fillColor("#0f172a")
      .text("Credit Analysis Report", { align: "center" })
      .moveDown(0.5)
    doc
      .font("Helvetica")
      .fontSize(16)
      .fillColor("#64748b")
      .text("Prepared by VestBlock.io", { align: "center" })
      .moveDown(2)

    // Add logo placeholder
    doc
      .rect(doc.page.width / 2 - 50, doc.y, 100, 100)
      .lineWidth(1)
      .stroke()
    doc
      .font("Helvetica")
      .fontSize(14)
      .fillColor("#94a3b8")
      .text("VestBlock Logo", doc.page.width / 2 - 50, doc.y - 70, { width: 100, align: "center" })

    doc.moveDown(4)

    // Add user info
    doc.font("Helvetica-Bold").fontSize(14).fillColor("#0f172a").text("Prepared for:", { align: "center" })
    doc.font("Helvetica").fontSize(14).fillColor("#334155").text(userName, { align: "center" })
    if (userEmail) {
      doc.font("Helvetica").fontSize(14).fillColor("#334155").text(userEmail, { align: "center" })
    }
    doc.moveDown(1)

    // Add date
    doc
      .font("Helvetica")
      .fontSize(14)
      .fillColor("#334155")
      .text(`Generated on: ${new Date().toLocaleDateString()}`, { align: "center" })

    // Add disclaimer at bottom of cover page
    const disclaimerY = doc.page.height - 150
    doc
      .font("Helvetica-Oblique")
      .fontSize(10)
      .fillColor("#64748b")
      .text(
        "This report is based on the information provided in your credit report and is intended for informational purposes only. It is not financial advice. Please consult with a financial professional before making any financial decisions.",
        50,
        disclaimerY,
        { align: "center", width: doc.page.width - 100 },
      )

    // Add table of contents page
    doc.addPage()
    addHeader()
    doc.font("Helvetica-Bold").fontSize(20).fillColor("#0f172a").text("Table of Contents", { align: "center" })
    doc.moveDown(2)

    const sections = [
      { title: "1. Credit Overview", page: 3 },
      { title: "2. Dispute Recommendations", page: 4 },
      { title: "3. Credit Improvement Strategies", page: 5 },
      { title: "4. Credit Card Recommendations", page: 6 },
      { title: "5. Side Hustle Opportunities", page: 7 },
    ]

    sections.forEach((section) => {
      doc
        .font("Helvetica")
        .fontSize(14)
        .fillColor("#334155")
        .text(section.title, { continued: true })
        .fillColor("#94a3b8")
        .text(`.....................................`, { continued: true })
        .fillColor("#334155")
        .text(` ${section.page}`)
      doc.moveDown(1)
    })

    // Start actual content
    doc.addPage()

    // Add header and footer to all content pages
    const totalPages = 7 // Estimate total pages
    for (let i = 3; i <= totalPages; i++) {
      if (i > 3) doc.addPage()
      addHeader()
      addFooter(i, totalPages)
    }

    // Go back to the first content page
    doc.switchToPage(2)

    // 1. OVERVIEW SECTION
    addSectionTitle("1. Credit Overview")

    // Credit Score
    const score = analysis.result?.overview?.score || 0
    const scoreCategory = getScoreCategory(score)
    const scoreColor = getScoreColor(score)

    addSubsectionTitle("Credit Score")
    doc.font("Helvetica-Bold").fontSize(24).fillColor(scoreColor).text(score.toString(), { align: "center" })
    doc.font("Helvetica").fontSize(16).fillColor(scoreColor).text(scoreCategory, { align: "center" }).moveDown(1)

    // Score scale visualization
    const scaleWidth = 400
    const scaleHeight = 20
    const scaleX = (doc.page.width - scaleWidth) / 2
    const scaleY = doc.y

    // Draw the scale background
    doc.rect(scaleX, scaleY, scaleWidth, scaleHeight).fillColor("#e2e8f0").fill()

    // Calculate position for score marker
    const scorePosition = (score / 850) * scaleWidth

    // Draw the score marker
    doc.rect(scaleX, scaleY, scorePosition, scaleHeight).fillColor(scoreColor).fill()

    // Add scale labels
    doc.y = scaleY + scaleHeight + 5
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor("#64748b")
      .text("300", scaleX, doc.y)
      .text("850", scaleX + scaleWidth - 20, doc.y)
      .text("Poor", scaleX + scaleWidth * 0.1, doc.y + 15)
      .text("Fair", scaleX + scaleWidth * 0.3, doc.y + 15)
      .text("Good", scaleX + scaleWidth * 0.5, doc.y + 15)
      .text("Very Good", scaleX + scaleWidth * 0.7, doc.y + 15)
      .text("Excellent", scaleX + scaleWidth * 0.9, doc.y + 15)

    doc.y += 40

    // Summary
    addSubsectionTitle("Summary")
    addParagraph(analysis.result?.overview?.summary || "No summary available.")

    // Positive Factors
    addSubsectionTitle("Positive Factors")
    if (analysis.result?.overview?.positiveFactors && analysis.result.overview.positiveFactors.length > 0) {
      analysis.result.overview.positiveFactors.forEach((factor: string) => {
        addListItem(factor)
      })
    } else {
      addParagraph("No positive factors identified.")
    }

    // Negative Factors
    addSubsectionTitle("Negative Factors")
    if (analysis.result?.overview?.negativeFactors && analysis.result.overview.negativeFactors.length > 0) {
      analysis.result.overview.negativeFactors.forEach((factor: string) => {
        addListItem(factor)
      })
    } else {
      addParagraph("No negative factors identified.")
    }

    // 2. DISPUTES SECTION
    doc.addPage()
    addSectionTitle("2. Dispute Recommendations")

    if (analysis.result?.disputes?.items && analysis.result.disputes.items.length > 0) {
      addParagraph(
        "The following items on your credit report may contain errors or inaccuracies that could be disputed with the credit bureaus:",
      )

      // Create a table for disputes
      doc.moveDown(0.5)
      const disputeItems = analysis.result.disputes.items

      // Table headers
      doc.font("Helvetica-Bold").fontSize(12).fillColor("#333333")
      doc.text("Bureau", 50, doc.y, { width: 80 })
      doc.text("Account", 130, doc.y, { width: 150 })
      doc.text("Issue Type", 280, doc.y, { width: 150 })
      doc.text("Recommended Action", 430, doc.y, { width: 150 })

      doc.moveDown(0.5)
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke()
      doc.moveDown(0.5)

      // Table rows
      doc.font("Helvetica").fontSize(10).fillColor("#333333")

      disputeItems.forEach((item: any, index: number) => {
        const rowY = doc.y

        // Check if we need a new page
        if (rowY > doc.page.height - 100) {
          doc.addPage()
          addHeader()
          addFooter(doc.bufferedPageRange().start + doc.bufferedPageRange().count, totalPages)
          doc.font("Helvetica").fontSize(10).fillColor("#333333")
        }

        doc.text(item.bureau, 50, doc.y, { width: 80 })
        doc.text(item.accountName, 130, doc.y - doc.currentLineHeight(), { width: 150 })
        doc.text(item.issueType, 280, doc.y - doc.currentLineHeight(), { width: 150 })
        doc.text(item.recommendedAction, 430, doc.y - doc.currentLineHeight(), { width: 150 })

        doc.moveDown(1)

        // Add a light separator line between rows
        if (index < disputeItems.length - 1) {
          doc
            .moveTo(50, doc.y - 5)
            .lineTo(550, doc.y - 5)
            .strokeColor("#e2e8f0")
            .stroke()
          doc.strokeColor("#333333") // Reset stroke color
        }
      })

      doc.moveDown(1)
      addParagraph(
        "To dispute these items, you should write to each credit bureau reporting the error. Include copies (not originals) of documents that support your position. VestBlock can help you generate customized dispute letters for each item.",
      )
    } else {
      addParagraph(
        "No disputable items were identified in your credit report. This could mean your report is in good standing or the analysis couldn't identify any disputable items.",
      )
      addParagraph(
        "If you believe there are errors on your credit report that should be disputed, you can manually review your credit report for inaccuracies and contact the credit bureaus directly.",
      )
    }

    // Finalize the PDF
    doc.end()

    // Wait for the PDF to be generated
    const pdfBuffer = await pdfPromise

    // Cache the PDF
    if (pdfCache.size >= MAX_PDF_CACHE_SIZE) {
      // Remove the oldest entry if cache is full
      const oldestKey = [...pdfCache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp)[0][0]
      pdfCache.delete(oldestKey)
    }

    pdfCache.set(cacheKey, {
      buffer: pdfBuffer,
      timestamp: Date.now(),
    })

    const endTime = performance.now()
    const generationTime = Math.round(endTime - startTime)

    // Return the PDF
    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="vestblock-credit-analysis-${analysisId}.pdf"`,
        "X-Cache": "MISS",
        "X-Generation-Time-Ms": generationTime.toString(),
      },
    })
  } catch (error) {
    console.error("Error generating PDF:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        details: sanitizeForJson(error),
      },
      { status: 500 },
    )
  }
}

// Helper functions for styling
function getScoreCategory(score: number): string {
  if (score >= 750) return "Excellent"
  if (score >= 700) return "Very Good"
  if (score >= 650) return "Good"
  if (score >= 600) return "Fair"
  if (score >= 550) return "Poor"
  return "Very Poor"
}

function getScoreColor(score: number): string {
  if (score >= 750) return "#22c55e" // green-500
  if (score >= 700) return "#4ade80" // green-400
  if (score >= 650) return "#eab308" // yellow-500
  if (score >= 600) return "#f59e0b" // amber-500
  if (score >= 550) return "#f97316" // orange-500
  return "#ef4444" // red-500
}

function getImpactColor(impact: string): string {
  switch (impact) {
    case "high":
      return "#22c55e" // green-500
    case "medium":
      return "#eab308" // yellow-500
    case "low":
      return "#3b82f6" // blue-500
    default:
      return "#64748b" // slate-500
  }
}

function getApprovalColor(likelihood: string): string {
  switch (likelihood) {
    case "high":
      return "#22c55e" // green-500
    case "medium":
      return "#eab308" // yellow-500
    case "low":
      return "#ef4444" // red-500
    default:
      return "#64748b" // slate-500
  }
}

function getDifficultyColor(difficulty: string): string {
  switch (difficulty) {
    case "easy":
      return "#22c55e" // green-500
    case "medium":
      return "#eab308" // yellow-500
    case "hard":
      return "#ef4444" // red-500
    default:
      return "#64748b" // slate-500
  }
}

// Clear PDF cache
export function clearPdfCache(): void {
  pdfCache.clear()
  console.log("PDF cache cleared")
}

// Get PDF cache stats
export function getPdfCacheStats(): { size: number; hitRate: number } {
  return {
    size: pdfCache.size,
    hitRate: 0, // This would need to be tracked separately
  }
}

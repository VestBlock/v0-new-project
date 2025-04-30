import { type NextRequest, NextResponse } from "next/server"
import { createNotification } from "@/lib/notifications"
import { supabase } from "@/lib/supabase"

export async function POST(request: NextRequest) {
  try {
    // Authenticate the user
    const authHeader = request.headers.get("authorization")
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const token = authHeader.split(" ")[1]
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get the file from the request
    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "File size exceeds 10MB limit" }, { status: 400 })
    }

    // Check file type
    const allowedTypes = ["application/pdf", "image/jpeg", "image/png"]
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "File type not supported. Please upload a PDF, JPG, or PNG file" },
        { status: 400 },
      )
    }

    // Upload file to Supabase Storage
    const fileBuffer = await file.arrayBuffer()
    const fileName = `${user.id}/${Date.now()}-${file.name}`

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("credit-reports")
      .upload(fileName, fileBuffer, {
        contentType: file.type,
      })

    if (uploadError) {
      console.error("Upload error:", uploadError)
      return NextResponse.json({ error: "Failed to upload file" }, { status: 500 })
    }

    // Get the public URL of the uploaded file
    const {
      data: { publicUrl },
    } = supabase.storage.from("credit-reports").getPublicUrl(fileName)

    // Process the file with OCR (simulated for now)
    const ocrText = await processWithOCR(publicUrl)

    // Create an analysis record in the database
    const { data: analysisData, error: analysisError } = await supabase
      .from("analyses")
      .insert({
        user_id: user.id,
        file_path: fileName,
        ocr_text: ocrText,
        status: "processing",
      })
      .select()

    if (analysisError) {
      console.error("Analysis error:", analysisError)
      return NextResponse.json({ error: "Failed to create analysis record" }, { status: 500 })
    }

    // Create a notification for the user
    await createNotification({
      userId: user.id,
      title: "Credit Report Uploaded",
      message: "Your credit report is being processed. We'll notify you when the analysis is complete.",
      type: "info",
    })

    // Start the GPT analysis process (this would typically be done in a background job)
    const analysisId = analysisData[0].id
    processWithGPT(analysisId, ocrText, user.id)

    return NextResponse.json({ analysisId })
  } catch (error) {
    console.error("OCR error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Simulated OCR processing function
async function processWithOCR(fileUrl: string): Promise<string> {
  // In a real implementation, this would call an OCR service like Google Cloud Vision or PDF.co
  console.log("Processing file with OCR:", fileUrl)

  // Simulate processing delay
  await new Promise((resolve) => setTimeout(resolve, 1000))

  // Return sample OCR text
  return `
    CREDIT REPORT
    
    Name: John Doe
    Report Date: 04/30/2025
    
    CREDIT SCORE: 680
    
    ACCOUNTS:
    - Bank of America Credit Card
      Account #: XXXX-XXXX-XXXX-1234
      Status: Current
      Balance: $2,500
      Credit Limit: $5,000
      Payment History: Good
      
    - Chase Auto Loan
      Account #: LOAN12345
      Status: Current
      Balance: $15,000
      Original Amount: $25,000
      Payment History: Good
      
    - Capital One Credit Card
      Account #: XXXX-XXXX-XXXX-5678
      Status: Late 30 days
      Balance: $1,800
      Credit Limit: $2,000
      Payment History: Fair
      
    NEGATIVE ITEMS:
    - Collection Account
      Creditor: ABC Collections
      Original Creditor: Sprint
      Account #: COLL98765
      Amount: $450
      Status: Open
      Date Reported: 01/15/2025
      
    - Late Payment
      Creditor: Capital One
      Account #: XXXX-XXXX-XXXX-5678
      Date: 03/15/2025
      Status: 30 days late
  `
}

// Simulated GPT analysis function
async function processWithGPT(analysisId: string, ocrText: string, userId: string) {
  try {
    // In a real implementation, this would call OpenAI's API
    console.log("Processing with GPT:", analysisId)

    // Simulate processing delay
    await new Promise((resolve) => setTimeout(resolve, 3000))

    // Sample analysis result
    const analysisResult = {
      overview: {
        score: 680,
        summary:
          "Your credit score is in the 'Fair' range. You have a mix of positive and negative factors affecting your score. With some targeted improvements, you could move into the 'Good' range within 3-6 months.",
        positiveFactors: [
          "Long credit history with established accounts",
          "Good payment history on most accounts",
          "Diverse credit mix with revolving and installment accounts",
        ],
        negativeFactors: [
          "High credit utilization on Capital One card (90%)",
          "Recent 30-day late payment on Capital One account",
          "Collection account from ABC Collections",
          "Overall credit utilization is above recommended 30%",
        ],
      },
      disputes: {
        items: [
          {
            bureau: "All Bureaus",
            accountName: "ABC Collections",
            accountNumber: "COLL98765",
            issueType: "Collection Account",
            recommendedAction: "Dispute - Request Validation",
          },
          {
            bureau: "All Bureaus",
            accountName: "Capital One",
            accountNumber: "XXXX-XXXX-XXXX-5678",
            issueType: "Late Payment",
            recommendedAction: "Goodwill Letter",
          },
        ],
      },
      creditHacks: {
        recommendations: [
          {
            title: "Reduce Credit Utilization",
            description: "Pay down your Capital One card to below 30% utilization to see a quick score improvement.",
            impact: "high",
            timeframe: "1-2 months",
          },
          {
            title: "Request Credit Limit Increase",
            description: "Ask Bank of America for a credit limit increase to improve your overall utilization ratio.",
            impact: "medium",
            timeframe: "1 month",
          },
          {
            title: "Become an Authorized User",
            description: "Ask a family member with excellent credit to add you as an authorized user on their card.",
            impact: "medium",
            timeframe: "1-2 months",
          },
          {
            title: "Set Up Automatic Payments",
            description: "Configure automatic payments for at least the minimum due to prevent future late payments.",
            impact: "high",
            timeframe: "Immediate",
          },
        ],
      },
      sideHustles: {
        recommendations: [
          {
            title: "Freelance Writing",
            description: "Leverage your writing skills to create content for blogs, websites, and businesses.",
            potentialEarnings: "$500-$2,000/month",
            startupCost: "$0-$100",
            difficulty: "easy",
          },
          {
            title: "Food Delivery",
            description: "Work with apps like DoorDash, Uber Eats, or Grubhub to deliver food on your own schedule.",
            potentialEarnings: "$15-$25/hour",
            startupCost: "$0",
            difficulty: "easy",
          },
          {
            title: "Virtual Assistant",
            description: "Provide administrative support to businesses or entrepreneurs remotely.",
            potentialEarnings: "$15-$30/hour",
            startupCost: "$0-$50",
            difficulty: "medium",
          },
          {
            title: "Online Tutoring",
            description: "Teach subjects you're knowledgeable about through platforms like Wyzant or Chegg.",
            potentialEarnings: "$20-$50/hour",
            startupCost: "$0",
            difficulty: "medium",
          },
        ],
      },
    }

    // Update the analysis record in the database
    const { error } = await supabase
      .from("analyses")
      .update({
        status: "completed",
        result: analysisResult,
        completed_at: new Date().toISOString(),
      })
      .eq("id", analysisId)

    if (error) {
      console.error("Update analysis error:", error)
      return
    }

    // Create a notification for the user
    await createNotification({
      userId,
      title: "Credit Analysis Complete",
      message: `Your credit analysis is ready. Your credit score is ${analysisResult.overview.score}.`,
      type: "success",
    })
  } catch (error) {
    console.error("GPT analysis error:", error)

    // Update the analysis record with error status
    await supabase
      .from("analyses")
      .update({
        status: "error",
        completed_at: new Date().toISOString(),
      })
      .eq("id", analysisId)

    // Create an error notification for the user
    await createNotification({
      userId,
      title: "Analysis Failed",
      message: "We encountered an error processing your credit report. Please try uploading it again.",
      type: "error",
    })
  }
}

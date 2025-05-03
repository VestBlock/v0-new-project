import type { NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { analyzeCredit } from "@/lib/openai-realtime-service"
import { createNotification } from "@/lib/notifications"
import { NextResponse } from "next/server"

// Configure for longer execution time
export const config = {
  runtime: "nodejs",
  maxDuration: 60, // 1 minute for demo analysis
}

// Create Supabase client with safety checks
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""
let supabase: ReturnType<typeof createClient> | null = null

if (supabaseUrl && supabaseServiceKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseServiceKey)
  } catch (error) {
    console.error("Failed to initialize Supabase client:", error)
  }
}

export async function POST(request: NextRequest) {
  console.log("[CREATE-DEMO] API route called")
  const startTime = performance.now()

  try {
    // Verify Supabase client is available
    if (!supabase) {
      return NextResponse.json({ success: false, error: "Database connection unavailable" }, { status: 500 })
    }

    // Get the current user
    const authHeader = request.headers.get("authorization")
    if (!authHeader) {
      console.error("No authorization header provided")
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const token = authHeader.split(" ")[1]
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token)

    if (authError || !user) {
      console.error("Authentication error:", authError)
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    console.log("[CREATE-DEMO] User authenticated:", user.id)

    // Create a notification for the user that demo analysis is starting
    try {
      await createNotification({
        userId: user.id,
        title: "Demo Analysis Started",
        message: "Your demo credit report is being analyzed with real-time AI.",
        type: "info",
      })
    } catch (notifError) {
      console.error("Failed to create start notification:", notifError)
      // Continue anyway, this is not critical
    }

    // Create a demo credit report text
    const demoText = `
CREDIT REPORT

Personal Information:
Name: John Doe
SSN: XXX-XX-1234
Date of Birth: 01/15/1985
Address: 123 Main St, Anytown, USA 12345

Credit Score: 720

Accounts Summary:
Total Accounts: 9
Open Accounts: 8
Closed Accounts: 1
Derogatory Accounts: 1
Total Balance: $302,500
Total Monthly Payment: $3,200

Account Details:

1. CHASE BANK
   Account Type: Credit Card
   Account Number: XXXX-XXXX-XXXX-5678
   Date Opened: 05/2015
   Credit Limit: $10,000
   Current Balance: $3,500
   Payment Status: Current
   Payment History: 
     30 days late: 0
     60 days late: 0
     90+ days late: 0

2. BANK OF AMERICA
   Account Type: Credit Card
   Account Number: XXXX-XXXX-XXXX-9012
   Date Opened: 08/2016
   Credit Limit: $8,000
   Current Balance: $2,200
   Payment Status: Current
   Payment History: 
     30 days late: 1 (03/2023)
     60 days late: 0
     90+ days late: 0

3. DISCOVER
   Account Type: Credit Card
   Account Number: XXXX-XXXX-XXXX-3456
   Date Opened: 02/2017
   Credit Limit: $7,500
   Current Balance: $1,800
   Payment Status: Current
   Payment History: 
     30 days late: 0
     60 days late: 0
     90+ days late: 0

4. AMERICAN EXPRESS
   Account Type: Credit Card
   Account Number: XXXX-XXXX-XXXX-7890
   Date Opened: 11/2018
   Credit Limit: $12,000
   Current Balance: $4,500
   Payment Status: Current
   Payment History: 
     30 days late: 0
     60 days late: 0
     90+ days late: 0

5. CAPITAL ONE
   Account Type: Credit Card
   Account Number: XXXX-XXXX-XXXX-1234
   Date Opened: 03/2019
   Credit Limit: $5,000
   Current Balance: $0
   Payment Status: Current
   Payment History: 
     30 days late: 0
     60 days late: 0
     90+ days late: 0

6. TOYOTA FINANCIAL
   Account Type: Auto Loan
   Account Number: XXXXXX5678
   Date Opened: 07/2020
   Original Amount: $25,000
   Current Balance: $15,000
   Payment Status: Current
   Payment History: 
     30 days late: 1 (01/2023)
     60 days late: 0
     90+ days late: 0

7. WELLS FARGO
   Account Type: Mortgage
   Account Number: XXXXXX9012
   Date Opened: 09/2019
   Original Amount: $300,000
   Current Balance: $250,000
   Payment Status: Current
   Payment History: 
     30 days late: 0
     60 days late: 0
     90+ days late: 0

8. SALLIE MAE
   Account Type: Student Loan
   Account Number: XXXXXX3456
   Date Opened: 08/2010
   Original Amount: $40,000
   Current Balance: $25,000
   Payment Status: Current
   Payment History: 
     30 days late: 0
     60 days late: 0
     90+ days late: 0

9. ABC COLLECTIONS
   Account Type: Collection
   Account Number: XXXXXX7890
   Date Opened: 04/2022
   Original Creditor: MEDICAL CLINIC
   Original Amount: $800
   Current Balance: $500
   Status: Open
   
Inquiries (Last 2 Years):
1. CAPITAL ONE - 02/15/2023
2. CITI BANK - 05/10/2023
3. SYNCHRONY BANK - 08/22/2023

Public Records:
None
`

    // Convert text to buffer
    const textEncoder = new TextEncoder()
    const fileBuffer = textEncoder.encode(demoText).buffer
    const fileName = "demo-credit-report.txt"

    // Process with our real-time OpenAI service
    const analysisResult = await analyzeCredit(fileBuffer, fileName, user.id, {
      signal: AbortSignal.timeout(55000), // 55 second timeout
      priority: "high",
      notifyUser: true,
    })

    if (!analysisResult.success) {
      console.error("Demo analysis failed:", analysisResult.error)

      // Create an error notification for the user
      try {
        await createNotification({
          userId: user.id,
          title: "Demo Analysis Failed",
          message: `We encountered an error analyzing your demo credit report: ${analysisResult.error.message}. Please try again.`,
          type: "error",
        })
      } catch (notifError) {
        console.error("Failed to create error notification:", notifError)
      }

      return NextResponse.json(
        {
          success: false,
          error: "Failed to analyze demo credit report",
          details: analysisResult.error,
          analysisId: analysisResult.analysisId,
        },
        { status: 500 },
      )
    }

    console.log("[CREATE-DEMO] Demo analysis completed successfully")

    // Create a success notification for the user
    try {
      await createNotification({
        userId: user.id,
        title: "Demo Analysis Complete",
        message: "Your demo credit analysis is ready.",
        type: "success",
      })
    } catch (notificationError) {
      console.error("Failed to create success notification:", notificationError)
    }

    const endTime = performance.now()

    return NextResponse.json({
      success: true,
      analysisId: analysisResult.analysisId,
      result: analysisResult.result,
      metrics: {
        ...analysisResult.metrics,
        totalProcessingTimeMs: Math.round(endTime - startTime),
      },
    })
  } catch (error) {
    console.error("[CREATE-DEMO] API error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

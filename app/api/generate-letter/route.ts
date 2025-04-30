import { type NextRequest, NextResponse } from "next/server"
import { createDisputeLetter } from "@/lib/disputes"
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

    // Get request body
    const body = await request.json()
    const { analysisId, bureau, accountName, accountNumber, issueType } = body

    if (!analysisId || !bureau || !accountName || !accountNumber || !issueType) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Verify the analysis belongs to the user
    const { data: analysis, error: analysisError } = await supabase
      .from("analyses")
      .select("*")
      .eq("id", analysisId)
      .eq("user_id", user.id)
      .single()

    if (analysisError || !analysis) {
      return NextResponse.json({ error: "Analysis not found" }, { status: 404 })
    }

    // Generate the dispute letter content
    const letterContent = generateDisputeLetterContent(bureau, accountName, accountNumber, issueType, user.email)

    // Save the dispute letter
    const {
      success,
      data: letter,
      error,
    } = await createDisputeLetter({
      userId: user.id,
      analysisId,
      bureau,
      accountName,
      accountNumber,
      issueType,
      letterContent,
    })

    if (!success || error) {
      return NextResponse.json({ error: "Failed to create dispute letter" }, { status: 500 })
    }

    // Create a notification
    await createNotification({
      userId: user.id,
      title: "Dispute Letter Generated",
      message: `Your dispute letter for ${accountName} has been generated.`,
      type: "success",
    })

    return NextResponse.json({ letter })
  } catch (error) {
    console.error("Error generating dispute letter:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

function generateDisputeLetterContent(
  bureau: string,
  accountName: string,
  accountNumber: string,
  issueType: string,
  userEmail: string,
): string {
  const date = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  const bureauAddresses: Record<string, string> = {
    Experian: "P.O. Box 4500\nAllen, TX 75013",
    Equifax: "P.O. Box 740256\nAtlanta, GA 30374",
    TransUnion: "P.O. Box 2000\nChester, PA 19016",
  }

  const bureauAddress = bureauAddresses[bureau] || bureauAddresses.Experian

  let letterBody = ""

  switch (issueType) {
    case "Collection Account":
      letterBody = `I am writing to dispute a collection account that appears on my credit report. The account in question is with ${accountName}, account number ${accountNumber}.

This account is inaccurate because:
- I have no record of this debt
- I have not received proper validation of this debt as required by the Fair Debt Collection Practices Act
- The information reported is incomplete or incorrect

Under the Fair Credit Reporting Act, you are required to verify this information with the original creditor or delete it from my credit report. Please investigate this matter and remove this collection account from my credit report.`
      break

    case "Late Payment":
      letterBody = `I am writing to dispute a late payment that appears on my credit report. The account in question is with ${accountName}, account number ${accountNumber}.

This late payment is inaccurate because:
- I have always made payments on time for this account
- I have documentation showing the payment was made before the due date
- This was a one-time oversight due to extenuating circumstances

I request that you investigate this matter and remove the late payment notation from my credit report. I have been a customer in good standing and this isolated incident does not accurately reflect my payment history.`
      break

    case "Incorrect Balance":
      letterBody = `I am writing to dispute an incorrect balance that appears on my credit report. The account in question is with ${accountName}, account number ${accountNumber}.

The balance reported is inaccurate because:
- I have made payments that are not reflected in the current balance
- The balance includes fees or charges that were not authorized
- The account has been paid in full or settled

Please investigate this matter and update my credit report to reflect the correct balance for this account.`
      break

    default:
      letterBody = `I am writing to dispute information that appears on my credit report. The account in question is with ${accountName}, account number ${accountNumber}.

This information is inaccurate because:
- The information does not belong to me
- The information is outdated or obsolete
- The information is incomplete or incorrect

Under the Fair Credit Reporting Act, you are required to investigate this dispute and correct any inaccurate information. Please review this matter and make the necessary corrections to my credit report.`
  }

  return `${date}

${bureauAddress}

Re: Dispute of Inaccurate Information in Credit Report

To Whom It May Concern:

My name is [YOUR FULL NAME] and my Social Security Number is [YOUR SSN]. I am writing to dispute inaccurate information that appears on my credit report.

${letterBody}

As required by the Fair Credit Reporting Act, please investigate this matter and provide me with the results of your investigation. If you cannot verify this information, please remove it from my credit report.

Please send me a corrected copy of my credit report at the address below.

Thank you for your prompt attention to this matter.

Sincerely,

[YOUR SIGNATURE]

[YOUR FULL NAME]
[YOUR ADDRESS]
[YOUR CITY, STATE ZIP]
[YOUR PHONE NUMBER]
${userEmail}

Enclosures: [LIST ANY SUPPORTING DOCUMENTS]`
}

import { NextResponse } from "next/server"
import { createChatCompletion } from "@/lib/openai-service"

export async function POST(req: Request) {
  try {
    const { letterType, creditorName, accountNumber, customDetails } = await req.json()

    if (!letterType || !creditorName) {
      return NextResponse.json(
        {
          error: "Missing required parameters",
        },
        { status: 400 },
      )
    }

    // Create a prompt based on the letter type
    let prompt = `Generate a professional ${letterType} letter to ${creditorName}`

    if (accountNumber) {
      prompt += ` regarding account number ${accountNumber}`
    }

    if (customDetails) {
      prompt += `. Additional context: ${customDetails}`
    }

    prompt += `. The letter should be formal, cite relevant laws (like FCRA, FDCPA), and be effective for credit repair purposes. Format it as a proper business letter without the header/signature parts.`

    // Add specific instructions based on letter type
    switch (letterType) {
      case "609":
        prompt += ` This should be a 609 dispute letter that requests validation of the debt and questions the creditor's ability to verify the debt. Cite Section 609 of the FCRA.`
        break
      case "debt_validation":
        prompt += ` This should be a debt validation letter that requests proof that the debt is valid and belongs to me. Cite the FDCPA requirements for debt validation.`
        break
      case "goodwill":
        prompt += ` This should be a goodwill letter that acknowledges the debt but politely asks for the negative mark to be removed as a courtesy, explaining that it was due to unusual circumstances and my payment history has otherwise been good.`
        break
      case "pay_for_delete":
        prompt += ` This should be a pay-for-delete letter offering to pay the debt in exchange for complete removal from my credit report. Make it clear that payment is contingent on this agreement.`
        break
      case "cease_and_desist":
        prompt += ` This should be a cease and desist letter demanding that the creditor/collector stop all communication except to confirm they're ceasing collection activities or taking specific actions. Cite the FDCPA.`
        break
    }

    // Format messages for OpenAI
    const messages = [
      {
        role: "system",
        content:
          "You are an expert in credit repair and financial law. Generate professional, legally sound dispute letters that help consumers exercise their rights under laws like the FCRA and FDCPA.",
      },
      {
        role: "user",
        content: prompt,
      },
    ]

    // Use our direct fetch service
    const response = await createChatCompletion(messages, false)
    const letterContent = (response as any).choices[0].message.content

    return NextResponse.json({ content: letterContent })
  } catch (error: any) {
    console.error("Letter generation API error:", error)
    return NextResponse.json(
      {
        error: "Failed to generate letter",
        details: error.message,
      },
      { status: 500 },
    )
  }
}

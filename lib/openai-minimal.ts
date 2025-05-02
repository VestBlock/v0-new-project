/**
 * Minimal OpenAI client with direct API calls
 * No mock data, no complexity - just direct API calls
 */

// Direct OpenAI API call with fetch
export async function callOpenAI(prompt: string, model = "gpt-4o") {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not defined")
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${JSON.stringify(error)}`)
  }

  const data = await response.json()
  return data.choices[0].message.content
}

// Process credit report text
export async function processCreditReportText(text: string) {
  return callOpenAI(
    `Extract the credit score and all important information from this credit report text: ${text}. Format as JSON with fields: score (number), accountSummary (text), negativeItems (array), positiveItems (array).`,
  )
}

// Process credit report with vision API - only for image files
export async function processCreditReportImage(base64Image: string) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not defined")
  }

  // Make sure the base64 string is properly formatted for the API
  // It should start with data:image format
  if (!base64Image.startsWith("data:image")) {
    throw new Error("Invalid image format. Only image types (JPEG, PNG) are supported.")
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract the credit score and all important information from this credit report. Format as JSON with fields: score (number), accountSummary (text), negativeItems (array), positiveItems (array).",
            },
            {
              type: "image_url",
              image_url: {
                url: base64Image,
                detail: "high",
              },
            },
          ],
        },
      ],
      temperature: 0.3,
    }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${JSON.stringify(error)}`)
  }

  const data = await response.json()
  return data.choices[0].message.content
}

// Simple chat function
export async function chatWithAI(message: string, history: Array<{ role: string; content: string }> = []) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not defined")
  }

  const messages = [...history, { role: "user", content: message }]

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages,
      temperature: 0.7,
    }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${JSON.stringify(error)}`)
  }

  const data = await response.json()
  return data.choices[0].message.content
}

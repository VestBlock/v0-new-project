import "server-only"

const PDFCO_API_KEY = process.env.PDFCO_API_KEY
const PDFCO_BASE_URL = "https://api.pdf.co/v1"

if (!PDFCO_API_KEY) {
  console.warn(
    "[PDF.co Service] PDF.co API key (PDFCO_API_KEY) is not configured. PDF.co functionalities will be disabled.",
  )
}

interface PdfCoJobStatusResponse {
  url?: string
  jobId: string
  status: "working" | "failed" | "success" | "aborted" | string
  error?: boolean
  errorCode?: number
  errorDetails?: string
  remainingCredits: number
  name?: string
  // ... other potential fields
}

export async function checkPdfCoJobStatus(jobId: string): Promise<PdfCoJobStatusResponse> {
  if (!PDFCO_API_KEY) {
    throw new Error("PDF.co API key is not configured.")
  }

  const url = `${PDFCO_BASE_URL}/job/check?jobid=${jobId}`
  console.log(`[PDF.co Service] Checking job status for ${jobId} at ${url}`)

  try {
    const response = await fetch(url, {
      method: "POST", // PDF.co job check is often a POST with jobid in body or GET with query param. Docs say POST for /job/check
      headers: {
        "x-api-key": PDFCO_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ jobid: jobId }), // Some endpoints might prefer jobid in query
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(
        `[PDF.co Service] Error checking job status ${jobId}: ${response.status} ${response.statusText}`,
        errorText,
      )
      throw new Error(`PDF.co API error: ${response.status} ${response.statusText} - ${errorText}`)
    }

    const data: PdfCoJobStatusResponse = await response.json()
    console.log(`[PDF.co Service] Job status for ${jobId}:`, JSON.stringify(data, null, 2))
    return data
  } catch (error) {
    console.error(`[PDF.co Service] Exception checking job status ${jobId}:`, error)
    throw error
  }
}

export async function downloadTextFile(fileUrl: string): Promise<string> {
  if (!fileUrl) {
    throw new Error("File URL must be provided to download text file.")
  }
  console.log(`[PDF.co Service] Downloading text file from ${fileUrl}`)
  try {
    const response = await fetch(fileUrl)
    if (!response.ok) {
      const errorText = await response.text()
      console.error(
        `[PDF.co Service] Error downloading file ${fileUrl}: ${response.status} ${response.statusText}`,
        errorText,
      )
      throw new Error(`Failed to download file: ${response.status} ${response.statusText} - ${errorText}`)
    }
    const textContent = await response.text()
    console.log(`[PDF.co Service] Successfully downloaded text file from ${fileUrl}. Length: ${textContent.length}`)
    return textContent
  } catch (error) {
    console.error(`[PDF.co Service] Exception downloading file ${fileUrl}:`, error)
    throw error
  }
}

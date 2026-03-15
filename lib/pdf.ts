export async function generatePDF(html: string, fileName: string): Promise<string> {
  try {
    const apiKey = process.env.VITE_PDFCO_API_KEY

    if (!apiKey) {
      throw new Error("PDF.co API key is not configured")
    }

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

    const data = await response.json()

    if (data.error) {
      throw new Error(data.error)
    }

    return data.url
  } catch (error) {
    console.error("PDF generation error:", error)
    throw error
  }
}

import { createClient } from "@supabase/supabase-js"

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Function to extract text from PDF using pdf.js (browser-based solution)
export async function extractTextFromPDF(fileUrl: string): Promise<string> {
  try {
    // Fetch the PDF file
    const response = await fetch(fileUrl)
    if (!response.ok) {
      throw new Error(`Failed to fetch PDF: ${response.statusText}`)
    }

    const pdfData = await response.arrayBuffer()

    // Use pdf.js to extract text (this would be implemented in the browser)
    // For server-side, we'd need to use a different approach
    // This is a placeholder for the actual implementation
    const text = await extractTextFromPDFBuffer(pdfData)

    return text
  } catch (error) {
    console.error("Error extracting text from PDF:", error)
    throw new Error(`Failed to extract text from PDF: ${error instanceof Error ? error.message : String(error)}`)
  }
}

// This function would use pdf.js in the browser
// For server-side, we'd need a different implementation
async function extractTextFromPDFBuffer(pdfBuffer: ArrayBuffer): Promise<string> {
  // In a real implementation, this would use pdf.js
  // For now, we'll just return a placeholder
  return "PDF text extraction placeholder"
}

// Function to upload a file to Supabase Storage
export async function uploadFileToStorage(file: File, bucket: string, path: string): Promise<string> {
  try {
    const { data, error } = await supabase.storage.from(bucket).upload(path, file, {
      cacheControl: "3600",
      upsert: true,
    })

    if (error) {
      throw error
    }

    // Get the public URL for the uploaded file
    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path)

    return urlData.publicUrl
  } catch (error) {
    console.error("Error uploading file to storage:", error)
    throw new Error(`Failed to upload file: ${error instanceof Error ? error.message : String(error)}`)
  }
}

// Function to save extracted text to Supabase
export async function saveExtractedText(userId: string, fileUrl: string, extractedText: string): Promise<void> {
  try {
    const { error } = await supabase.from("extracted_texts").insert({
      user_id: userId,
      file_url: fileUrl,
      text_content: extractedText,
      created_at: new Date().toISOString(),
    })

    if (error) {
      throw error
    }
  } catch (error) {
    console.error("Error saving extracted text:", error)
    throw new Error(`Failed to save extracted text: ${error instanceof Error ? error.message : String(error)}`)
  }
}

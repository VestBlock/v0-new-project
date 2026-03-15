/**
 * Semantic Chunking - Intelligently splits documents based on content structure
 * Specialized for credit reports and financial documents
 */

// Define section types for credit reports
export type SectionType =
  | "header"
  | "personal"
  | "summary"
  | "accounts"
  | "negative"
  | "inquiries"
  | "public"
  | "unknown"

export interface DocumentSection {
  type: SectionType
  content: string
  metadata?: {
    title?: string
    confidence: number
  }
}

export interface ChunkingOptions {
  maxChunkSize?: number
  overlapSize?: number
  preserveStructure?: boolean
  includeContext?: boolean
}

const DEFAULT_OPTIONS: ChunkingOptions = {
  maxChunkSize: 8000,
  overlapSize: 200,
  preserveStructure: true,
  includeContext: true,
}

/**
 * Identifies the structure of a credit report and splits it into semantic sections
 */
export function identifyCreditReportSections(text: string): DocumentSection[] {
  // Common section headers in credit reports
  const sectionPatterns = [
    { type: "header", pattern: /^.{0,500}(credit\s+report|credit\s+file|credit\s+profile)/i, confidence: 0.9 },
    {
      type: "personal",
      pattern: /(personal\s+information|consumer\s+information|profile\s+information)/i,
      confidence: 0.9,
    },
    { type: "summary", pattern: /(credit\s+summary|score\s+summary|credit\s+score)/i, confidence: 0.9 },
    { type: "accounts", pattern: /(accounts(\s+in\s+good\s+standing)?|satisfactory\s+accounts)/i, confidence: 0.8 },
    {
      type: "negative",
      pattern: /(negative\s+accounts|adverse\s+accounts|potentially\s+negative\s+items)/i,
      confidence: 0.9,
    },
    { type: "inquiries", pattern: /(inquiries|requests\s+viewed\s+by\s+others)/i, confidence: 0.8 },
    { type: "public", pattern: /(public\s+records|public\s+record\s+information)/i, confidence: 0.8 },
  ]

  // Find all potential section headers
  const potentialSections: Array<{ type: SectionType; position: number; title: string; confidence: number }> = []

  // Find matches for each pattern
  for (const { type, pattern, confidence } of sectionPatterns) {
    const matches = [...text.matchAll(new RegExp(pattern, "gi"))]
    for (const match of matches) {
      if (match.index !== undefined) {
        // Get the full line containing the match for better context
        const lineStart = text.lastIndexOf("\n", match.index) + 1
        const lineEnd = text.indexOf("\n", match.index)
        const line = text.substring(lineStart, lineEnd > -1 ? lineEnd : text.length)

        potentialSections.push({
          type,
          position: match.index,
          title: line.trim(),
          confidence,
        })
      }
    }
  }

  // Sort sections by position
  potentialSections.sort((a, b) => a.position - b.position)

  // Create document sections
  const sections: DocumentSection[] = []

  // If no sections found, treat the whole document as unknown
  if (potentialSections.length === 0) {
    return [
      {
        type: "unknown",
        content: text,
        metadata: {
          confidence: 0.5,
        },
      },
    ]
  }

  // Process each section
  for (let i = 0; i < potentialSections.length; i++) {
    const current = potentialSections[i]
    const nextPosition = i < potentialSections.length - 1 ? potentialSections[i + 1].position : text.length

    // Extract section content
    const sectionContent = text.substring(current.position, nextPosition).trim()

    // Only add if section has meaningful content
    if (sectionContent.length > 50) {
      sections.push({
        type: current.type,
        content: sectionContent,
        metadata: {
          title: current.title,
          confidence: current.confidence,
        },
      })
    }
  }

  // If first section doesn't start at beginning, add an unknown section
  if (potentialSections[0].position > 0) {
    const headerContent = text.substring(0, potentialSections[0].position).trim()
    if (headerContent.length > 0) {
      sections.unshift({
        type: "header",
        content: headerContent,
        metadata: {
          confidence: 0.7,
        },
      })
    }
  }

  return sections
}

/**
 * Splits a large section into smaller chunks while preserving structure
 */
function splitSectionIntoChunks(
  section: DocumentSection,
  options: ChunkingOptions = DEFAULT_OPTIONS,
): DocumentSection[] {
  const { maxChunkSize = 8000, overlapSize = 200 } = options
  const { content, type } = section

  // If section is small enough, return as is
  if (content.length <= maxChunkSize) {
    return [section]
  }

  const chunks: DocumentSection[] = []
  let startIndex = 0

  // Add section context to each chunk
  const contextPrefix = section.metadata?.title
    ? `SECTION: ${section.metadata.title}\n\n`
    : `SECTION: ${type.toUpperCase()}\n\n`

  while (startIndex < content.length) {
    // Calculate end index for this chunk
    let endIndex = startIndex + maxChunkSize - contextPrefix.length

    // Don't exceed content length
    if (endIndex > content.length) {
      endIndex = content.length
    } else {
      // Try to break at paragraph
      const paragraphBreak = content.lastIndexOf("\n\n", endIndex)
      if (paragraphBreak > startIndex && paragraphBreak > endIndex - 500) {
        endIndex = paragraphBreak
      } else {
        // Try to break at line
        const lineBreak = content.lastIndexOf("\n", endIndex)
        if (lineBreak > startIndex && lineBreak > endIndex - 200) {
          endIndex = lineBreak
        } else {
          // Try to break at sentence
          const sentenceBreak = findLastSentenceBreak(content, startIndex, endIndex)
          if (sentenceBreak > startIndex) {
            endIndex = sentenceBreak
          }
        }
      }
    }

    // Extract chunk content with context prefix
    const chunkContent = contextPrefix + content.substring(startIndex, endIndex).trim()

    // Create chunk with same type as parent section
    chunks.push({
      type,
      content: chunkContent,
      metadata: {
        ...section.metadata,
        title: `${section.metadata?.title || type} (part ${chunks.length + 1})`,
      },
    })

    // Move to next chunk with overlap
    startIndex = endIndex - overlapSize

    // Ensure we're making progress
    if (startIndex >= content.length || endIndex === content.length) {
      break
    }
  }

  return chunks
}

/**
 * Finds the last sentence break in a text range
 */
function findLastSentenceBreak(text: string, startIndex: number, endIndex: number): number {
  // Look for common sentence endings
  for (let i = endIndex; i > startIndex + 100; i--) {
    if (
      i < text.length &&
      (text[i] === "." || text[i] === "!" || text[i] === "?") &&
      (i + 1 >= text.length || text[i + 1] === " " || text[i + 1] === "\n")
    ) {
      return i + 1
    }
  }

  // If no sentence break found, look for space
  const lastSpace = text.lastIndexOf(" ", endIndex)
  if (lastSpace > startIndex + 100) {
    return lastSpace
  }

  // If all else fails, just use the end index
  return endIndex
}

/**
 * Semantically chunks a document based on its structure
 */
export function semanticChunkDocument(text: string, options: ChunkingOptions = DEFAULT_OPTIONS): DocumentSection[] {
  // Identify document sections
  const sections = identifyCreditReportSections(text)

  // Process each section into appropriate chunks
  const allChunks: DocumentSection[] = []

  for (const section of sections) {
    const sectionChunks = splitSectionIntoChunks(section, options)
    allChunks.push(...sectionChunks)
  }

  return allChunks
}

/**
 * Gets an optimized system prompt based on the section type
 */
export function getOptimizedPromptForSection(section: DocumentSection): string {
  // Base prompt for all section types
  const basePrompt = `You are a specialized financial AI assistant analyzing a credit report section.`

  // Section-specific instructions
  const sectionInstructions: Record<SectionType, string> = {
    header: `Extract the credit bureau name and report date if present. Look for information about the report source.`,

    personal: `Extract personal information including name, address, SSN (last 4 digits only), and any credit score mentioned. 
If a credit score is found, note its source (e.g., FICO, VantageScore) and the range (typically 300-850).`,

    summary: `Focus on identifying the credit score, its source, and any summary statistics about accounts.
Look for numbers between 300-850 labeled as "score", "FICO", etc. Also extract any account summary information.`,

    accounts: `Extract details about each account including:
- Creditor name
- Account number (last 4 digits only)
- Account type (revolving, installment, etc.)
- Balance
- Credit limit or original amount
- Payment status
- Payment history
Flag any accounts that show late payments, collections, or other negative status.`,

    negative: `Carefully extract all negative items including:
- Late payments (30/60/90+ days)
- Collections
- Charge-offs
- Any other derogatory marks
Include the creditor name, account number (last 4 digits), and specific negative status for each item.`,

    inquiries: `List all credit inquiries with:
- Company name
- Date of inquiry
- Type of inquiry (hard or soft if specified)`,

    public: `Extract any public records such as:
- Bankruptcies
- Liens
- Judgments
- Other court records
Include filing dates and status for each record.`,

    unknown: `Analyze this section to determine if it contains credit report information.
Look for credit scores, account details, personal information, or any other relevant financial data.`,
  }

  // Output format instructions
  const outputFormat = `
OUTPUT FORMAT:
Return ONLY a valid JSON object with fields relevant to this section type.
If you can't find certain information, use null or empty arrays.
Focus on accuracy over completeness.`

  // Combine the prompts
  return `${basePrompt}

SECTION TYPE: ${section.type.toUpperCase()}

INSTRUCTIONS:
${sectionInstructions[section.type]}

${outputFormat}`
}

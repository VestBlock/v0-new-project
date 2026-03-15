export interface Account {
  creditor: string
  accountNumber?: string
  accountType?: string
  balance?: string
  creditLimit?: string
  paymentStatus?: string
  dateOpened?: string
  lastReported?: string
  isNegative: boolean
  remarks?: string[]
}

export interface NegativeItem {
  creditor: string
  accountNumber?: string
  issueType: string
  dateReported?: string
  details: string
}

export interface Inquiry {
  creditor: string
  date?: string
  type?: string
}

export interface PublicRecord {
  type: string
  date?: string
  amount?: string
  details: string
}

export interface CreditReportData {
  creditScore?: number
  bureau?: string
  reportDate?: string
  personalInfo?: {
    name?: string
    ssn?: string
    dateOfBirth?: string
    addresses?: string[]
  }
  accounts: Account[]
  negativeItems: NegativeItem[]
  inquiries: Inquiry[]
  publicRecords: PublicRecord[]
  metadata: {
    extractionConfidence: number
    extractionMethod: string
    extractionNotes: string[]
  }
}

/**
 * Extract credit report data using comprehensive regex patterns
 */
export function extractCreditReportData(text: string): CreditReportData {
  const result: CreditReportData = {
    accounts: [],
    negativeItems: [],
    inquiries: [],
    publicRecords: [],
    metadata: {
      extractionConfidence: 0,
      extractionMethod: "regex",
      extractionNotes: [],
    },
  }

  // Extract credit score
  const scoreData = extractCreditScore(text)
  if (scoreData.score) {
    result.creditScore = scoreData.score
    result.metadata.extractionNotes.push(`Credit score found: ${scoreData.score} (confidence: ${scoreData.confidence})`)
  }

  // Extract bureau information
  const bureauData = extractBureauInfo(text)
  if (bureauData.bureau) {
    result.bureau = bureauData.bureau
  }
  if (bureauData.reportDate) {
    result.reportDate = bureauData.reportDate
  }

  // Extract accounts
  result.accounts = extractAccounts(text)
  if (result.accounts.length > 0) {
    result.metadata.extractionNotes.push(`Found ${result.accounts.length} accounts`)
  }

  // Extract negative items
  result.negativeItems = extractNegativeItems(text)
  if (result.negativeItems.length > 0) {
    result.metadata.extractionNotes.push(`Found ${result.negativeItems.length} negative items`)
  }

  // Extract inquiries
  result.inquiries = extractInquiries(text)
  if (result.inquiries.length > 0) {
    result.metadata.extractionNotes.push(`Found ${result.inquiries.length} inquiries`)
  }

  // Extract public records
  result.publicRecords = extractPublicRecords(text)
  if (result.publicRecords.length > 0) {
    result.metadata.extractionNotes.push(`Found ${result.publicRecords.length} public records`)
  }

  // Calculate extraction confidence
  result.metadata.extractionConfidence = calculateConfidence(result)

  return result
}

function extractCreditScore(text: string): { score: number | null; confidence: number } {
  const patterns = [
    { regex: /credit\s*score[:\s]*(\d{3})/i, confidence: 0.9 },
    { regex: /fico\s*score[:\s]*(\d{3})/i, confidence: 0.95 },
    { regex: /score[:\s]*(\d{3})(?:\s*out\s*of\s*850)?/i, confidence: 0.8 },
    { regex: /(\d{3})\s*(?:out\s*of|\/)\s*850/i, confidence: 0.85 },
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern.regex)
    if (match && match[1]) {
      const score = Number.parseInt(match[1])
      if (score >= 300 && score <= 850) {
        return { score, confidence: pattern.confidence }
      }
    }
  }

  return { score: null, confidence: 0 }
}

function extractBureauInfo(text: string): { bureau: string | null; reportDate: string | null } {
  const result = { bureau: null, reportDate: null }

  // Extract bureau name
  const bureauMatch = text.match(/(equifax|experian|transunion)/i)
  if (bureauMatch) {
    result.bureau = bureauMatch[1].charAt(0).toUpperCase() + bureauMatch[1].slice(1).toLowerCase()
  }

  // Extract report date
  const datePatterns = [
    /report\s*date[:\s]*(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
    /as\s*of[:\s]*(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
    /date[:\s]*(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
  ]

  for (const pattern of datePatterns) {
    const match = text.match(pattern)
    if (match && match[1]) {
      result.reportDate = match[1]
      break
    }
  }

  return result
}

function extractAccounts(text: string): Account[] {
  const accounts: Account[] = []
  const sections = text.split(/\n{2,}/)

  for (const section of sections) {
    // Check if this section contains account information
    if (section.match(/account/i) || section.match(/balance/i) || section.match(/credit\s*limit/i)) {
      const account: Account = {
        creditor: "",
        isNegative: false,
      }

      // Extract creditor name
      const creditorMatch = section.match(/^([A-Z][A-Za-z0-9\s&.,'-]+)(?:\n|:)/m)
      if (creditorMatch) {
        account.creditor = creditorMatch[1].trim()
      }

      // Extract account number
      const accountNumberMatch = section.match(/account\s*(?:number|#)[:\s]*([*X\d-]+)/i)
      if (accountNumberMatch) {
        account.accountNumber = accountNumberMatch[1]
      }

      // Extract balance
      const balanceMatch = section.match(/balance[:\s]*\$?([\d,]+)/i)
      if (balanceMatch) {
        account.balance = balanceMatch[1]
      }

      // Extract credit limit
      const limitMatch = section.match(/(?:credit\s*)?limit[:\s]*\$?([\d,]+)/i)
      if (limitMatch) {
        account.creditLimit = limitMatch[1]
      }

      // Extract payment status
      const statusMatch = section.match(/status[:\s]*([A-Za-z\s]+)/i)
      if (statusMatch) {
        account.paymentStatus = statusMatch[1].trim()
      }

      // Check if negative
      if (section.match(/late|delinquent|collection|charge\s*off|past\s*due/i)) {
        account.isNegative = true
      }

      if (account.creditor) {
        accounts.push(account)
      }
    }
  }

  return accounts
}

function extractNegativeItems(text: string): NegativeItem[] {
  const negativeItems: NegativeItem[] = []
  const sections = text.split(/\n{2,}/)

  for (const section of sections) {
    const negativePatterns = [/(\d+)\s*days?\s*(?:late|past\s*due)/i, /charge\s*off/i, /collection/i, /delinquent/i]

    for (const pattern of negativePatterns) {
      if (pattern.test(section)) {
        const item: NegativeItem = {
          creditor: "Unknown",
          issueType: "Unknown",
          details: section.substring(0, 200).trim(),
        }

        // Extract creditor
        const creditorMatch = section.match(/^([A-Z][A-Za-z0-9\s&.,'-]+)(?:\n|:)/m)
        if (creditorMatch) {
          item.creditor = creditorMatch[1].trim()
        }

        // Determine issue type
        if (section.match(/charge\s*off/i)) {
          item.issueType = "Charge Off"
        } else if (section.match(/collection/i)) {
          item.issueType = "Collection"
        } else if (section.match(/(\d+)\s*days?\s*late/i)) {
          const match = section.match(/(\d+)\s*days?\s*late/i)
          item.issueType = `${match![1]} Days Late`
        } else if (section.match(/delinquent/i)) {
          item.issueType = "Delinquent"
        }

        negativeItems.push(item)
        break
      }
    }
  }

  return negativeItems
}

function extractInquiries(text: string): Inquiry[] {
  const inquiries: Inquiry[] = []
  const inquirySection = text.match(/inquiries[\s\S]*?(?=\n{3,}|$)/i)

  if (inquirySection) {
    const lines = inquirySection[0].split("\n")

    for (const line of lines) {
      if (line.length > 10 && !line.match(/^inquiries/i)) {
        const inquiry: Inquiry = {
          creditor: line.trim(),
        }

        // Extract date if present
        const dateMatch = line.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})/)
        if (dateMatch) {
          inquiry.date = dateMatch[1]
          inquiry.creditor = line.replace(dateMatch[0], "").trim()
        }

        if (inquiry.creditor) {
          inquiries.push(inquiry)
        }
      }
    }
  }

  return inquiries
}

function extractPublicRecords(text: string): PublicRecord[] {
  const publicRecords: PublicRecord[] = []
  const sections = text.split(/\n{2,}/)

  for (const section of sections) {
    const recordTypes = ["bankruptcy", "tax lien", "civil judgment", "foreclosure"]

    for (const recordType of recordTypes) {
      if (section.toLowerCase().includes(recordType)) {
        const record: PublicRecord = {
          type: recordType.charAt(0).toUpperCase() + recordType.slice(1),
          details: section.substring(0, 200).trim(),
        }

        // Extract date
        const dateMatch = section.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})/)
        if (dateMatch) {
          record.date = dateMatch[1]
        }

        // Extract amount
        const amountMatch = section.match(/\$?([\d,]+)/)
        if (amountMatch) {
          record.amount = amountMatch[1]
        }

        publicRecords.push(record)
        break
      }
    }
  }

  return publicRecords
}

function calculateConfidence(data: CreditReportData): number {
  let confidence = 0
  let factors = 0

  // Credit score found
  if (data.creditScore) {
    confidence += 0.3
    factors++
  }

  // Accounts found
  if (data.accounts.length > 0) {
    confidence += 0.2
    factors++
  }

  // Bureau identified
  if (data.bureau) {
    confidence += 0.1
    factors++
  }

  // Report date found
  if (data.reportDate) {
    confidence += 0.1
    factors++
  }

  // Negative items found (if expected)
  if (data.negativeItems.length > 0 || data.accounts.some((a) => a.isNegative)) {
    confidence += 0.15
    factors++
  }

  // Inquiries found
  if (data.inquiries.length > 0) {
    confidence += 0.1
    factors++
  }

  // Public records found
  if (data.publicRecords.length > 0) {
    confidence += 0.05
    factors++
  }

  // Normalize confidence based on factors found
  if (factors > 0) {
    confidence = confidence / (factors * 0.15)
  }

  return Math.min(confidence, 1)
}

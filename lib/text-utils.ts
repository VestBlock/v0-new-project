// Moved from server-document-processor.ts
export function isLikelyCreditReport(text: string | null | undefined): boolean {
  if (!text || text.trim().length < 200) {
    // console.log(`[TextUtils] Text too short (${text?.length || 0} chars) to be a credit report.`);
    return false
  }
  const creditKeywords = [
    "credit report",
    "credit score",
    "fico",
    "experian",
    "equifax",
    "transunion",
    "account history",
    "payment history",
    "inquiry",
    "collection",
    "charge-off",
    "public record",
    "credit limit",
    "balance",
    "tradeline",
    "late payment",
    "derogatory",
  ]
  const lowerText = text.toLowerCase()
  let matches = 0
  for (const keyword of creditKeywords) {
    if (lowerText.includes(keyword)) {
      matches++
    }
  }
  const likely = matches >= 5 // Adjusted threshold slightly
  // console.log(`[TextUtils] isLikelyCreditReport check: ${matches} keywords found. Likely: ${likely}`);
  return likely
}

const GRAPH_ORIGIN = 'https://graph.microsoft.com'

function mailboxMessagesPath(mailbox: string) {
  return `/v1.0/users/${mailbox.trim()}/mailFolders/inbox/messages`
}

/**
 * Graph continuation URLs are opaque, but they are also persisted between
 * cron invocations. Validate the origin and exact mailbox collection before
 * following one so a corrupted database value cannot become an SSRF target.
 */
export function validateOutlookMailboxContinuationUrl(
  value: unknown,
  mailbox: string
): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  try {
    const url = new URL(value)
    const decodedPath = decodeURIComponent(url.pathname)
    if (
      url.origin !== GRAPH_ORIGIN ||
      url.username ||
      url.password ||
      url.port ||
      url.hash ||
      decodedPath.toLowerCase() !== mailboxMessagesPath(mailbox).toLowerCase()
    ) {
      return null
    }
    return url.toString()
  } catch {
    return null
  }
}

export function buildOutlookMailboxInitialUrl(input: {
  mailbox: string
  since: string
  pageSize: number
}) {
  const pageSize = Math.min(50, Math.max(1, Math.floor(input.pageSize)))
  const params = new URLSearchParams({
    '$select':
      'id,conversationId,internetMessageId,subject,bodyPreview,receivedDateTime,from,toRecipients,isRead,categories,webLink',
    '$filter': `receivedDateTime ge ${input.since}`,
    '$orderby': 'receivedDateTime desc',
    '$top': String(pageSize),
  })
  return `${GRAPH_ORIGIN}/v1.0/users/${encodeURIComponent(input.mailbox)}/mailFolders/inbox/messages?${params}`
}

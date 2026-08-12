type SendEventLike = {
  id?: string | null
  outreach_message_id?: string | null
  status?: string | null
}

export function isProviderAcceptedSendStatus(status: string | null | undefined) {
  return ['accepted', 'sent'].includes(String(status || '').trim().toLowerCase())
}

export function countUniqueProviderAcceptedSends(events: SendEventLike[]) {
  const sends = new Set<string>()

  events.forEach((event, index) => {
    if (!isProviderAcceptedSendStatus(event.status)) return
    sends.add(event.outreach_message_id || event.id || `accepted-send-${index}`)
  })

  return sends.size
}

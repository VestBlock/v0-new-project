const KNOWN_OWNER_EMAILS = [
  'contact@vestblock.io',
  'acquisitions@vestblock.io',
  'vestblockio@gmail.com',
]

function splitEmailList(value: string | undefined) {
  return String(value || '')
    .split(',')
    .map((email) => email.trim().replace(/^['"]|['"]$/g, '').toLowerCase())
    .filter(Boolean)
}

export function configuredAdminEmails() {
  const configured = [
    ...splitEmailList(process.env.ADMIN_ALERT_EMAIL),
    ...splitEmailList(process.env.ADMIN_EMAILS),
    ...splitEmailList(process.env.NEXT_PUBLIC_ADMIN_EMAIL),
    ...splitEmailList(process.env.NEXT_PUBLIC_ADMIN_EMAILS),
  ]

  return Array.from(new Set([...configured, ...KNOWN_OWNER_EMAILS]))
}

export function isConfiguredAdminEmail(email?: string | null) {
  if (!email) return false
  return configuredAdminEmails().includes(email.trim().toLowerCase())
}

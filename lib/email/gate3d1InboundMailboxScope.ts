import 'server-only'

import { getGate3d1InboundMailboxScopeReadiness } from '@/lib/email/graphSameThreadReplyCore'

function exactEnv(name: string) {
  return String(process.env[name] || '').trim()
}

/**
 * The existing Outlook reader stays credential-isolated from the Gate 3D.1
 * sender, but exact callback attribution requires both identities to target
 * the same tenant and mailbox. The actual inbound token tenant is supplied by
 * the sync only after its JWT has been decoded.
 */
export function getConfiguredGate3d1InboundMailboxScope(
  observedTokenTenantId?: string | null
) {
  return getGate3d1InboundMailboxScopeReadiness({
    inboundTenantId: exactEnv('MICROSOFT_TENANT_ID'),
    dedicatedTenantId: exactEnv('GATE3D1_GRAPH_TENANT_ID'),
    ...(observedTokenTenantId === undefined ? {} : { observedTokenTenantId }),
    inboundMailboxObjectId: exactEnv('OUTLOOK_ACQUISITIONS_MAILBOX_ID'),
    inboundMailboxAddress: exactEnv('OUTLOOK_ACQUISITIONS_MAILBOX'),
    dedicatedMailboxObjectId: exactEnv('GATE3D1_GRAPH_MAILBOX_OBJECT_ID'),
    dedicatedMailboxAddress: exactEnv('GATE3D1_GRAPH_MAILBOX_ADDRESS'),
  })
}

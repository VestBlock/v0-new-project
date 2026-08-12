import 'server-only'

import { NextResponse } from 'next/server'

import { getCommandCenterData } from '@/lib/admin/commandCenter'

/**
 * A send may be technically possible while the board is reporting partial data.
 * Hold it until the operator can trust the source state used to make the decision.
 */
export async function isCommandCenterDataIntegrityHold() {
  try {
    const data = await getCommandCenterData()
    return !data.liveDataReachable
  } catch {
    return true
  }
}

export function commandCenterDataIntegrityHoldResponse() {
  return NextResponse.json(
    {
      error: 'Outbound is paused because live command-center data is incomplete. Restore source reads before sending.',
      code: 'command_center_data_integrity_hold',
    },
    { status: 409 }
  )
}

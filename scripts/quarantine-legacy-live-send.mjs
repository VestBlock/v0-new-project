#!/usr/bin/env node

import {
  GOVERNED_OUTREACH_DISPATCH_COMMAND,
  LEGACY_OUTREACH_QUARANTINE_CODE,
  quarantineLegacyDirectLiveSend,
} from './lib/legacy-outreach-quarantine.mjs'

const args = process.argv.slice(2)
const entryArg = args.find((arg) => arg.startsWith('--entry='))
const entry = entryArg?.slice('--entry='.length) || 'legacy package live-send alias'

try {
  quarantineLegacyDirectLiveSend({ requested: true, entry })
} catch (error) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        code: error?.code || LEGACY_OUTREACH_QUARANTINE_CODE,
        entry,
        error: error instanceof Error ? error.message : String(error),
        governedSuccessor: GOVERNED_OUTREACH_DISPATCH_COMMAND,
      },
      null,
      2
    )
  )
  process.exitCode = 1
}

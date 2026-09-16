export type DealMachinePhoneType = 'mobile' | 'landline' | 'voip' | 'unknown'

export type DealMachinePhoneRecord = {
  number: string
  type: DealMachinePhoneType
  doNotCall: boolean | null
}

type RawPhone = string | number | Record<string, unknown> | null | undefined

function normalizePhone(value: unknown) {
  const digits = String(value || '').replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1)
  return digits.length === 10 ? digits : ''
}

function phoneType(value: unknown): DealMachinePhoneType {
  const normalized = String(value || '').trim().toLowerCase()
  if (/mobile|wireless|cell/.test(normalized)) return 'mobile'
  if (/landline|land line|fixed/.test(normalized)) return 'landline'
  if (/voip/.test(normalized)) return 'voip'
  return 'unknown'
}

function explicitBoolean(value: unknown) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value === 1 ? true : value === 0 ? false : null
  const normalized = String(value ?? '').trim().toLowerCase()
  if (/^(1|true|yes|y|blocked|dnc|do not call)$/.test(normalized)) return true
  if (/^(0|false|no|n|clear|allowed|not on dnc)$/.test(normalized)) return false
  return null
}

function dncStatus(entry: RawPhone) {
  if (!entry || typeof entry !== 'object') return null
  const row = entry as Record<string, unknown>
  for (const key of ['do_not_call', 'doNotCall', 'phone_do_not_call', 'phoneDoNotCall', 'dnc']) {
    if (!(key in row)) continue
    const parsed = explicitBoolean(row[key])
    if (parsed !== null) return parsed
  }
  const status = String(row.status || row.phone_status || '').trim().toLowerCase()
  if (/do not call|\bdnc\b|excluded|blocked/.test(status)) return true
  if (/clear|allowed|not on dnc/.test(status)) return false
  return null
}

function normalizeRecord(entry: RawPhone): DealMachinePhoneRecord | null {
  const row = entry && typeof entry === 'object' ? entry as Record<string, unknown> : null
  const number = normalizePhone(
    row ? row.number || row.phone || row.phone_number || row.value : entry
  )
  if (!number) return null
  return {
    number,
    type: phoneType(row?.type || row?.phone_type || row?.line_type),
    doNotCall: dncStatus(entry),
  }
}

function mergeDncStatus(left: boolean | null, right: boolean | null) {
  if (left === true || right === true) return true
  if (left === false || right === false) return false
  return null
}

function mergePhoneType(left: DealMachinePhoneType, right: DealMachinePhoneType) {
  if (left === 'unknown') return right
  if (right === 'unknown' || left === right) return left
  return 'unknown' as const
}

function phonePriority(record: DealMachinePhoneRecord) {
  const dncRank = record.doNotCall === false ? 0 : record.doNotCall === null ? 1 : 2
  const typeRank = record.type === 'mobile' ? 0 : record.type === 'landline' ? 1 : record.type === 'voip' ? 2 : 3
  return dncRank * 10 + typeRank
}

export function extractDealMachinePhoneRecords(contact: Record<string, unknown> | null | undefined) {
  const rows: RawPhone[] = [
    ...(Array.isArray(contact?.phones) ? contact.phones as RawPhone[] : []),
    ...(Array.isArray(contact?.phone_numbers) ? contact.phone_numbers as RawPhone[] : []),
    contact?.phone as RawPhone,
    contact?.phone_number as RawPhone,
  ]
  const records = new Map<string, DealMachinePhoneRecord>()

  for (const entry of rows) {
    const next = normalizeRecord(entry)
    if (!next) continue
    const current = records.get(next.number)
    records.set(next.number, current ? {
      number: next.number,
      type: mergePhoneType(current.type, next.type),
      // Conflicting provider evidence fails closed.
      doNotCall: mergeDncStatus(current.doNotCall, next.doNotCall),
    } : next)
  }

  return Array.from(records.values()).sort((left, right) => phonePriority(left) - phonePriority(right))
}

export function usableDealMachinePhoneRecords(records: readonly DealMachinePhoneRecord[]) {
  return records.filter((record) => record.doNotCall !== true)
}

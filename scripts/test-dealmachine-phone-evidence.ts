import assert from 'node:assert/strict'

import {
  extractDealMachinePhoneRecords,
  usableDealMachinePhoneRecords,
} from '../lib/dealmachine/phoneEvidence'

const records = extractDealMachinePhoneRecords({
  phones: [
    { number: '(414) 555-0101', type: 'Landline', do_not_call: false },
    { number: '+1 414-555-0102', type: 'Wireless', do_not_call: false },
    { number: '414-555-0103', type: 'Mobile', do_not_call: true },
    { number: '414-555-0104', type: 'VoIP' },
    { number: '414-555-0102', type: 'Wireless', status: 'allowed' },
  ],
})

assert.deepEqual(records, [
  { number: '4145550102', type: 'mobile', doNotCall: false },
  { number: '4145550101', type: 'landline', doNotCall: false },
  { number: '4145550104', type: 'voip', doNotCall: null },
  { number: '4145550103', type: 'mobile', doNotCall: true },
])
assert.deepEqual(
  usableDealMachinePhoneRecords(records).map((record) => record.number),
  ['4145550102', '4145550101', '4145550104']
)

const conflicting = extractDealMachinePhoneRecords({
  phones: [
    { number: '4145550199', type: 'Wireless', do_not_call: false },
    { number: '4145550199', type: 'Wireless', do_not_call: true },
  ],
})
assert.equal(conflicting[0]?.doNotCall, true, 'Conflicting DNC evidence must fail closed')
assert.equal(usableDealMachinePhoneRecords(conflicting).length, 0)

const providerFieldAndCombinedArrays = extractDealMachinePhoneRecords({
  phones: [{ number: '4145550177', type: 'Mobile', do_not_call: false }],
  phone_numbers: [
    { number: '4145550176', type: 'Wireless', phone_do_not_call: true },
    { number: '4145550175', type: 'Landline', phone_do_not_call: false },
  ],
})
assert.equal(
  providerFieldAndCombinedArrays.find((record) => record.number === '4145550176')?.doNotCall,
  true,
  'DealMachine phone_do_not_call evidence must be preserved as blocked.'
)
assert.deepEqual(
  usableDealMachinePhoneRecords(providerFieldAndCombinedArrays).map((record) => record.number),
  ['4145550177', '4145550175'],
  'Both DealMachine phone arrays must be aggregated without admitting a DNC number.'
)

assert.deepEqual(
  extractDealMachinePhoneRecords({ phone: '4145550188' }),
  [{ number: '4145550188', type: 'unknown', doNotCall: null }]
)

console.log('DealMachine phone evidence tests passed.')

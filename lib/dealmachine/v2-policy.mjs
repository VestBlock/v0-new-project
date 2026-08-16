const TRUE_FLAG = /^(1|true|yes|on)$/i

export const DEALMACHINE_PROPERTY_FIELD_ALLOWLIST = Object.freeze([
  'estimated_value',
  'estimated_equity_amount',
  'estimated_equity_percentage',
  'property_type',
  'num_units',
  'year_built',
  'living_area_sqft',
  'num_mortgages',
  'estimated_loan_to_value_percentage',
  'total_estimated_loan_balance',
  'total_estimated_loan_payment_monthly',
  'mortgage_1_loan_balance',
  'mortgage_1_loan_interest_rate',
  'mortgage_1_loan_type',
  'mortgage_1_estimated_payment_amount',
  'mortgage_1_loan_due_date',
  'market_status',
  'mls_current_listing_price',
  'mls_days_on_market',
  'mls_last_initial_listing_date',
  'foreclosure_auction_date',
  'foreclosure_default_date',
  'foreclosure_doc_type',
  'foreclosure_status',
  'property_preforeclosure_status',
  'tax_delinquent_year',
  'num_total_active_liens',
  'lot_size_acres',
  'zoning',
  'parcel_number_raw',
  'legal_description',
  'building_condition',
])

export const DEALMACHINE_PROPERTY_FILTER_ALLOWLIST = Object.freeze([
  'is_preforeclosure',
  'num_mortgages',
  'estimated_value',
  'is_tax_delinquent',
  'has_out_of_state_owners',
  'estimated_equity_percentage',
  'has_active_lien',
  'is_pre_probate',
  'is_vacant_home',
  'has_investment_property_additional_investment_flag',
  'has_absentee_owners',
  'property_type',
  'num_units',
  'lot_size_acres',
  'building_condition',
  'is_free_and_clear',
  'is_mls_active',
  'mls_days_on_market',
  'mls_current_listing_price',
])

const PROPERTY_FIELDS = new Set(DEALMACHINE_PROPERTY_FIELD_ALLOWLIST)
const PROPERTY_FILTERS = new Set(DEALMACHINE_PROPERTY_FILTER_ALLOWLIST)
const ALWAYS_INCLUDED_PROPERTY_RESPONSE_FIELDS = new Set([
  'dm_property_id',
  'full_address',
  'address',
  'unit',
  'city',
  'state',
  'zip',
  'latitude',
  'longitude',
  'images',
])
const PROPERTY_IMAGE_RESPONSE_FIELDS = new Set(['street_view', 'satellite', 'roadmap'])
const ALLOWED_BODY_KEYS = new Set([
  'anchor',
  'contact_audience',
  'estimate_cost',
  'fields',
  'filters',
  'locations',
  'page',
  'per_page',
  'sort',
])
const FORBIDDEN_NESTED_KEYS = /^(?:contacts?|emails?|phones?|people|persons?|skip_trace|skip_tracing)$/i
const PROHIBITED_RESPONSE_KEY = /(?:^|_)(?:contacts?|emails?|phones?|people|persons?|first_name|middle_name|last_name|full_name|person_name|contact_name|owner_name|owner_\d+_name|borrower_name|seller_name|trust_name|entity_name|company_name|business_name|lender_name|contact_id|people_id|person_id|owner_id|demographics?|age|date_of_birth|dob|gender|sex|ethnicity|race|marital_status|religion|credit|credit_score|credit_behavior|income|wealth|net_worth|politics?|political|political_party|party_affiliation|lifestyle|health|medical|insurance|ssn|mailing_address|owner_address|forwarding_address)(?:_|$)/i
const PROHIBITED_EXACT_RESPONSE_KEYS = new Set(['contact', 'contacts', 'owner', 'owners', 'people', 'person', 'persons'])

function flagIsEnabled(value) {
  return TRUE_FLAG.test(String(value || '').trim())
}

export function isDealMachineSourceEnabled(env = process.env) {
  return flagIsEnabled(env.DEALMACHINE_SOURCE_ENABLED)
}

export function isDealMachineDiscoveryEnabled(env = process.env) {
  return flagIsEnabled(env.DEALMACHINE_DISCOVERY_ENABLED)
}

export function isDealMachinePaidSearchEnabled(env = process.env) {
  return isDealMachineDiscoveryEnabled(env) && flagIsEnabled(env.DEALMACHINE_PAID_SEARCH_ENABLED)
}

export class DealMachinePolicyError extends Error {
  constructor(message, options = {}) {
    super(message)
    this.name = 'DealMachinePolicyError'
    this.code = options.code || 'dealmachine_policy_violation'
    this.violations = Array.isArray(options.violations) ? options.violations : []
  }
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function findForbiddenNestedKeys(value, path = 'body', violations = []) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => findForbiddenNestedKeys(entry, `${path}[${index}]`, violations))
    return violations
  }
  if (!isPlainObject(value)) return violations
  for (const [key, entry] of Object.entries(value)) {
    if (FORBIDDEN_NESTED_KEYS.test(key)) violations.push(`${path}.${key} is not permitted`)
    findForbiddenNestedKeys(entry, `${path}.${key}`, violations)
  }
  return violations
}

export function validatePropertyOnlySearchBody(body, options = {}) {
  const violations = []
  const requireFields = options.requireFields === true

  if (!isPlainObject(body)) {
    return { ok: false, violations: ['body must be a plain object'] }
  }

  for (const key of Object.keys(body)) {
    if (!ALLOWED_BODY_KEYS.has(key)) violations.push(`body.${key} is not permitted`)
  }
  findForbiddenNestedKeys(body, 'body', violations)

  if (body.anchor !== 'properties') {
    violations.push("body.anchor must be 'properties'")
  }
  if (body.contact_audience !== 'none') {
    violations.push("body.contact_audience must be 'none'")
  }

  if (!Array.isArray(body.locations) || body.locations.length < 1 || body.locations.length > 15) {
    violations.push('body.locations must contain between 1 and 15 approved property locations')
  } else {
    body.locations.forEach((location, index) => {
      if (!isPlainObject(location) || !String(location.type || '').trim() || !String(location.code || '').trim()) {
        violations.push(`body.locations[${index}] must contain non-empty type and code values`)
      }
    })
  }

  if (!Array.isArray(body.filters)) {
    violations.push('body.filters must be an array')
  } else {
    body.filters.forEach((entry, index) => {
      const filterId = String(entry?.filter_id || '')
      if (!PROPERTY_FILTERS.has(filterId)) {
        violations.push(`body.filters[${index}].filter_id is not an approved property filter`)
      }
    })
  }

  if (body.fields === undefined && requireFields) {
    violations.push('body.fields is required for property search')
  } else if (body.fields !== undefined) {
    if (!Array.isArray(body.fields)) {
      violations.push('body.fields must be an array')
    } else {
      if (requireFields && body.fields.length === 0) {
        violations.push('body.fields must contain at least one approved property-only field')
      }
      body.fields.forEach((field, index) => {
        if (!PROPERTY_FIELDS.has(String(field || ''))) {
          violations.push(`body.fields[${index}] is not an approved property-only field`)
        }
      })
    }
  }

  if (body.estimate_cost !== undefined && body.estimate_cost !== true) {
    violations.push('body.estimate_cost may only be true')
  }

  return { ok: violations.length === 0, violations }
}

export function assertPropertyOnlySearchBody(body, options = {}) {
  const result = validatePropertyOnlySearchBody(body, options)
  if (!result.ok) {
    throw new DealMachinePolicyError(
      `DealMachine property-only request rejected: ${result.violations.join('; ')}`,
      { code: 'unsafe_property_search_body', violations: result.violations }
    )
  }
  return body
}

export function findProhibitedPropertyPayloadPaths(payload) {
  const prohibited = []

  function visit(value, path) {
    if (Array.isArray(value)) {
      value.forEach((entry, index) => visit(entry, `${path}[${index}]`))
      return
    }
    if (!isPlainObject(value)) return
    for (const [key, entry] of Object.entries(value)) {
      const keyPath = `${path}.${key}`
      const normalizedKey = String(key)
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
        .replace(/[^a-z0-9]+/gi, '_')
        .toLowerCase()
      const exactSensitiveContainer = PROHIBITED_EXACT_RESPONSE_KEYS.has(normalizedKey)
      const exactSensitiveViolation = exactSensitiveContainer && (
        Array.isArray(entry) ||
        isPlainObject(entry) ||
        (entry !== null && entry !== undefined && entry !== '' && Number(entry) !== 0)
      )
      if (
        exactSensitiveViolation ||
        (!exactSensitiveContainer && PROHIBITED_RESPONSE_KEY.test(normalizedKey))
      ) prohibited.push(keyPath)
      visit(entry, keyPath)
    }
  }

  visit(payload, 'payload')
  return prohibited
}

export function assertPropertyOnlyResponsePayload(payload) {
  const prohibitedPaths = findProhibitedPropertyPayloadPaths(payload)
  if (prohibitedPaths.length) {
    throw new DealMachinePolicyError(
      `DealMachine response contains prohibited people, contact, or sensitive fields: ${prohibitedPaths.join(', ')}`,
      { code: 'unsafe_property_response_payload', violations: prohibitedPaths }
    )
  }
  return payload
}

function requireNonNegativeInteger(value, path) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new DealMachinePolicyError(
      `DealMachine response field ${path} must be a nonnegative integer.`,
      { code: 'unexpected_property_response_schema', violations: [path] }
    )
  }
  return value
}

function exactObjectKeyViolations(value, path, requiredKeys, optionalKeys = []) {
  if (!isPlainObject(value)) return [`${path} must be an object`]
  const allowed = new Set([...requiredKeys, ...optionalKeys])
  return [
    ...requiredKeys.filter((key) => !Object.prototype.hasOwnProperty.call(value, key)).map((key) => `${path}.${key}`),
    ...Object.keys(value).filter((key) => !allowed.has(key)).map((key) => `${path}.${key}`),
  ]
}

export function assertPropertyCountResponsePayload(payload) {
  if (!isPlainObject(payload)) {
    throw new DealMachinePolicyError('DealMachine property-count response must be an object.', {
      code: 'unexpected_property_count_response',
    })
  }
  const allowed = new Set(['total_properties', 'total_people', 'total_results'])
  const unexpected = Object.keys(payload).filter((key) => !allowed.has(key))
  const properties = requireNonNegativeInteger(payload.total_properties, 'total_properties')
  const people = requireNonNegativeInteger(payload.total_people, 'total_people')
  const results = requireNonNegativeInteger(payload.total_results, 'total_results')
  if (unexpected.length || people !== 0 || results !== properties) {
    throw new DealMachinePolicyError(
      'DealMachine property-only count returned unexpected fields, people, or inconsistent totals.',
      {
        code: 'unexpected_property_count_response',
        violations: [...unexpected, ...(people === 0 ? [] : ['total_people']), ...(results === properties ? [] : ['total_results'])],
      }
    )
  }
  return payload
}

export function assertPropertyEstimateResponsePayload(payload) {
  assertPropertyOnlyResponsePayload(payload)
  const shapeViolations = [
    ...exactObjectKeyViolations(payload, 'payload', ['totals', 'pagination', 'estimated_credits']),
    ...exactObjectKeyViolations(payload?.totals, 'payload.totals', ['properties', 'people']),
    ...exactObjectKeyViolations(
      payload?.pagination,
      'payload.pagination',
      ['page', 'per_page', 'total_results', 'total_pages', 'has_next_page', 'has_previous_page']
    ),
    ...exactObjectKeyViolations(
      payload?.estimated_credits,
      'payload.estimated_credits',
      ['this_page', 'total_all_pages', 'breakdown']
    ),
    ...exactObjectKeyViolations(
      payload?.estimated_credits?.breakdown,
      'payload.estimated_credits.breakdown',
      ['properties', 'people', 'already_accessed'],
      ['note']
    ),
  ]
  if (shapeViolations.length || Array.isArray(payload?.data)) {
    throw new DealMachinePolicyError('DealMachine cost estimate returned an unexpected envelope.', {
      code: 'unexpected_property_estimate_response',
      violations: [...shapeViolations, ...(Array.isArray(payload?.data) ? ['payload.data'] : [])],
    })
  }
  const totalProperties = requireNonNegativeInteger(payload.totals.properties, 'totals.properties')
  const totalPeople = requireNonNegativeInteger(payload.totals.people, 'totals.people')
  const page = requireNonNegativeInteger(payload.pagination.page, 'pagination.page')
  const perPage = requireNonNegativeInteger(payload.pagination.per_page, 'pagination.per_page')
  const totalResults = requireNonNegativeInteger(payload.pagination.total_results, 'pagination.total_results')
  requireNonNegativeInteger(payload.pagination.total_pages, 'pagination.total_pages')
  const thisPage = requireNonNegativeInteger(payload.estimated_credits.this_page, 'estimated_credits.this_page')
  const totalAllPages = requireNonNegativeInteger(
    payload.estimated_credits.total_all_pages,
    'estimated_credits.total_all_pages'
  )
  const properties = requireNonNegativeInteger(
    payload.estimated_credits.breakdown.properties,
    'estimated_credits.breakdown.properties'
  )
  const people = requireNonNegativeInteger(
    payload?.estimated_credits?.breakdown?.people,
    'estimated_credits.breakdown.people'
  )
  requireNonNegativeInteger(
    payload.estimated_credits.breakdown.already_accessed,
    'estimated_credits.breakdown.already_accessed'
  )
  const note = payload.estimated_credits.breakdown.note
  const inconsistent = [
    ...(totalPeople === 0 ? [] : ['totals.people']),
    ...(people === 0 ? [] : ['estimated_credits.breakdown.people']),
    ...(page >= 1 ? [] : ['pagination.page']),
    ...(perPage >= 1 && perPage <= 250 ? [] : ['pagination.per_page']),
    ...(typeof payload.pagination.has_next_page === 'boolean' ? [] : ['pagination.has_next_page']),
    ...(typeof payload.pagination.has_previous_page === 'boolean' ? [] : ['pagination.has_previous_page']),
    ...(totalResults === totalProperties ? [] : ['pagination.total_results']),
    ...(thisPage === properties ? [] : ['estimated_credits.this_page']),
    ...(totalAllPages === totalProperties ? [] : ['estimated_credits.total_all_pages']),
    ...(note === undefined || typeof note === 'string' ? [] : ['estimated_credits.breakdown.note']),
  ]
  if (inconsistent.length) {
    throw new DealMachinePolicyError('DealMachine property-only estimate returned inconsistent totals or people credits.', {
      code: 'unexpected_property_estimate_response',
      violations: inconsistent,
    })
  }
  return payload
}

export function assertPaidPropertySearchResponsePayload(payload, options = {}) {
  assertPropertyOnlyResponsePayload(payload)
  const maxRows = Math.max(0, Number(options.maxRows ?? Number.POSITIVE_INFINITY))
  const maxCredits = Math.max(0, Number(options.maxCredits ?? Number.POSITIVE_INFINITY))
  const requestedFields = Array.isArray(options.allowedFields) ? options.allowedFields.map(String) : []
  const allowedRowFields = new Set([...ALWAYS_INCLUDED_PROPERTY_RESPONSE_FIELDS, ...requestedFields])
  if (!isPlainObject(payload) || !Array.isArray(payload.data) || payload.data.length > maxRows) {
    throw new DealMachinePolicyError('DealMachine paid search returned an invalid or oversized data array.', {
      code: 'unexpected_paid_property_response',
      violations: ['data'],
    })
  }
  const unexpectedRowFields = []
  payload.data.forEach((row, index) => {
    if (!isPlainObject(row)) {
      unexpectedRowFields.push(`data[${index}]`)
      return
    }
    for (const key of Object.keys(row)) {
      if (!allowedRowFields.has(key)) unexpectedRowFields.push(`data[${index}].${key}`)
    }
    if (row.images !== undefined && row.images !== null) {
      if (!isPlainObject(row.images)) {
        unexpectedRowFields.push(`data[${index}].images`)
      } else {
        for (const key of Object.keys(row.images)) {
          if (!PROPERTY_IMAGE_RESPONSE_FIELDS.has(key)) unexpectedRowFields.push(`data[${index}].images.${key}`)
        }
      }
    }
  })
  if (unexpectedRowFields.length) {
    throw new DealMachinePolicyError(
      'DealMachine paid property response included fields outside the exact requested property projection.',
      { code: 'unexpected_paid_property_response', violations: unexpectedRowFields }
    )
  }
  const used = requireNonNegativeInteger(payload?.credits?.used, 'credits.used')
  const properties = requireNonNegativeInteger(payload?.credits?.properties, 'credits.properties')
  const people = requireNonNegativeInteger(payload?.credits?.people, 'credits.people')
  requireNonNegativeInteger(payload?.credits?.deduplicated, 'credits.deduplicated')
  if (people !== 0 || properties < payload.data.length || used > properties || used > maxCredits) {
    throw new DealMachinePolicyError('DealMachine paid-search credit evidence is inconsistent with its property-only request.', {
      code: 'unexpected_paid_property_response',
      violations: [
        ...(people === 0 ? [] : ['credits.people']),
        ...(properties >= payload.data.length ? [] : ['credits.properties']),
        ...(used <= properties && used <= maxCredits ? [] : ['credits.used']),
      ],
    })
  }
  return payload
}

export function assertDealMachineDiscoveryEnabled(env = process.env) {
  if (!isDealMachineDiscoveryEnabled(env)) {
    throw new DealMachinePolicyError(
      'DealMachine discovery is disabled. DEALMACHINE_DISCOVERY_ENABLED must be true.',
      { code: 'dealmachine_discovery_disabled' }
    )
  }
}

export function assertDealMachinePaidSearchEnabled(env = process.env) {
  if (!isDealMachinePaidSearchEnabled(env)) {
    throw new DealMachinePolicyError(
      'DealMachine paid search is disabled. Discovery and paid-search flags must both be true.',
      { code: 'dealmachine_paid_search_disabled' }
    )
  }
}

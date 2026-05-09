export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireLeadAdmin } from '@/lib/leads/admin-auth'
import { csvImportLeadSchema } from '@/lib/leads/schemas'
import { isValidLeadEmail, mapCsvLeadRows } from '@/lib/leads/csv'
import { scoreAndPersistLead } from '@/lib/leads/service'
import { runNewLeadAutomation } from '@/lib/leads/leadAutomation'
import {
  buildPropertyMatchInputFromRealEstateRow,
  buildRealEstateInventoryLead,
  isRealEstateInventoryRow,
} from '@/lib/leads/real-estate-inventory'
import { createAdminClient } from '@/lib/supabase/admin'
import { upsertLead } from '@/lib/leads/repository'
import { persistPropertyBuyerMatches } from '@/lib/buyers/service'

function normalizeWebsite(value?: string) {
  if (!value) return ''
  return value.replace(/^https?:\/\//, '').replace(/\/+$/, '').toLowerCase()
}

export async function POST(request: NextRequest) {
  const { response, user } = await requireLeadAdmin(request)
  if (response) return response

  try {
    const form = await request.formData()
    const file = form.get('file')
    const campaignName = String(form.get('campaignName') || '').trim() || null

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'CSV file is required.' }, { status: 400 })
    }

    const text = await file.text()
    const mapped = mapCsvLeadRows(text)
    if (!mapped.length) {
      return NextResponse.json({ error: 'No rows found in CSV.' }, { status: 400 })
    }

    const rows = mapped
      .map((row) => {
        const parsed = csvImportLeadSchema.safeParse({
          ...row,
          email: row.email || undefined,
          website: row.website ? (row.website.startsWith('http') ? row.website : `https://${row.website}`) : undefined,
        })
        return parsed.success ? parsed.data : null
      })
      .filter(Boolean)

    const admin = createAdminClient()
    const emails = Array.from(new Set(rows.map((row) => row?.email).filter(Boolean))) as string[]
    const phones = Array.from(new Set(rows.map((row) => row?.phone).filter(Boolean))) as string[]
    const websites = Array.from(new Set(rows.map((row) => normalizeWebsite(row?.website)).filter(Boolean)))
    const cities = Array.from(new Set(rows.map((row) => row?.city).filter(Boolean))) as string[]
    const propertyAddresses = Array.from(
      new Set(rows.map((row) => row?.property_address?.trim()).filter(Boolean))
    ) as string[]

    const [existingByEmail, existingByPhone, existingByWebsite, existingByCity, existingByProperty, suppressions] = await Promise.all([
      emails.length ? admin.from('leads').select('id,email').in('email', emails) : Promise.resolve({ data: [], error: null }),
      phones.length ? admin.from('leads').select('id,phone').in('phone', phones) : Promise.resolve({ data: [], error: null }),
      websites.length ? admin.from('leads').select('id,website').not('website', 'is', null).limit(10000) : Promise.resolve({ data: [], error: null }),
      cities.length ? admin.from('leads').select('id,business_name,city,website').in('city', cities) : Promise.resolve({ data: [], error: null }),
      propertyAddresses.length
        ? admin.from('leads').select('id,property_address,city,state').in('property_address', propertyAddresses)
        : Promise.resolve({ data: [], error: null }),
      admin.from('lead_suppressions').select('*').eq('status', 'active'),
    ])

    const emailSet = new Set((existingByEmail.data || []).map((lead) => String(lead.email).toLowerCase()))
    const phoneSet = new Set((existingByPhone.data || []).map((lead) => String(lead.phone)))
    const businessCitySet = new Set(
      (existingByCity.data || []).map((lead) => `${String(lead.business_name || '').toLowerCase()}|${String(lead.city || '').toLowerCase()}`)
    )
    const websiteSet = new Set([
      ...(existingByWebsite.data || []).map((lead) => normalizeWebsite(String(lead.website || ''))),
      ...(existingByCity.data || []).map((lead) => normalizeWebsite(String(lead.website || ''))),
    ].filter(Boolean))
    const propertySet = new Set(
      (existingByProperty.data || []).map(
        (lead) =>
          `${String(lead.property_address || '').trim().toLowerCase()}|${String(lead.city || '').trim().toLowerCase()}|${String(lead.state || '').trim().toLowerCase()}`
      )
    )

    const suppressionRows = suppressions.data || []
    let imported = 0
    let skipped = 0
    let invalid = 0
    let importedSellerInventory = 0

    for (const row of rows) {
      if (!row) continue
      const email = row.email?.trim().toLowerCase() || ''
      const phone = row.phone?.trim() || ''
      const website = normalizeWebsite(row.website)
      const businessCityKey = `${row.business_name.toLowerCase()}|${String(row.city || '').toLowerCase()}`
      const propertyKey = `${String(row.property_address || '').trim().toLowerCase()}|${String(row.city || '').trim().toLowerCase()}|${String(row.state || '').trim().toLowerCase()}`
      const emailValid = email ? isValidLeadEmail(email) : false
      const realEstateInventory = isRealEstateInventoryRow(row)

      const suppressed = suppressionRows.find((entry) =>
        (entry.email && email && entry.email.toLowerCase() === email) ||
        (entry.phone && phone && entry.phone === phone) ||
        (entry.website && website && normalizeWebsite(entry.website) === website) ||
        (entry.business_name && entry.city && `${entry.business_name.toLowerCase()}|${entry.city.toLowerCase()}` === businessCityKey)
      )

      const duplicated =
        (email && emailSet.has(email)) ||
        (phone && phoneSet.has(phone)) ||
        (website && websiteSet.has(website)) ||
        businessCitySet.has(businessCityKey) ||
        (realEstateInventory && propertySet.has(propertyKey))

      if ((email && !emailValid) || duplicated || suppressed) {
        if (email && !emailValid) invalid += 1
        skipped += 1
        continue
      }

      if (realEstateInventory) {
        const input = buildRealEstateInventoryLead(row, campaignName)
        input.ownerUserId = user?.id || null
        const lead = await upsertLead(input)
        const score = await scoreAndPersistLead(lead, input)
        await persistPropertyBuyerMatches(buildPropertyMatchInputFromRealEstateRow(lead.id, row)).catch(() => null)
        if (score.score >= 85 || Boolean(input.metadata?.staleListing)) {
          await runNewLeadAutomation({
            leadId: lead.id,
            leadType: input.leadType,
            name: input.name || input.businessName || null,
            email: input.email || null,
            phone: input.phone || null,
            ownerUserId: input.ownerUserId || null,
            sourcePath: input.sourceUrl || null,
            summary: input.painSignal || 'Imported seller inventory from CSV.',
            metadata: input.metadata,
          }).catch(() => null)
        }
        importedSellerInventory += 1
      } else {
        await upsertLead({
          leadType: 'lead_intelligence',
          source: row.source || 'csv_import',
          category: row.niche?.toLowerCase().includes('spanish') ? 'spanish_business' : 'small_business',
          name: row.contact_name || null,
          businessName: row.business_name,
          email: email || null,
          phone: phone || null,
          website: row.website || null,
          city: row.city || null,
          state: row.state || null,
          niche: row.niche || null,
          campaignName,
          emailValid: email ? emailValid : null,
          bounceRiskScore: 10,
          importedAt: new Date().toISOString(),
          marketSegment: 'csv_import',
          formData: { importedFromCsv: true },
          metadata: { importedFromCsv: true, originalSource: row.source || 'csv_import' },
        })
      }
      imported += 1
    }

    return NextResponse.json({
      success: true,
      imported,
      importedSellerInventory,
      skipped,
      invalid,
      total: rows.length,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'CSV import failed.' },
      { status: 500 }
    )
  }
}

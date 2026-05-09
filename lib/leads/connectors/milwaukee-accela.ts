import type { NormalizedLeadInput } from '@/lib/leads/types'
import { stripHtml } from '@/lib/leads/utils'

type SearchMilwaukeeAccelaInput = {
  street?: string
  city?: string
  state?: string
  zip?: string
  limit: number
}

function extractHidden(html: string, name: string) {
  return html.match(new RegExp(`<input[^>]+name="${name.replace(/\$/g, '\\$')}"[^>]+value="([^"]*)"`, 'i'))?.[1] || ''
}

function parseMilwaukeeResults(html: string) {
  const matches = Array.from(
    html.matchAll(/<tr[^>]*class="[^"]*(?:ACA_TabRow|ACA_Table_)[^"]*"[^>]*>([\s\S]*?)<\/tr>/gi)
  )

  return matches
    .map((match) => stripHtml(match[1]))
    .filter((text) => /enforcement|complaint|property/i.test(text))
}

function compactHash(value: string) {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }
  return hash.toString(36)
}

export async function searchMilwaukeeAccela(input: SearchMilwaukeeAccelaInput) {
  if (!input.street && !input.zip && !input.city) {
    return []
  }

  const startPage = await fetch(
    'https://aca-prod.accela.com/MILWAUKEE/Cap/CapHome.aspx?module=Enforcement&TabName=Enforcement',
    {
      headers: { 'user-agent': 'VestBlock Lead Intelligence/1.0 (+https://www.vestblock.io)' },
    }
  )

  const html = await startPage.text()
  const body = new URLSearchParams({
    __EVENTTARGET: 'ctl00$PlaceHolderMain$btnNewSearch',
    __EVENTARGUMENT: '',
    __VIEWSTATE: extractHidden(html, '__VIEWSTATE'),
    __VIEWSTATEGENERATOR: extractHidden(html, '__VIEWSTATEGENERATOR'),
    'ctl00$PlaceHolderMain$ddlSearchType': 'General Search',
    'ctl00$PlaceHolderMain$generalSearchForm$txtGSStartAddressNo': '',
    'ctl00$PlaceHolderMain$generalSearchForm$txtGSStreetName': input.street || '',
    'ctl00$PlaceHolderMain$generalSearchForm$txtGSCity': input.city || 'Milwaukee',
    'ctl00$PlaceHolderMain$generalSearchForm$ddlGSState$State1': input.state || 'WI',
    'ctl00$PlaceHolderMain$generalSearchForm$txtGSAppZipSearchPermit': input.zip || '',
  })

  const response = await fetch(
    'https://aca-prod.accela.com/MILWAUKEE/Cap/CapHome.aspx?module=Enforcement&TabName=Enforcement',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'user-agent': 'VestBlock Lead Intelligence/1.0 (+https://www.vestblock.io)',
      },
      body,
    }
  )

  const resultHtml = await response.text()
  const rows = parseMilwaukeeResults(resultHtml).slice(0, input.limit)

  return rows.map<NormalizedLeadInput>((row) => ({
    leadType: 'code_violation',
    source: 'milwaukee_accela_enforcement',
    sourceUrl:
      'https://aca-prod.accela.com/MILWAUKEE/Cap/CapHome.aspx?module=Enforcement&TabName=Enforcement',
    category: 'code_violation',
    externalId: `milwaukee-${compactHash(`${row}|${input.street || ''}|${input.zip || ''}`)}`,
    propertyAddress: [input.street, input.city || 'Milwaukee', input.state || 'WI', input.zip]
      .filter(Boolean)
      .join(', '),
    city: input.city || 'Milwaukee',
    state: input.state || 'WI',
    zip: input.zip || null,
    painSignal: `${row}; possible seller motivation or landlord distress signal`,
    bestOffer: 'Real Estate Seller Lead',
    marketSegment: 'distressed_property',
    outreachAngle: 'Property compliance pressure and direct-sale options',
    formData: {
      rawResult: row,
    },
    metadata: {
      searchStreet: input.street || null,
      searchZip: input.zip || null,
      urbanMarket: true,
    },
  }))
}

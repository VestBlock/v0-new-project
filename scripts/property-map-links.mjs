#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

function argValue(name, fallback = '') {
  const prefix = `--${name}=`
  const hit = process.argv.find((arg) => arg.startsWith(prefix))
  return hit ? hit.slice(prefix.length).trim() : fallback
}

function argValues(name) {
  const prefix = `--${name}=`
  return process.argv
    .filter((arg) => arg.startsWith(prefix))
    .map((arg) => arg.slice(prefix.length).trim())
    .filter(Boolean)
}

function clean(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function compactAddress(input) {
  return [input.address, input.city, input.state, input.zipCode]
    .map(clean)
    .filter(Boolean)
    .join(', ')
    .replace(/\s+,/g, ',')
    .replace(/,\s*,/g, ', ')
}

function lookupConfig(input) {
  const county = clean(input.county).toLowerCase()
  const state = clean(input.state).toUpperCase()
  const city = clean(input.city).toLowerCase()

  if ((county.includes('genesee') || city === 'flint') && state === 'MI') {
    return {
      countyGisUrl: 'https://app.fetchgis.com/?currentMap=genesee',
      cityPropertyLookupUrl: 'https://www.cityofflint.com/online-service/property-lookup/',
      localPropertyPortalUrl: 'https://flintpropertyportal.com/',
    }
  }

  return {
    countyGisUrl: null,
    cityPropertyLookupUrl: null,
    localPropertyPortalUrl: null,
  }
}

function buildPropertyMapLinks(input) {
  const fullAddress = compactAddress(input)
  const addressQuery = encodeURIComponent(fullAddress || clean(input.address))
  const lookup = lookupConfig(input)
  const parcelIds = [...new Set((input.parcelIds || []).map(clean).filter(Boolean))]

  return {
    fullAddress,
    googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${addressQuery}`,
    googleStreetViewSearchUrl: `https://www.google.com/maps?q=${addressQuery}&layer=c`,
    googleEarthUrl: `https://earth.google.com/web/search/${addressQuery}`,
    bingMapsBirdsEyeUrl: `https://www.bing.com/maps?q=${addressQuery}&style=b`,
    appleMapsUrl: `https://maps.apple.com/?q=${addressQuery}`,
    parcelLinks: parcelIds.map((parcelId) => {
      const parcelQuery = encodeURIComponent(
        [parcelId, input.city, input.county, input.state, 'property parcel'].map(clean).filter(Boolean).join(' ')
      )
      return {
        parcelId,
        googleParcelSearchUrl: `https://www.google.com/search?q=${parcelQuery}`,
        googleMapsParcelSearchUrl: `https://www.google.com/maps/search/?api=1&query=${parcelQuery}`,
        countyGisUrl: lookup.countyGisUrl,
        cityPropertyLookupUrl: lookup.cityPropertyLookupUrl,
        localPropertyPortalUrl: lookup.localPropertyPortalUrl,
      }
    }),
    visualReviewChecklist: [
      'Street View: frontage, boarded openings, access, nearby blight, occupancy signs.',
      'Satellite/Earth: lot contiguity, alley access, vegetation, dumping, encroachments.',
      'County GIS: boundaries, owner, taxes, assessed values, land-use class.',
      'Buyer packet: do not price extra lots until parcel boundaries and access are visually checked.',
    ],
  }
}

const input = {
  address: argValue('address'),
  city: argValue('city'),
  state: argValue('state'),
  zipCode: argValue('zip'),
  county: argValue('county'),
  parcelIds: argValues('parcel'),
}

if (!input.address) {
  console.error('Usage: node scripts/property-map-links.mjs --address="117 E Gracelawn Ave" --city=Flint --state=MI --zip=48505 --county=Genesee --parcel=46-25-331-017')
  process.exit(1)
}

const links = buildPropertyMapLinks(input)
const slug = links.fullAddress
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '')
const outDir = path.join(process.cwd(), 'data', 'property-visuals')
fs.mkdirSync(outDir, { recursive: true })
const outPath = path.join(outDir, `${slug || 'property'}-map-links.json`)
fs.writeFileSync(outPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), input, links }, null, 2)}\n`)

console.log(JSON.stringify({ output: outPath, links }, null, 2))

export type ParcelMapLink = {
  parcelId: string
  googleParcelSearchUrl: string
  googleMapsParcelSearchUrl: string
  countyGisUrl: string | null
  cityPropertyLookupUrl: string | null
  localPropertyPortalUrl: string | null
}

export type PropertyMapLinks = {
  fullAddress: string
  googleMapsUrl: string
  googleStreetViewSearchUrl: string
  googleEarthUrl: string
  bingMapsBirdsEyeUrl: string
  appleMapsUrl: string
  parcelLinks: ParcelMapLink[]
  visualReviewChecklist: string[]
  integrationNotes: string[]
}

export type PropertyMapLinkInput = {
  address: string
  city?: string | null
  state?: string | null
  zipCode?: string | null
  county?: string | null
  parcelIds?: string[] | null
}

function clean(value?: string | null) {
  return typeof value === 'string' ? value.trim() : ''
}

function compactAddress(input: PropertyMapLinkInput) {
  return [input.address, input.city, input.state, input.zipCode]
    .map(clean)
    .filter(Boolean)
    .join(', ')
    .replace(/\s+,/g, ',')
    .replace(/,\s*,/g, ', ')
}

function uniqueParcelIds(parcelIds?: string[] | null) {
  return [...new Set((parcelIds || []).map(clean).filter(Boolean))]
}

function lookupConfig(input: PropertyMapLinkInput) {
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

export function buildPropertyMapLinks(input: PropertyMapLinkInput): PropertyMapLinks {
  const fullAddress = compactAddress(input)
  const addressQuery = encodeURIComponent(fullAddress || clean(input.address))
  const lookup = lookupConfig(input)
  const countyStateQuery = [input.county, input.state, 'parcel'].map(clean).filter(Boolean).join(' ')

  const parcelLinks = uniqueParcelIds(input.parcelIds).map((parcelId) => {
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
  })

  return {
    fullAddress,
    googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${addressQuery}`,
    googleStreetViewSearchUrl: `https://www.google.com/maps?q=${addressQuery}&layer=c`,
    googleEarthUrl: `https://earth.google.com/web/search/${addressQuery}`,
    bingMapsBirdsEyeUrl: `https://www.bing.com/maps?q=${addressQuery}&style=b`,
    appleMapsUrl: `https://maps.apple.com/?q=${addressQuery}`,
    parcelLinks,
    visualReviewChecklist: [
      'Open Google Maps and Street View to confirm frontage, driveway/alley access, boarded openings, nearby blight, and visible occupancy.',
      'Open satellite or Google Earth to confirm whether claimed lots are contiguous and usable together.',
      'Open county GIS or city parcel lookup to verify parcel boundaries, ownership, taxes, assessed values, and land-use class.',
      'Check whether each extra lot has independent access, utility constraints, obvious dumping, trees, steep grade, or encroachments.',
      'Compare house condition against satellite/street imagery before sending buyer pricing or repair assumptions.',
    ],
    integrationNotes: [
      'These links work without a Google Maps Platform key and should be attached to every saved property analysis.',
      'Embedded Street View images or PDF thumbnails require a Google Maps Platform API key with billing enabled.',
      countyStateQuery
        ? `If county-specific URLs are not configured, search "${countyStateQuery}" and add that county portal to the lookup config.`
        : 'If county-specific URLs are not configured, add that county portal to the lookup config after the first manual lookup.',
    ],
  }
}

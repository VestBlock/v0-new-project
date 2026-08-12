import { isPropertyIntelligenceFeatureEnabled } from '@/lib/property-intelligence/feature-flags'

export type NeighborhoodAmenitySummary = {
  schools: number
  parks: number
  groceryStores: number
  transitStops: number
  hospitals: number
  emergencyServices: number
  restaurants: number
  commercialCorridors: number
  confidenceScore: number
  source: 'openstreetmap_overpass'
}

export function buildOverpassNeighborhoodQuery(latitude: number, longitude: number, radiusMeters = 1200) {
  return `
[out:json][timeout:25];
(
  node(around:${radiusMeters},${latitude},${longitude})["amenity"~"school|hospital|police|fire_station|restaurant"];
  node(around:${radiusMeters},${latitude},${longitude})["shop"~"supermarket|grocery"];
  node(around:${radiusMeters},${latitude},${longitude})["public_transport"];
  way(around:${radiusMeters},${latitude},${longitude})["leisure"="park"];
  way(around:${radiusMeters},${latitude},${longitude})["landuse"="commercial"];
);
out center tags;
`.trim()
}

export async function enrichWithOverpassNeighborhood(latitude: number, longitude: number): Promise<NeighborhoodAmenitySummary> {
  if (!isPropertyIntelligenceFeatureEnabled('OVERPASS_ENRICHMENT_ENABLED')) {
    return {
      schools: 0,
      parks: 0,
      groceryStores: 0,
      transitStops: 0,
      hospitals: 0,
      emergencyServices: 0,
      restaurants: 0,
      commercialCorridors: 0,
      confidenceScore: 0,
      source: 'openstreetmap_overpass',
    }
  }

  const response = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ data: buildOverpassNeighborhoodQuery(latitude, longitude) }),
  })
  if (!response.ok) throw new Error(`Overpass request failed with ${response.status}.`)
  const payload = await response.json()
  const elements = Array.isArray(payload.elements) ? payload.elements : []
  const count = (predicate: (tags: Record<string, string>) => boolean) =>
    elements.filter((element: any) => predicate(element.tags || {})).length

  return {
    schools: count((tags) => tags.amenity === 'school'),
    parks: count((tags) => tags.leisure === 'park'),
    groceryStores: count((tags) => tags.shop === 'supermarket' || tags.shop === 'grocery'),
    transitStops: count((tags) => Boolean(tags.public_transport)),
    hospitals: count((tags) => tags.amenity === 'hospital'),
    emergencyServices: count((tags) => tags.amenity === 'police' || tags.amenity === 'fire_station'),
    restaurants: count((tags) => tags.amenity === 'restaurant'),
    commercialCorridors: count((tags) => tags.landuse === 'commercial'),
    confidenceScore: Math.min(90, Math.max(20, elements.length * 5)),
    source: 'openstreetmap_overpass',
  }
}

"use client"

import { useEffect, useMemo, useRef, useState } from 'react'
import type { PropertyIntelligenceRecord } from '@/lib/property-intelligence/types'

declare global {
  interface Window {
    L?: any
  }
}

type Props = {
  properties: PropertyIntelligenceRecord[]
  selectedId?: string | null
  onSelect?: (id: string) => void
  publicMode?: boolean
}

function loadLeaflet() {
  if (typeof window === 'undefined') return Promise.resolve(null)
  if (window.L) return Promise.resolve(window.L)

  return new Promise<any>((resolve, reject) => {
    const existingCss = document.querySelector('link[data-vestblock-leaflet]')
    if (!existingCss) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      link.dataset.vestblockLeaflet = 'true'
      document.head.appendChild(link)
    }

    const existingScript = document.querySelector('script[data-vestblock-leaflet]')
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(window.L))
      existingScript.addEventListener('error', reject)
      return
    }

    const script = document.createElement('script')
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    script.async = true
    script.dataset.vestblockLeaflet = 'true'
    script.onload = () => resolve(window.L)
    script.onerror = reject
    document.body.appendChild(script)
  })
}

function markerColor(score: number) {
  if (score >= 75) return '#22c55e'
  if (score >= 55) return '#06b6d4'
  if (score >= 35) return '#f59e0b'
  return '#94a3b8'
}

export function OsmPropertyMap({ properties, selectedId, onSelect, publicMode }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<any>(null)
  const layerRef = useRef<any>(null)
  const [failed, setFailed] = useState(false)

  const mapped = useMemo(
    () => properties.filter((property) => Number(property.latitude) && Number(property.longitude)),
    [properties]
  )

  useEffect(() => {
    let cancelled = false
    loadLeaflet()
      .then((L) => {
        if (cancelled || !L || !containerRef.current) return
        if (!mapRef.current) {
          mapRef.current = L.map(containerRef.current, { scrollWheelZoom: true }).setView([39.1, -94.58], 5)
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap contributors',
          }).addTo(mapRef.current)
          layerRef.current = L.layerGroup().addTo(mapRef.current)
        }

        layerRef.current.clearLayers()
        const bounds: any[] = []
        for (const property of mapped) {
          const score = property.deal_scores?.[0]?.score || 0
          const lat = Number(property.latitude)
          const lng = Number(property.longitude)
          const marker = L.circleMarker([lat, lng], {
            radius: selectedId === property.id ? 9 : 7,
            color: markerColor(score),
            fillColor: markerColor(score),
            fillOpacity: selectedId === property.id ? 0.95 : 0.65,
            weight: selectedId === property.id ? 3 : 2,
          })
          marker.bindPopup(`
            <strong>${property.property_address || 'Property'}</strong><br/>
            ${[property.city, property.state, property.zip_code].filter(Boolean).join(', ')}<br/>
            Score: ${score}/100<br/>
            ${publicMode ? '' : `Owner: ${property.owner_entities?.owner_name || 'Unknown'}<br/>`}
            ${property.is_vacant_lot ? 'Potential vacant lot' : 'Public-record opportunity'}
          `)
          marker.on('click', () => onSelect?.(property.id))
          marker.addTo(layerRef.current)
          bounds.push([lat, lng])
        }
        if (bounds.length) mapRef.current.fitBounds(bounds, { padding: [34, 34], maxZoom: 12 })
      })
      .catch(() => setFailed(true))
    return () => {
      cancelled = true
    }
  }, [mapped, onSelect, publicMode, selectedId])

  if (failed) {
    return (
      <div className="flex h-[520px] items-center justify-center rounded-lg border border-slate-800 bg-slate-950 text-sm text-slate-400">
        Map assets could not load. Property table and exports are still available.
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
      <div ref={containerRef} className="h-[520px] w-full" />
      {!mapped.length ? (
        <div className="border-t border-slate-800 px-4 py-3 text-sm text-slate-400">
          No latitude/longitude records in the current filter. Import county parcel GeoJSON or CSVs with lat/lng for map pins.
        </div>
      ) : null}
    </div>
  )
}

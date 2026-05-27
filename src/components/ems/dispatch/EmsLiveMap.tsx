'use client'

import { useEffect, useRef, useCallback } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { EMS_STATUS_COLORS, EMS_SEVERITY_COLORS } from '@/lib/ems-config'
import type { FleetUnit } from '@/lib/api-client/ems-dispatch'

const ICON_SIZE = 12
const INCIDENT_SIZE = 18

function createUnitIcon(color: string, isDispatched: boolean) {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:${ICON_SIZE}px;height:${ICON_SIZE}px;
      border-radius:50%;
      background:${color};
      border:2px solid rgba(255,255,255,0.8);
      box-shadow:0 0 ${isDispatched ? '12' : '6'}px ${color},
                 inset 0 0 4px rgba(255,255,255,0.3);
      transition:all 0.3s;
      ${isDispatched ? 'animation:unitPulse 1.5s ease-in-out infinite;' : ''}
    " />`,
    iconSize: [ICON_SIZE + 4, ICON_SIZE + 4],
    iconAnchor: [(ICON_SIZE + 4) / 2, (ICON_SIZE + 4) / 2],
  })
}

function createIncidentIcon(severity: string) {
  const color = EMS_SEVERITY_COLORS[severity] || '#ef4444'
  return L.divIcon({
    className: '',
    html: `<div style="
      width:${INCIDENT_SIZE}px;height:${INCIDENT_SIZE}px;
      border-radius:50%;
      background:${color};
      border:3px solid rgba(255,255,255,0.9);
      box-shadow:0 0 20px ${color}, 0 0 40px ${color}44,
                 inset 0 0 6px rgba(255,255,255,0.4);
      animation:incidentPulse 1s ease-in-out infinite;
      cursor:pointer;
    ">
      <div style="
        position:absolute;top:50%;left:50%;
        transform:translate(-50%,-50%);
        width:6px;height:6px;border-radius:50%;
        background:white;opacity:0.8;
      " />
    </div>`,
    iconSize: [INCIDENT_SIZE + 8, INCIDENT_SIZE + 8],
    iconAnchor: [(INCIDENT_SIZE + 8) / 2, (INCIDENT_SIZE + 8) / 2],
  })
}

function createRouteLine(latLngs: [number, number][], color: string): L.Polyline {
  return L.polyline(latLngs, {
    color,
    weight: 2.5,
    opacity: 0.6,
    dashArray: '8, 12',
    lineCap: 'round',
  })
}

export default function EmsLiveMap({
  incidentLat,
  incidentLng,
  incidentId,
  severity,
  units,
  dispatchedUnitId,
}: {
  incidentLat: number
  incidentLng: number
  incidentId: string
  severity: string
  units: FleetUnit[]
  dispatchedUnitId: string | null
}) {
  const mapRef = useRef<L.Map | null>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const markersRef = useRef<Map<string, L.Marker>>(new Map())
  const incidentMarkerRef = useRef<L.Marker | null>(null)
  const routeLineRef = useRef<L.Polyline | null>(null)

  const initMap = useCallback(() => {
    if (mapRef.current || !mapContainerRef.current) return

    const map = L.map(mapContainerRef.current, {
      center: [incidentLat, incidentLng],
      zoom: 13,
      zoomControl: true,
      attributionControl: false,
    })

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
    }).addTo(map)

    const style = document.createElement('style')
    style.textContent = `
      @keyframes unitPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.7;transform:scale(1.15)} }
      @keyframes incidentPulse { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.25);opacity:0.85} }
      .leaflet-container { background: #0a0a14 !important }
      .leaflet-control-zoom a { background: rgba(20,22,36,0.9) !important; color: #94a3b8 !important; border-color: rgba(255,255,255,0.1) !important; }
      .leaflet-control-zoom a:hover { background: rgba(30,32,48,0.95) !important; color: #60a5fa !important; }
    `
    document.head.appendChild(style)

    mapRef.current = map
    setTimeout(() => map.invalidateSize(), 200)
  }, [incidentLat, incidentLng])

  useEffect(() => {
    initMap()
    return () => {
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [initMap])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    if (incidentMarkerRef.current) {
      incidentMarkerRef.current.remove()
    }

    const im = L.marker([incidentLat, incidentLng], { icon: createIncidentIcon(severity), zIndexOffset: 1000 })
      .addTo(map)
      .bindPopup(`
        <div style="font-family:system-ui;background:#0f0f1a;color:#e2e8f0;border-radius:8px;padding:6px 10px;min-width:180px">
          <div style="font-weight:700;font-size:13px;color:${EMS_SEVERITY_COLORS[severity] || '#ef4444'};margin-bottom:4px">
            🚨 ${severity} — ${incidentId || 'Incident'}
          </div>
          <div style="font-size:11px;color:#94a3b8">${incidentLat.toFixed(4)}, ${incidentLng.toFixed(4)}</div>
          <div style="font-size:11px;color:#64748b;margin-top:2px">${new Date().toLocaleTimeString()}</div>
        </div>
      `, { closeButton: false, className: '' })
    incidentMarkerRef.current = im

    if (!map.getBounds().contains([incidentLat, incidentLng])) {
      map.setView([incidentLat, incidentLng], 13)
    }
  }, [incidentLat, incidentLng, incidentId, severity])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const currentIds = new Set(units.map((u) => u.id))

    markersRef.current.forEach((marker, id) => {
      if (!currentIds.has(id)) {
        marker.remove()
        markersRef.current.delete(id)
      }
    })

    units.forEach((unit) => {
      if (!unit.lat || !unit.lng) return
      const color = EMS_STATUS_COLORS[unit.status] || '#6b7280'
      const existing = markersRef.current.get(unit.id)
      const isDispatched = unit.status === 'DISPATCHED' || unit.status === 'EN_ROUTE'

      if (existing) {
        existing.setLatLng([unit.lat, unit.lng])
        existing.setIcon(createUnitIcon(color, isDispatched))
      } else {
        const marker = L.marker([unit.lat, unit.lng], {
          icon: createUnitIcon(color, isDispatched),
          zIndexOffset: unit.id === dispatchedUnitId ? 500 : 0,
        }).addTo(map)

        marker.bindTooltip(`
          <div style="font-family:system-ui;background:#0f0f1a;color:#e2e8f0;border-radius:6px;padding:4px 8px;font-size:11px;min-width:140px">
            <strong style="color:${color}">${unit.unitNumber}</strong>
            <span style="color:#64748b;margin-left:6px">${unit.type}</span>
            <div style="color:#94a3b8;margin-top:2px">${unit.status.replace(/_/g, ' ')}</div>
          </div>
        `, { direction: 'top', offset: L.point(0, -8) })

        markersRef.current.set(unit.id, marker)
      }
    })
  }, [units, dispatchedUnitId])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    if (routeLineRef.current) {
      routeLineRef.current.remove()
      routeLineRef.current = null
    }

    if (dispatchedUnitId) {
      const dispatchedUnit = units.find((u) => u.id === dispatchedUnitId)
      if (dispatchedUnit && dispatchedUnit.lat && dispatchedUnit.lng) {
        const line = createRouteLine(
          [[dispatchedUnit.lat, dispatchedUnit.lng], [incidentLat, incidentLng]],
          EMS_SEVERITY_COLORS[severity] || '#ef4444'
        )
        line.addTo(map)
        routeLineRef.current = line
      }
    }
  }, [dispatchedUnitId, units, incidentLat, incidentLng, severity])

  return (
    <div ref={mapContainerRef} style={{ width: '100%', height: '100%', borderRadius: 8, overflow: 'hidden' }} />
  )
}

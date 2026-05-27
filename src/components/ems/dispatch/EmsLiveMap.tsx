'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { EMS_STATUS_COLORS, EMS_SEVERITY_COLORS } from '@/lib/ems-config'
import type { FleetUnit } from '@/lib/api-client/ems-dispatch'
import type { LiveUnitPosition } from '@/hooks/useRealtimeFleet'

const ICON_SIZE = 12
const INCIDENT_SIZE = 18
const USER_DOT_SIZE = 14

function createUnitIcon(color: string, isDispatched: boolean, isLive: boolean) {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:${ICON_SIZE}px;height:${ICON_SIZE}px;
      border-radius:50%;
      background:${color};
      border:2px solid rgba(255,255,255,0.8);
      box-shadow:0 0 ${isDispatched ? '12' : isLive ? '8' : '6'}px ${color},
                 inset 0 0 4px rgba(255,255,255,0.3);
      transition:all 0.3s;
      ${isDispatched ? 'animation:unitPulse 1.5s ease-in-out infinite;' : ''}
      ${isLive ? 'animation:livePulse 2s ease-in-out infinite;' : ''}
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

function createUserIcon() {
  return L.divIcon({
    className: '',
    html: `<div style="position:relative">
      <div style="
        width:${USER_DOT_SIZE}px;height:${USER_DOT_SIZE}px;
        border-radius:50%;
        background:#3b82f6;
        border:3px solid rgba(255,255,255,0.9);
        box-shadow:0 0 16px #3b82f6, 0 0 32px #3b82f644;
        animation:userPulse 2s ease-in-out infinite;
      " />
      <div style="
        position:absolute;top:50%;left:50%;
        transform:translate(-50%,-50%);
        width:4px;height:4px;border-radius:50%;
        background:white;
      " />
    </div>`,
    iconSize: [USER_DOT_SIZE + 8, USER_DOT_SIZE + 8],
    iconAnchor: [(USER_DOT_SIZE + 8) / 2, (USER_DOT_SIZE + 8) / 2],
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
  userLocation,
  livePositions,
  fleetConnectionState,
}: {
  incidentLat: number
  incidentLng: number
  incidentId: string
  severity: string
  units: FleetUnit[]
  dispatchedUnitId: string | null
  userLocation?: { latitude: number; longitude: number; heading: number | null } | null
  livePositions?: Map<string, LiveUnitPosition>
  fleetConnectionState?: string
}) {
  const mapRef = useRef<L.Map | null>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const markersRef = useRef<Map<string, L.Marker>>(new Map())
  const liveMarkerRef = useRef<Map<string, L.Marker>>(new Map())
  const incidentMarkerRef = useRef<L.Marker | null>(null)
  const routeLineRef = useRef<L.Polyline | null>(null)
  const userMarkerRef = useRef<L.Marker | null>(null)
  const [autoFollow, setAutoFollow] = useState(true)
  const [trafficOverlay, setTrafficOverlay] = useState(false)
  const animationFrameRef = useRef<number | null>(null)
  const lastAnimatedPositions = useRef<Map<string, { lat: number; lng: number }>>(new Map())

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
      @keyframes livePulse { 0%,100%{opacity:1} 50%{opacity:0.6} }
      @keyframes incidentPulse { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.25);opacity:0.85} }
      @keyframes userPulse { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.2);opacity:0.7} }
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
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current)
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [initMap])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    if (incidentMarkerRef.current) incidentMarkerRef.current.remove()

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
      if (!userLocation || !autoFollow) map.setView([incidentLat, incidentLng], 13)
    }
  }, [incidentLat, incidentLng, incidentId, severity, userLocation, autoFollow])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const currentIds = new Set(units.map((u) => u.id))
    markersRef.current.forEach((marker, id) => {
      if (!currentIds.has(id)) { marker.remove(); markersRef.current.delete(id) }
    })

    units.forEach((unit) => {
      if (!unit.lat || !unit.lng) return
      const color = EMS_STATUS_COLORS[unit.status] || '#6b7280'
      const existing = markersRef.current.get(unit.id)
      const isDispatched = unit.status === 'DISPATCHED' || unit.status === 'EN_ROUTE'
      const isLive = livePositions?.has(unit.id)

      if (existing) {
        existing.setLatLng([unit.lat, unit.lng])
        existing.setIcon(createUnitIcon(color, isDispatched, !!isLive))
      } else {
        const marker = L.marker([unit.lat, unit.lng], {
          icon: createUnitIcon(color, isDispatched, !!isLive),
          zIndexOffset: unit.id === dispatchedUnitId ? 500 : 0,
        }).addTo(map)

        marker.bindTooltip(`
          <div style="font-family:system-ui;background:#0f0f1a;color:#e2e8f0;border-radius:6px;padding:4px 8px;font-size:11px;min-width:140px">
            <strong style="color:${color}">${unit.unitNumber}</strong>
            <span style="color:#64748b;margin-left:6px">${unit.type}</span>
            <div style="color:#94a3b8;margin-top:2px">${unit.status.replace(/_/g, ' ')}${isLive ? ' · LIVE' : ''}</div>
          </div>
        `, { direction: 'top', offset: L.point(0, -8) })

        markersRef.current.set(unit.id, marker)
      }
    })
  }, [units, dispatchedUnitId, livePositions])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !livePositions?.size) return

    const liveUnitSet = new Set<string>()
    livePositions.forEach((livePos) => {
      liveUnitSet.add(livePos.unitId)

      const color = EMS_STATUS_COLORS[livePos.status] || '#6b7280'
      const isDispatched = livePos.status === 'DISPATCHED' || livePos.status === 'EN_ROUTE'
      const existing = liveMarkerRef.current.get(livePos.unitId)

      if (existing) {
        existing.setLatLng([livePos.lat, livePos.lng])
        existing.setIcon(createUnitIcon(color, isDispatched, true))
        existing.setTooltipContent(`
          <div style="font-family:system-ui;background:#0f0f1a;color:#e2e8f0;border-radius:6px;padding:4px 8px;font-size:11px;min-width:140px">
            <strong style="color:${color}">${livePos.unitNumber}</strong>
            <span style="color:#22c55e;margin-left:4px">● LIVE</span>
            <div style="color:#94a3b8;margin-top:2px">${livePos.status.replace(/_/g, ' ')}${livePos.speed != null ? ` · ${Math.round(livePos.speed)} km/h` : ''}</div>
          </div>
        `)
      } else {
        const marker = L.marker([livePos.lat, livePos.lng], {
          icon: createUnitIcon(color, isDispatched, true),
          zIndexOffset: 600,
        }).addTo(map)

        marker.bindTooltip(`
          <div style="font-family:system-ui;background:#0f0f1a;color:#e2e8f0;border-radius:6px;padding:4px 8px;font-size:11px;min-width:140px">
            <strong style="color:${color}">${livePos.unitNumber}</strong>
            <span style="color:#22c55e;margin-left:4px">● LIVE</span>
            <div style="color:#94a3b8;margin-top:2px">${livePos.status.replace(/_/g, ' ')}${livePos.speed != null ? ` · ${Math.round(livePos.speed)} km/h` : ''}</div>
          </div>
        `, { direction: 'top', offset: L.point(0, -8) })

        liveMarkerRef.current.set(livePos.unitId, marker)
      }
    })

    liveMarkerRef.current.forEach((marker, id) => {
      if (!liveUnitSet.has(id)) { marker.remove(); liveMarkerRef.current.delete(id) }
    })
  }, [livePositions])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    if (routeLineRef.current) { routeLineRef.current.remove(); routeLineRef.current = null }

    if (dispatchedUnitId) {
      const dispatchedUnit = units.find((u) => u.id === dispatchedUnitId)
      const livePos = livePositions?.get(dispatchedUnitId)
      if (dispatchedUnit && dispatchedUnit.lat && dispatchedUnit.lng) {
        const line = createRouteLine(
          [[dispatchedUnit.lat, dispatchedUnit.lng], [incidentLat, incidentLng]],
          EMS_SEVERITY_COLORS[severity] || '#ef4444'
        )
        line.addTo(map)
        routeLineRef.current = line
      } else if (livePos) {
        const line = createRouteLine(
          [[livePos.lat, livePos.lng], [incidentLat, incidentLng]],
          EMS_SEVERITY_COLORS[severity] || '#ef4444'
        )
        line.addTo(map)
        routeLineRef.current = line
      }
    }
  }, [dispatchedUnitId, units, livePositions, incidentLat, incidentLng, severity])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    if (userLocation?.latitude && userLocation?.longitude) {
      if (userMarkerRef.current) {
        userMarkerRef.current.setLatLng([userLocation.latitude, userLocation.longitude])
      } else {
        const marker = L.marker([userLocation.latitude, userLocation.longitude], {
          icon: createUserIcon(),
          zIndexOffset: 2000,
        }).addTo(map)

        marker.bindTooltip(`
          <div style="font-family:system-ui;background:#0f0f1a;color:#e2e8f0;border-radius:6px;padding:4px 8px;font-size:11px">
            <strong style="color:#60a5fa">Dispatch Operator</strong>
            <div style="color:#94a3b8;margin-top:2px">${userLocation.heading ? `${Math.round(userLocation.heading)}° heading` : 'Live position'}</div>
          </div>
        `, { direction: 'top', offset: L.point(0, -12) })

        userMarkerRef.current = marker
      }

      if (autoFollow) {
        map.setView([userLocation.latitude, userLocation.longitude], map.getZoom())
      }
    }
  }, [userLocation, autoFollow])

  const toggleAutoFollow = () => setAutoFollow((p) => !p)
  const toggleTraffic = () => {
    setTrafficOverlay((p) => !p)
    if (!mapRef.current) return
    if (trafficOverlay) {
      mapRef.current.eachLayer((layer) => {
        if ((layer as any).options?.isTraffic) mapRef.current?.removeLayer(layer)
      })
    } else {
      L.tileLayer('https://{s}.tile.openstreetmap.de/{z}/{x}/{y}.png', {
        isTraffic: true,
        opacity: 0.3,
        maxZoom: 19,
      } as any).addTo(mapRef.current)
    }
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', borderRadius: 8, overflow: 'hidden' }}>
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

      {fleetConnectionState && (
        <div style={{
          position: 'absolute', top: 44, left: 10, zIndex: 1000,
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '3px 8px', borderRadius: 4, fontSize: 9,
          background: fleetConnectionState === 'connected' ? 'rgba(34,197,94,0.15)' :
                      fleetConnectionState === 'connecting' ? 'rgba(234,179,8,0.15)' : 'rgba(100,116,139,0.15)',
          color: fleetConnectionState === 'connected' ? '#22c55e' :
                 fleetConnectionState === 'connecting' ? '#eab308' : '#64748b',
          backdropFilter: 'blur(4px)',
        }}>
          <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'currentColor', display: 'inline-block',
            animation: fleetConnectionState === 'connected' ? 'none' : 'opacityPulse 1s infinite' }} />
          {fleetConnectionState === 'connected' ? 'LIVE' :
           fleetConnectionState === 'connecting' ? 'CONNECTING' : 'OFFLINE'}
          <style>{`@keyframes opacityPulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
        </div>
      )}

      <div style={{
        position: 'absolute', bottom: 10, right: 10, zIndex: 1000,
        display: 'flex', flexDirection: 'column', gap: 4,
      }}>
        <button onClick={toggleAutoFollow}
          style={{
            padding: '5px 8px', borderRadius: 4, fontSize: 9, fontWeight: 600,
            background: autoFollow ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.06)',
            border: `1px solid ${autoFollow ? 'rgba(59,130,246,0.4)' : 'rgba(255,255,255,0.1)'}`,
            color: autoFollow ? '#60a5fa' : '#94a3b8',
            cursor: 'pointer', backdropFilter: 'blur(4px)',
          }}
        >
          {autoFollow ? '◎ FOLLOW' : '◉ FREE'}
        </button>
        <button onClick={toggleTraffic}
          style={{
            padding: '5px 8px', borderRadius: 4, fontSize: 9, fontWeight: 600,
            background: trafficOverlay ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.06)',
            border: `1px solid ${trafficOverlay ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.1)'}`,
            color: trafficOverlay ? '#22c55e' : '#94a3b8',
            cursor: 'pointer', backdropFilter: 'blur(4px)',
          }}
        >
          {trafficOverlay ? 'TRAFFIC ON' : 'TRAFFIC OFF'}
        </button>
      </div>
    </div>
  )
}



'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { getSocket } from '@/lib/socket-client'

export type LiveUnitPosition = {
  unitId: string
  unitNumber: string
  lat: number
  lng: number
  heading: number | null
  speed: number | null
  status: string
  timestamp: number
}

export type FleetConnectionState = 'connecting' | 'connected' | 'disconnected' | 'unsupported'

export function useRealtimeFleet(companyId?: string) {
  const [livePositions, setLivePositions] = useState<Map<string, LiveUnitPosition>>(new Map())
  const [connectionState, setConnectionState] = useState<FleetConnectionState>('disconnected')
  const positionsRef = useRef<Map<string, LiveUnitPosition>>(new Map())
  const subscribedRef = useRef(false)

  useEffect(() => {
    if (!companyId) return

    let mounted = true

    const initSocket = async () => {
      const socket = await getSocket()
      if (!mounted) return

      if (!socket) {
        setConnectionState('unsupported')
        return
      }

      const onConnect = () => {
        if (!mounted) return
        setConnectionState('connected')
        socket.emit('subscribe', { workspaceId: companyId })
        subscribedRef.current = true
      }

      const onDisconnect = () => {
        if (!mounted) return
        setConnectionState('disconnected')
      }

      const onPosition = (payload: any) => {
        if (!mounted) return
        if (!payload?.unitId || !payload?.lat || !payload?.lng) return

        const update: LiveUnitPosition = {
          unitId: payload.unitId,
          unitNumber: payload.unitNumber || payload.unitId,
          lat: payload.lat,
          lng: payload.lng,
          heading: payload.heading ?? null,
          speed: payload.speed ?? null,
          status: payload.status || 'AVAILABLE',
          timestamp: Date.now(),
        }

        positionsRef.current.set(update.unitId, update)
        setLivePositions(new Map(positionsRef.current))
      }

      const onUnitStatus = (payload: any) => {
        if (!mounted) return
        if (!payload?.unitId) return
        const existing = positionsRef.current.get(payload.unitId)
        if (existing) {
          const updated = { ...existing, status: payload.newStatus || existing.status }
          positionsRef.current.set(payload.unitId, updated)
          setLivePositions(new Map(positionsRef.current))
        }
      }

      socket.on('connect', onConnect)
      socket.on('disconnect', onDisconnect)
      socket.on('ems:unit:position', onPosition)
      socket.on('ems:unit:status', onUnitStatus)

      if (socket.connected) {
        onConnect()
      } else {
        setConnectionState('connecting')
        socket.connect()
      }

      const pollInterval = setInterval(async () => {
        if (!socket.connected && !subscribedRef.current) {
          try {
            const res = await fetch('/api/ems/units', { credentials: 'same-origin' })
            const json = await res.json()
            const units = Array.isArray(json) ? json : json?.data || []
            if (!mounted) return
            for (const u of units) {
              if (u.lat && u.lng) {
                positionsRef.current.set(u.id, {
                  unitId: u.id,
                  unitNumber: u.unitNumber,
                  lat: u.lat,
                  lng: u.lng,
                  heading: u.heading ?? null,
                  speed: u.speed ?? null,
                  status: u.status || 'AVAILABLE',
                  timestamp: Date.now(),
                })
              }
            }
            setLivePositions(new Map(positionsRef.current))
          } catch {
            // polling fallback failed — silent
          }
        }
      }, 15000)

      return () => {
        clearInterval(pollInterval)
        socket.off('connect', onConnect)
        socket.off('disconnect', onDisconnect)
        socket.off('ems:unit:position', onPosition)
        socket.off('ems:unit:status', onUnitStatus)
      }
    }

    const cleanupPromise = initSocket()

    return () => {
      mounted = false
      cleanupPromise.then((cleanup) => cleanup?.())
      subscribedRef.current = false
    }
  }, [companyId])

  const getUnitPosition = useCallback((unitId: string): LiveUnitPosition | undefined => {
    return positionsRef.current.get(unitId)
  }, [])

  return {
    livePositions,
    connectionState,
    getUnitPosition,
    unitsOnline: livePositions.size,
  }
}

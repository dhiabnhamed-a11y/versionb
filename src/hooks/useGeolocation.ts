'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

export type GeolocationState = {
  latitude: number | null
  longitude: number | null
  heading: number | null
  speed: number | null
  accuracy: number | null
  timestamp: number | null
  permissionState: 'prompt' | 'granted' | 'denied' | 'unsupported' | 'unknown'
  error: GeolocationError | null
}

export type GeolocationError = {
  code: number
  message: string
}

type GeolocationOptions = {
  enableHighAccuracy?: boolean
  timeout?: number
  maximumAge?: number
  watchMode?: boolean
}

function getCurrentPermission(): Promise<'prompt' | 'granted' | 'denied'> {
  if (!navigator.permissions || !navigator.permissions.query) {
    return Promise.resolve('prompt')
  }
  return navigator.permissions
    .query({ name: 'geolocation' as PermissionName })
    .then((result) => result.state as 'prompt' | 'granted' | 'denied')
    .catch(() => 'prompt' as const)
}

export function useGeolocation(options: GeolocationOptions = {}) {
  const {
    enableHighAccuracy = true,
    timeout = 10000,
    maximumAge = 0,
    watchMode = true,
  } = options

  const [state, setState] = useState<GeolocationState>({
    latitude: null,
    longitude: null,
    heading: null,
    speed: null,
    accuracy: null,
    timestamp: null,
    permissionState: typeof window !== 'undefined' && 'geolocation' in navigator ? 'prompt' : 'unsupported',
    error: null,
  })

  const watchIdRef = useRef<number | null>(null)
  const mountedRef = useRef(true)
  const lastPositionRef = useRef<GeolocationPosition | null>(null)

  const stopWatching = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
  }, [])

  const startWatching = useCallback(() => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) return

    stopWatching()

    const onSuccess = (position: GeolocationPosition) => {
      if (!mountedRef.current) return
      lastPositionRef.current = position

      setState({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        heading: position.coords.heading,
        speed: position.coords.speed,
        accuracy: position.coords.accuracy,
        timestamp: position.timestamp,
        permissionState: 'granted',
        error: null,
      })
    }

    const onError = (error: GeolocationPositionError) => {
      if (!mountedRef.current) return

      let permissionState: GeolocationState['permissionState'] = 'denied'
      if (error.code === error.PERMISSION_DENIED) {
        permissionState = 'denied'
      } else if (error.code === error.TIMEOUT) {
        permissionState = 'prompt'
      } else if (error.code === error.POSITION_UNAVAILABLE) {
        permissionState = state.permissionState === 'granted' ? 'granted' : 'prompt'
      }

      setState((prev) => ({
        ...prev,
        permissionState,
        error: { code: error.code, message: error.message },
      }))
    }

    if (watchMode) {
      watchIdRef.current = navigator.geolocation.watchPosition(onSuccess, onError, {
        enableHighAccuracy,
        timeout,
        maximumAge,
      })
    } else {
      navigator.geolocation.getCurrentPosition(onSuccess, onError, {
        enableHighAccuracy,
        timeout,
        maximumAge,
      })
    }
  }, [enableHighAccuracy, timeout, maximumAge, watchMode, state.permissionState, stopWatching])

  useEffect(() => {
    mountedRef.current = true

    if (!('geolocation' in navigator)) {
      setState((prev) => ({ ...prev, permissionState: 'unsupported' }))
      return
    }

    getCurrentPermission().then((perm) => {
      if (!mountedRef.current) return
      setState((prev) => ({ ...prev, permissionState: perm }))

      if (perm === 'granted') {
        startWatching()
      }
    })

    return () => {
      mountedRef.current = false
      stopWatching()
    }
  }, [startWatching, stopWatching])

  const requestPermission = useCallback(() => {
    if (!('geolocation' in navigator)) return
    startWatching()
  }, [startWatching])

  const refreshPosition = useCallback(() => {
    if (!('geolocation' in navigator)) return

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (!mountedRef.current) return
        lastPositionRef.current = position
        setState({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          heading: position.coords.heading,
          speed: position.coords.speed,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
          permissionState: 'granted',
          error: null,
        })
      },
      (error) => {
        if (!mountedRef.current) return
        setState((prev) => ({
          ...prev,
          error: { code: error.code, message: error.message },
        }))
      },
      { enableHighAccuracy, timeout, maximumAge }
    )
  }, [enableHighAccuracy, timeout, maximumAge])

  return {
    ...state,
    requestPermission,
    refreshPosition,
    stopWatching,
    hasLocation: state.latitude !== null && state.longitude !== null,
    isTracking: watchIdRef.current !== null,
  }
}

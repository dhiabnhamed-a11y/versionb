'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Radio, Target, Navigation, Brain, AlertTriangle, CheckCircle2, XCircle,
  Loader2, Search, MapPin, Clock, Shield, Activity, Zap, Siren, Gauge,
  Filter, ArrowUpDown, Fuel, Users, TrendingUp, Crosshair, Bell, Satellite,
  Map, Crosshair as CrosshairIcon,
} from 'lucide-react'
import EmsLiveMap from './EmsLiveMap'
import AiRecommendationPanel from './AiRecommendationPanel'
import DispatchTimeline from './DispatchTimeline'
import {
  findUnits as apiFindUnits,
  getAiRecommendation as apiGetRecommendation,
  autoDispatch as apiAutoDispatch,
  type FleetUnit,
  type DispatchCandidate,
  type AiRecommendationResult,
  type AutoDispatchResult,
} from '@/lib/api-client/ems-dispatch'
import { EMS_STATUS_COLORS, EMS_SEVERITY_COLORS } from '@/lib/ems-config'
import { useGeolocation } from '@/hooks/useGeolocation'
import { useRealtimeFleet } from '@/hooks/useRealtimeFleet'

type TimelineEvent = {
  id: string
  type: 'received' | 'ai_analysis' | 'unit_assigned' | 'crew_notified' | 'en_route' | 'eta_update' | 'radio' | 'arrived' | 'alert'
  title: string
  description: string
  timestamp: Date
  critical?: boolean
}

type RadioMessage = {
  sender: string
  message: string
  time: Date
}

export default function SmartDispatchConsole() {
  const [incidentId, setIncidentId] = useState('')
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [severity, setSeverity] = useState('ALPHA')
  const [units, setUnits] = useState<FleetUnit[]>([])
  const [candidates, setCandidates] = useState<DispatchCandidate[]>([])
  const [loading, setLoading] = useState(false)
  const [aiScanning, setAiScanning] = useState(false)
  const [aiResult, setAiResult] = useState<AiRecommendationResult | null>(null)
  const [dispatchedUnitId, setDispatchedUnitId] = useState<string | null>(null)
  const [dispatchResult, setDispatchResult] = useState<{ success: boolean; message: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([])
  const [etaSeconds, setEtaSeconds] = useState(0)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'score' | 'eta' | 'distance'>('score')
  const [radioMessages, setRadioMessages] = useState<RadioMessage[]>([])

  const geo = useGeolocation({ enableHighAccuracy: true, watchMode: true })
  const { livePositions, connectionState } = useRealtimeFleet(undefined)

  const addTimelineEvent = useCallback((type: TimelineEvent['type'], title: string, description: string, critical = false) => {
    setTimelineEvents((prev) => [...prev, { id: crypto.randomUUID(), type, title, description, timestamp: new Date(), critical }])
  }, [])

  const addRadioMessage = useCallback((sender: string, message: string) => {
    setRadioMessages((prev) => [...prev.slice(-19), { sender, message, time: new Date() }])
  }, [])

  const findUnits = useCallback(async () => {
    if (!lat || !lng) { setError('Enter incident coordinates'); return }
    const parsedLat = parseFloat(lat)
    const parsedLng = parseFloat(lng)
    if (isNaN(parsedLat) || isNaN(parsedLng)) { setError('Invalid coordinates'); return }

    setLoading(true)
    setError(null)
    setAiResult(null)
    setDispatchedUnitId(null)
    setDispatchResult(null)
    setCandidates([])
    addTimelineEvent('received', 'Incident received', `Location: ${parsedLat.toFixed(4)}, ${parsedLng.toFixed(4)} · Severity: ${severity}`)

    try {
      const result = await apiFindUnits(parsedLat, parsedLng, severity, { maxResults: 10 })
      setUnits(result.units || [])
      setCandidates(result.candidates || [])
      setLoading(false)
      addTimelineEvent('ai_analysis', 'Unit search complete', `Found ${result.candidates?.length || 0} available units via real database query`)

      if (!result.candidates?.length) {
        setError('No nearby available units found. Expand search or adjust parameters.')
      }
    } catch (err: any) {
      setLoading(false)
      setError(err.message || 'Failed to search for units. Database may need migration.')
    }
  }, [lat, lng, severity, addTimelineEvent])

  const getAiRecommendation = useCallback(async () => {
    if (!candidates.length) { setError('Search for units first'); return }
    if (!incidentId) { setError('Enter an incident ID for AI analysis'); return }

    setAiScanning(true)
    setError(null)
    addTimelineEvent('ai_analysis', 'AI neural analysis started', `${candidates.length} units evaluated across 6 dispatch factors`)

    try {
      const rec = await apiGetRecommendation('', incidentId, parseFloat(lat), parseFloat(lng), severity)
      setAiResult(rec)
      setAiScanning(false)

      if (rec.candidates?.length) {
        const best = rec.candidates[0]
        addTimelineEvent('ai_analysis', 'AI recommendation generated', `Best unit: ${best.unitNumber} · Score: ${best.score} · ETA: ${Math.round(best.etaSeconds / 60)} min`)
        addTimelineEvent('eta_update', 'ETA calculated', `${Math.round(best.etaSeconds / 60)} min estimated arrival via Haversine`, false)
      } else {
        addTimelineEvent('alert', 'AI analysis complete', 'No suitable unit found', true)
      }
    } catch (err: any) {
      setAiScanning(false)
      setError(err.message || 'AI analysis failed')
    }
  }, [candidates, incidentId, lat, lng, severity, addTimelineEvent])

  const autoDispatch = useCallback(async () => {
    if (!aiResult?.candidates?.length) { setError('Generate AI recommendation first'); return }
    if (!incidentId) { setError('Enter incident ID for dispatch'); return }

    const best = aiResult.candidates[0]
    setDispatchedUnitId(best.unitId)
    setEtaSeconds(best.etaSeconds)

    addTimelineEvent('unit_assigned', 'Unit assigned', `${best.unitNumber} selected by AI dispatch engine`, false)

    try {
      const result = await apiAutoDispatch(incidentId, severity)
      if (result.success) {
        addTimelineEvent('crew_notified', 'Crew notified', `Real alert sent to ${best.unitNumber} crew via Firebase + DB`, true)
        setDispatchResult({ success: true, message: `Auto-dispatched ${best.unitNumber} via AI (score: ${best.score})` })
        addTimelineEvent('en_route', 'Vehicle dispatched', `${best.unitNumber} responding to ${incidentId}`, true)
        addRadioMessage('Dispatch', `${best.unitNumber}, you are dispatched to ${incidentId} at ${lat}, ${lng}. Severity: ${severity}.`)
        addRadioMessage(best.unitNumber, 'Copy dispatch. En route. ETA ~' + Math.round(best.etaSeconds / 60) + ' minutes.')
        addRadioMessage('Dispatch', '10-4. Real-time tracking active.')
        addTimelineEvent('radio', 'Radio communication', 'Dispatch-to-unit handshake complete', false)

        setUnits((prev) =>
          prev.map((u) => u.id === best.unitId ? { ...u, status: 'DISPATCHED' } : u)
        )
      } else {
        setDispatchResult({ success: false, message: result.reasoning || 'Auto-dispatch threshold not met' })
        addTimelineEvent('alert', 'Dispatch failed', result.reasoning || 'Threshold check failed', true)
        setDispatchedUnitId(null)
      }
    } catch (err: any) {
      setDispatchedUnitId(null)
      addTimelineEvent('alert', 'Dispatch error', err.message || 'Failed to execute dispatch', true)
      setDispatchResult({ success: false, message: err.message || 'Dispatch failed' })
    }
  }, [aiResult, incidentId, lat, lng, severity, addTimelineEvent, addRadioMessage])

  const sortedCandidates = [...candidates]
    .filter((c) => filterStatus === 'all' || units.find((u) => u.id === c.unitId)?.status === filterStatus)
    .sort((a, b) => {
      if (sortBy === 'eta') return a.etaSeconds - b.etaSeconds
      if (sortBy === 'distance') return a.distanceKm - b.distanceKm
      return b.score - a.score
    })

  const availableCount = units.filter((u) => u.status === 'AVAILABLE' || u.status === 'DISPATCHED').length

  return (
    <div>
      <style>{`
        ::-webkit-scrollbar { width: 4px; height: 4px }
        ::-webkit-scrollbar-track { background: transparent }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 2px }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.15) }
        input::placeholder { color: #475569 }
        select option { background: #0f0f1a; color: #e2e8f0 }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'linear-gradient(135deg, #3b82f6, #7c3aed)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Satellite size={16} color="#fff" />
            </div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#f1f5f9', margin: 0, letterSpacing: '-0.02em' }}>
              Smart Dispatch Console
            </h1>
          </div>
          <p style={{ fontSize: 12, color: '#64748b', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>Real-time AI-powered emergency unit dispatch</span>
            <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#64748b', display: 'inline-block' }} />
            <span style={{ color: availableCount > 0 ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
              {availableCount} units available
            </span>
          </p>
        </div>
      </div>

      {/* Location Status Bar */}
      <AnimatePresence>
        {geo.permissionState === 'prompt' && !geo.hasLocation && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            style={{
              padding: '8px 14px', borderRadius: 8, marginBottom: 12,
              background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)',
              display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#93c5fd',
            }}
          >
            <MapPin size={13} />
            <span style={{ flex: 1 }}>Enable location access for live GPS tracking and auto-incident detection</span>
            <button onClick={geo.requestPermission}
              style={{
                padding: '4px 10px', borderRadius: 4, border: 'none',
                background: 'rgba(59,130,246,0.2)', color: '#60a5fa', fontSize: 10, fontWeight: 600, cursor: 'pointer',
              }}
            >Enable GPS</button>
          </motion.div>
        )}
        {geo.permissionState === 'denied' && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            style={{
              padding: '8px 14px', borderRadius: 8, marginBottom: 12,
              background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.2)',
              display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#fde68a',
            }}
          >
            <CrosshairIcon size={13} />
            <span style={{ flex: 1 }}>Location access denied. Enable GPS in your browser settings for live tracking.</span>
          </motion.div>
        )}
        {geo.hasLocation && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            style={{
              padding: '8px 14px', borderRadius: 8, marginBottom: 12,
              background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)',
              display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#86efac',
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block',
              boxShadow: '0 0 8px #22c55e' }} />
            <span style={{ flex: 1 }}>
              Live GPS active · {geo.latitude?.toFixed(4)}, {geo.longitude?.toFixed(4)}
              {geo.heading ? ` · ${Math.round(geo.heading)}° heading` : ''}
              {geo.speed != null && geo.speed > 0 ? ` · ${Math.round(geo.speed * 3.6)} km/h` : ''}
            </span>
            <span style={{ fontSize: 9, color: '#22c55e', display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#22c55e', display: 'inline-block',
                animation: 'pulse 1.5s infinite' }} />
              {connectionState === 'connected' ? 'FLEET LIVE' : 'LOCAL'}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error / Success Alerts */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            style={{
              padding: '10px 14px', borderRadius: 8, marginBottom: 14,
              background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.25)',
              display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#fca5a5',
            }}
          >
            <AlertTriangle size={14} />
            <span style={{ flex: 1 }}>{error}</span>
            <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer', fontSize: 14, opacity: 0.6 }}>×</button>
          </motion.div>
        )}
        {dispatchResult && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            style={{
              padding: '10px 14px', borderRadius: 8, marginBottom: 14,
              background: dispatchResult.success ? 'rgba(34,197,94,0.08)' : 'rgba(234,179,8,0.08)',
              border: `1px solid ${dispatchResult.success ? 'rgba(34,197,94,0.25)' : 'rgba(234,179,8,0.25)'}`,
              display: 'flex', alignItems: 'center', gap: 8, fontSize: 12,
              color: dispatchResult.success ? '#86efac' : '#fde68a',
            }}
          >
            {dispatchResult.success ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
            <span style={{ flex: 1 }}>{dispatchResult.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr 300px', gap: 14, minHeight: 'calc(100vh - 200px)' }}>
        {/* LEFT: Input + Units Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Dispatch Input */}
          <div style={{
            background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 10, padding: 16,
          }}>
            <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
              <Target size={12} color="#60a5fa" /> Dispatch Parameters
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div>
                <label style={{ fontSize: 10, color: '#64748b', marginBottom: 3, display: 'block' }}>Incident ID</label>
                <input value={incidentId} onChange={(e) => setIncidentId(e.target.value)}
                  placeholder="e.g. INC-20260527-001"
                  style={inputStyle}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <div>
                  <label style={{ fontSize: 10, color: '#64748b', marginBottom: 3, display: 'block' }}>Latitude</label>
                  <input value={lat} onChange={(e) => setLat(e.target.value)} placeholder="36.1699" style={inputStyle} />
                </div>
                <div>
                  <label style={{ fontSize: 10, color: '#64748b', marginBottom: 3, display: 'block' }}>Longitude</label>
                  <input value={lng} onChange={(e) => setLng(e.target.value)} placeholder="-115.1398" style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 10, color: '#64748b', marginBottom: 3, display: 'block' }}>Severity</label>
                <select value={severity} onChange={(e) => setSeverity(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                  {['ALPHA', 'BRAVO', 'CHARLIE', 'DELTA', 'ECHO', 'OMEGA'].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                <motion.button
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={findUnits} disabled={loading}
                  style={{
                    flex: 1, padding: '9px 12px', border: 'none', borderRadius: 6, cursor: loading ? 'not-allowed' : 'pointer',
                    background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: '#fff', fontSize: 12, fontWeight: 600,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, opacity: loading ? 0.6 : 1,
                  }}
                >
                  {loading ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={13} />}
                  {loading ? 'Searching...' : 'Find Units'}
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={getAiRecommendation} disabled={!candidates.length || aiScanning}
                  style={{
                    flex: 1, padding: '9px 12px', border: 'none', borderRadius: 6,
                    cursor: !candidates.length || aiScanning ? 'not-allowed' : 'pointer',
                    background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', color: '#fff', fontSize: 12, fontWeight: 600,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, opacity: !candidates.length || aiScanning ? 0.6 : 1,
                  }}
                >
                  {aiScanning ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Brain size={13} />}
                  {aiScanning ? 'Analyzing...' : 'AI Recommend'}
                </motion.button>
              </div>
              <motion.button
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={autoDispatch} disabled={!aiResult?.candidates?.length || !!dispatchedUnitId}
                style={{
                  padding: '9px 12px', border: 'none', borderRadius: 6,
                  cursor: !aiResult?.candidates?.length || !!dispatchedUnitId ? 'not-allowed' : 'pointer',
                  background: 'linear-gradient(135deg, #dc2626, #b91c1c)', color: '#fff', fontSize: 12, fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                  opacity: !aiResult?.candidates?.length || !!dispatchedUnitId ? 0.6 : 1,
                  boxShadow: aiResult?.candidates?.length && !dispatchedUnitId ? '0 0 20px rgba(220,38,38,0.3)' : 'none',
                }}
              >
                {dispatchedUnitId ? <CheckCircle2 size={13} /> : <Radio size={13} />}
                {dispatchedUnitId ? 'Dispatched' : 'Auto Dispatch (AI)'}
              </motion.button>
            </div>
          </div>

          {/* Severity Indicator */}
          <div style={{
            background: `linear-gradient(135deg, ${EMS_SEVERITY_COLORS[severity]}11, transparent)`,
            border: `1px solid ${EMS_SEVERITY_COLORS[severity]}33`,
            borderRadius: 10, padding: '10px 14px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 10, height: 10, borderRadius: '50%',
                background: EMS_SEVERITY_COLORS[severity],
                boxShadow: `0 0 12px ${EMS_SEVERITY_COLORS[severity]}`,
              }} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: EMS_SEVERITY_COLORS[severity] }}>{severity}</div>
                <div style={{ fontSize: 10, color: '#64748b' }}>
                  {severity === 'ALPHA' ? 'Low priority' :
                   severity === 'BRAVO' ? 'Moderate' :
                   severity === 'CHARLIE' ? 'Urgent' :
                   severity === 'DELTA' ? 'High risk' :
                   severity === 'ECHO' ? 'Critical' : 'Mass casualty'}
                </div>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 2 }}>
                {['ALPHA', 'BRAVO', 'CHARLIE', 'DELTA', 'ECHO', 'OMEGA'].map((s) => (
                  <div key={s} style={{
                    width: 14, height: 14, borderRadius: 3,
                    background: EMS_SEVERITY_COLORS[s],
                    opacity: s === severity ? 1 : 0.15,
                    transition: 'opacity 0.3s',
                  }} />
                ))}
              </div>
            </div>
          </div>

          {/* Units List */}
          <div style={{
            flex: 1, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 10, overflow: 'hidden', display: 'flex', flexDirection: 'column',
          }}>
            <div style={{
              padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Shield size={12} color="#94a3b8" />
                <span style={{ fontSize: 11, fontWeight: 600, color: '#cbd5e1' }}>Available Units</span>
                <span style={{
                  fontSize: 9, padding: '1px 5px', borderRadius: 3,
                  background: 'rgba(255,255,255,0.05)', color: '#64748b',
                }}>{candidates.length}</span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
                  style={{
                    fontSize: 10, padding: '3px 6px', background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4, color: '#94a3b8', outline: 'none',
                  }}
                >
                  <option value="all">All</option>
                  <option value="AVAILABLE">Available</option>
                  <option value="EN_ROUTE">En Route</option>
                  <option value="TRANSPORTING">Transport</option>
                </select>
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}
                  style={{
                    fontSize: 10, padding: '3px 6px', background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4, color: '#94a3b8', outline: 'none',
                  }}
                >
                  <option value="score">Score</option>
                  <option value="eta">ETA</option>
                  <option value="distance">Distance</option>
                </select>
              </div>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '4px 0' }}>
              {loading ? (
                <div style={{ padding: 24, textAlign: 'center' }}>
                  <Loader2 size={18} color="#64748b" style={{ animation: 'spin 1s linear infinite' }} />
                  <div style={{ fontSize: 11, color: '#475569', marginTop: 8 }}>Querying database for available units...</div>
                </div>
              ) : sortedCandidates.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center' }}>
                  <Radio size={20} style={{ opacity: 0.2, color: '#64748b' }} />
                  <div style={{ fontSize: 11, color: '#475569', marginTop: 6 }}>
                    {candidates.length === 0 ? 'Enter coordinates and click Find Units' : 'No units match filter'}
                  </div>
                </div>
              ) : (
                <AnimatePresence>
                  {sortedCandidates.map((unit, i) => {
                    const fleetUnit = units.find((u) => u.id === unit.unitId)
                    const status = fleetUnit?.status || 'AVAILABLE'
                    const isDispatched = unit.unitId === dispatchedUnitId
                    const color = EMS_STATUS_COLORS[status] || '#6b7280'
                    const isRecommended = aiResult?.candidates?.[0]?.unitId === unit.unitId
                    return (
                      <motion.div
                        key={unit.unitId}
                        initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.04 }}
                        style={{
                          padding: '8px 14px', margin: '2px 6px', borderRadius: 6,
                          background: isDispatched ? 'rgba(59,130,246,0.06)' : isRecommended ? 'rgba(34,197,94,0.06)' : 'transparent',
                          border: isDispatched ? '1px solid rgba(59,130,246,0.2)' : isRecommended ? '1px solid rgba(34,197,94,0.2)' : '1px solid transparent',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
                            <span style={{ fontSize: 12, fontWeight: 700, color: isDispatched ? '#60a5fa' : '#e2e8f0' }}>
                              {unit.unitNumber}
                            </span>
                            <span style={{
                              fontSize: 9, padding: '1px 4px', borderRadius: 3,
                              background: color + '18', color, fontWeight: 600,
                            }}>{fleetUnit?.type || 'UNIT'}</span>
                          </div>
                          <span style={{
                            fontSize: 10, fontWeight: 700,
                            color: isRecommended ? '#22c55e' : '#64748b',
                          }}>
                            {(unit.score * 100).toFixed(0)}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: 8, fontSize: 10, color: '#64748b' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Clock size={9} /> {Math.round(unit.etaSeconds / 60)}m
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Navigation size={9} /> {unit.distanceKm} km
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Users size={9} /> {fleetUnit?.crewCapacity || '?'}
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Fuel size={9} /> {fleetUnit?.fuelLevel ?? '?'}%
                          </span>
                          <span style={{ color: EMS_STATUS_COLORS[status] || color, fontSize: 9 }}>
                            {status}
                          </span>
                        </div>
                        {isRecommended && !isDispatched && (
                          <div style={{ marginTop: 3, fontSize: 9, color: '#22c55e' }}>
                            ★ AI Recommended
                          </div>
                        )}
                      </motion.div>
                    )
                  })}
                </AnimatePresence>
              )}
            </div>
          </div>
        </div>

        {/* CENTER: Map */}
        <div style={{
          background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 10, overflow: 'hidden', position: 'relative', minHeight: 400,
        }}>
          {lat && lng ? (
            <EmsLiveMap
              incidentLat={parseFloat(lat)}
              incidentLng={parseFloat(lng)}
              incidentId={incidentId}
              severity={severity}
              units={units}
              dispatchedUnitId={dispatchedUnitId}
              userLocation={geo.hasLocation ? { latitude: geo.latitude!, longitude: geo.longitude!, heading: geo.heading } : null}
              livePositions={livePositions}
              fleetConnectionState={connectionState}
            />
          ) : (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              height: '100%', color: '#475569', fontSize: 12, flexDirection: 'column', gap: 8,
            }}>
              <MapPin size={24} style={{ opacity: 0.2 }} />
              <div>Enter coordinates to activate map</div>
            </div>
          )}
          <div style={{
            position: 'absolute', top: 10, left: 10, zIndex: 1000,
            padding: '4px 10px', borderRadius: 4, fontSize: 9, fontWeight: 700,
            background: 'rgba(0,0,0,0.7)', color: '#60a5fa',
            border: '1px solid rgba(96,165,250,0.3)',
            letterSpacing: '0.05em',
            backdropFilter: 'blur(8px)',
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Crosshair size={10} /> EMS COMMAND MAP
            </span>
          </div>
          {dispatchedUnitId && (
            <div style={{
              position: 'absolute', bottom: 10, left: 10, zIndex: 1000,
              padding: '6px 12px', borderRadius: 6, fontSize: 10,
              background: 'rgba(0,0,0,0.75)', color: '#22c55e',
              border: '1px solid rgba(34,197,94,0.3)',
              backdropFilter: 'blur(8px)',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <motion.span
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                style={{ width: 5, height: 5, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }}
              />
              LIVE TRACKING · Unit dispatched
            </div>
          )}
        </div>

        {/* RIGHT: AI Panel + Timeline + Radio */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{
            background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 10, overflow: 'hidden',
          }}>
            <AiRecommendationPanel
              aiResult={aiResult}
              allUnits={candidates}
              scanning={aiScanning}
            />
          </div>

          <DispatchTimeline events={timelineEvents} etaSeconds={etaSeconds} />

          <div style={{
            background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 10, overflow: 'hidden', flex: 1, maxHeight: 200,
          }}>
            <div style={{
              padding: '8px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)',
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
              <Radio size={11} color="#eab308" />
              <span style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Radio Communications
              </span>
            </div>
            <div style={{ padding: '6px 14px', maxHeight: 140, overflow: 'auto' }}>
              {radioMessages.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '12px 0', fontSize: 10, color: '#475569' }}>
                  No radio traffic yet
                </div>
              ) : (
                radioMessages.map((msg, i) => (
                  <div key={i} style={{
                    padding: '4px 0', borderBottom: i < radioMessages.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                    fontSize: 10,
                  }}>
                    <span style={{ color: msg.sender === 'Dispatch' ? '#f97316' : '#60a5fa', fontWeight: 600 }}>
                      {msg.sender}:
                    </span>{' '}
                    <span style={{ color: '#94a3b8' }}>{msg.message}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '7px 10px', background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6,
  color: '#e2e8f0', fontSize: 12, outline: 'none',
  transition: 'border-color 0.15s',
}

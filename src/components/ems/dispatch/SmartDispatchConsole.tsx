'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { Radio, Target, Navigation, Brain, AlertTriangle, CheckCircle2, XCircle, Loader2 } from 'lucide-react'

type DispatchCandidate = {
  unitId: string
  unitNumber: string
  score: number
  etaSeconds: number
  distanceKm: number
  factors: Array<{ name: string; weight: number; value: number; description: string }>
}

type Recommendation = {
  incidentId: string
  candidates: DispatchCandidate[]
  nearestHospital: { name: string; distanceKm: number; etaSeconds: number } | null
  autoDispatchPossible: boolean
}

export default function SmartDispatchConsole() {
  const [incidentId, setIncidentId] = useState('')
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [severity, setSeverity] = useState('ALPHA')
  const [results, setResults] = useState<{ candidates: DispatchCandidate[]; hospital: any } | null>(null)
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null)
  const [loading, setLoading] = useState(false)
  const [dispatchResult, setDispatchResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const findUnits = useCallback(async () => {
    if (!lat || !lng) { setError('Enter coordinates'); return }
    setLoading(true); setError(null); setResults(null); setRecommendation(null)
    try {
      const [unitsRes, hospitalRes] = await Promise.all([
        fetch('/api/ems/dispatch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'find_units', lat: parseFloat(lat), lng: parseFloat(lng), severity, maxResults: 5 }),
          credentials: 'same-origin',
        }),
        fetch('/api/ems/dispatch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'nearest_hospital', lat: parseFloat(lat), lng: parseFloat(lng) }),
          credentials: 'same-origin',
        }),
      ])
      const unitsData = await unitsRes.json()
      const hospitalData = await hospitalRes.json()
      setResults({
        candidates: unitsData?.data || unitsData || [],
        hospital: hospitalData?.data || hospitalData || null,
      })
    } catch { setError('Failed to query dispatch') }
    finally { setLoading(false) }
  }, [lat, lng, severity])

  const getAiRecommendation = useCallback(async () => {
    if (!incidentId || !lat || !lng) { setError('Enter incident ID and coordinates'); return }
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/ems/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'recommend', incidentId, lat: parseFloat(lat), lng: parseFloat(lng), severity }),
        credentials: 'same-origin',
      })
      const data = await res.json()
      setRecommendation(data?.data || data)
    } catch { setError('AI recommendation failed') }
    finally { setLoading(false) }
  }, [incidentId, lat, lng, severity])

  const autoDispatch = useCallback(async () => {
    if (!incidentId) { setError('Enter incident ID'); return }
    setLoading(true); setError(null); setDispatchResult(null)
    try {
      const res = await fetch('/api/ems/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'auto_dispatch', incidentId, severity }),
        credentials: 'same-origin',
      })
      const data = await res.json()
      const result = data?.data || data
      setDispatchResult(result.success ? `✅ Auto-dispatched ${result.assigned?.unitNumber}` : `❌ ${result.reasoning}`)
    } catch { setError('Auto dispatch failed') }
    finally { setLoading(false) }
  }, [incidentId, severity])

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <Radio size={18} color="#3b82f6" />
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>Smart Dispatch Console</h1>
        </div>
        <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>AI-assisted unit selection and dispatch optimization</p>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 6, color: '#fca5a5', fontSize: 12, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={14} /> {error}
          <button onClick={() => setError(null)} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: '#fca5a5', cursor: 'pointer', fontSize: 12 }}>Dismiss</button>
        </div>
      )}

      {dispatchResult && (
        <div style={{
          padding: '10px 14px', borderRadius: 6, fontSize: 12, marginBottom: 16,
          background: dispatchResult.startsWith('✅') ? 'rgba(34,197,94,0.1)' : 'rgba(234,179,8,0.1)',
          border: `1px solid ${dispatchResult.startsWith('✅') ? 'rgba(34,197,94,0.3)' : 'rgba(234,179,8,0.3)'}`,
          color: dispatchResult.startsWith('✅') ? '#86efac' : '#fde68a',
        }}>
          {dispatchResult}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        {/* Input Panel */}
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 18 }}>
          <h2 style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Target size={14} color="#60a5fa" /> Dispatch Parameters
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, color: '#64748b', marginBottom: 4, display: 'block' }}>Incident ID</label>
              <input value={incidentId} onChange={(e) => setIncidentId(e.target.value)} placeholder="inc_..." style={{
                width: '100%', padding: '8px 10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 6, color: '#e2e8f0', fontSize: 13, outline: 'none',
              }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <label style={{ fontSize: 11, color: '#64748b', marginBottom: 4, display: 'block' }}>Latitude</label>
                <input value={lat} onChange={(e) => setLat(e.target.value)} placeholder="36.1699" style={{
                  width: '100%', padding: '8px 10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 6, color: '#e2e8f0', fontSize: 13, outline: 'none',
                }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: '#64748b', marginBottom: 4, display: 'block' }}>Longitude</label>
                <input value={lng} onChange={(e) => setLng(e.target.value)} placeholder="-115.1398" style={{
                  width: '100%', padding: '8px 10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 6, color: '#e2e8f0', fontSize: 13, outline: 'none',
                }} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#64748b', marginBottom: 4, display: 'block' }}>Severity</label>
              <select value={severity} onChange={(e) => setSeverity(e.target.value)} style={{
                width: '100%', padding: '8px 10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 6, color: '#e2e8f0', fontSize: 13, outline: 'none',
              }}>
                {['ALPHA', 'BRAVO', 'CHARLIE', 'DELTA', 'ECHO', 'OMEGA'].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button onClick={findUnits} disabled={loading}
                style={{
                  flex: 1, padding: '9px 14px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6,
                  cursor: loading ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}>
                {loading ? <Loader2 size={14} /> : <Navigation size={14} />} Find Units
              </button>
              <button onClick={getAiRecommendation} disabled={loading || !incidentId}
                style={{
                  flex: 1, padding: '9px 14px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 6,
                  cursor: loading ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}>
                {loading ? <Loader2 size={14} /> : <Brain size={14} />} AI Recommend
              </button>
            </div>
            <button onClick={autoDispatch} disabled={loading || !incidentId}
              style={{
                padding: '9px 14px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6,
                cursor: loading ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
              {loading ? <Loader2 size={14} /> : <Radio size={14} />} Auto Dispatch (AI)
            </button>
          </div>
        </div>

        {/* Results Panel */}
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 18 }}>
          <h2 style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Target size={14} color="#22c55e" /> Candidate Units
          </h2>
          {results ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {results.candidates.map((c, i) => (
                <div key={c.unitId} style={{
                  padding: '10px 12px', borderRadius: 6,
                  background: i === 0 ? 'rgba(34,197,94,0.06)' : 'rgba(255,255,255,0.02)',
                  border: i === 0 ? '1px solid rgba(34,197,94,0.2)' : '1px solid rgba(255,255,255,0.04)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: 13, color: '#e2e8f0' }}>
                      {c.unitNumber} {i === 0 && <span style={{ fontSize: 10, color: '#22c55e' }}>BEST</span>}
                    </span>
                    <span style={{ fontSize: 12, color: '#60a5fa', fontWeight: 600 }}>Score: {c.score}</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b', display: 'flex', gap: 12 }}>
                    <span>ETA: {Math.round(c.etaSeconds / 60)} min</span>
                    <span>Dist: {c.distanceKm} km</span>
                  </div>
                  <div style={{ fontSize: 10, color: '#475569', marginTop: 4 }}>
                    {c.factors.slice(0, 3).map((f) => (
                      <span key={f.name} style={{ marginRight: 8 }}>{f.name}: {(f.value * 100).toFixed(0)}%</span>
                    ))}
                  </div>
                </div>
              ))}
              {results.hospital && (
                <div style={{ marginTop: 8, padding: '8px 12px', background: 'rgba(59,130,246,0.06)', borderRadius: 6, border: '1px solid rgba(59,130,246,0.15)' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#93c5fd', marginBottom: 2 }}>Nearest Hospital</div>
                  <div style={{ fontSize: 12, color: '#e2e8f0' }}>{results.hospital.name}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>{results.hospital.distanceKm} km · ETA {Math.round((results.hospital.etaSeconds || 0) / 60)} min</div>
                </div>
              )}
            </div>
          ) : recommendation ? (
            <div>
              {recommendation.candidates?.map((c, i) => (
                <div key={c.unitId} style={{ padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{c.unitNumber}</span>
                    <span style={{ color: '#60a5fa' }}>Score: {c.score}</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>ETA {Math.round(c.etaSeconds / 60)}min · {c.distanceKm}km</div>
                </div>
              ))}
              {recommendation.nearestHospital && (
                <div style={{ marginTop: 8, fontSize: 11, color: '#93c5fd' }}>
                  Hospital: {recommendation.nearestHospital.name}
                </div>
              )}
              {recommendation.autoDispatchPossible && (
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#22c55e' }}>
                  <CheckCircle2 size={12} /> Auto-dispatch possible
                </div>
              )}
            </div>
          ) : (
            <div style={{ padding: 20, textAlign: 'center', color: '#475569', fontSize: 12 }}>
              <Radio size={20} style={{ opacity: 0.3, marginBottom: 6 }} />
              <div>Enter coordinates and find available units</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

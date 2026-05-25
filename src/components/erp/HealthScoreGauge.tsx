'use client'

import { useEffect, useState } from 'react'
import { TrendingUp, Lightbulb } from 'lucide-react'

type HealthFactor = {
  name: string
  value: number
  target: number
  score: number
  status: 'good' | 'warning' | 'bad'
  description: string
}

type HealthScore = {
  overall: number
  factors: HealthFactor[]
  topPositive: string[]
  topNegative: string[]
  improvements: string[]
}

export function HealthScoreWidget() {
  const [data, setData] = useState<HealthScore | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/v1/erp2/ai/health-score')
      .then(r => r.json())
      .then(json => { if (json.success) setData(json.data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
        Loading health score...
      </div>
    )
  }

  if (!data) return null

  const gaugeColor = data.overall >= 70 ? '#16a34a' : data.overall >= 40 ? '#d97706' : '#dc2626'

  return (
    <div style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
        {/* Circular gauge */}
        <div style={{
          width: '80px', height: '80px', borderRadius: '50%',
          background: `conic-gradient(${gaugeColor} ${data.overall}%, #e2e8f0 ${data.overall}%)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '50%', background: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '20px', fontWeight: 700, color: gaugeColor,
          }}>
            {data.overall}
          </div>
        </div>

        <div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', marginBottom: '2px' }}>
            Financial Health Score
          </div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>
            {data.overall >= 70 ? '✅ Healthy' : data.overall >= 40 ? '⚠️ Needs attention' : '❌ Critical'}
          </div>
        </div>
      </div>

      {/* Factors */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
        {data.factors.map((f, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
              background: f.status === 'good' ? '#16a34a' : f.status === 'warning' ? '#d97706' : '#dc2626',
            }} />
            <div style={{ flex: 1, fontSize: '12px', color: '#334155' }}>{f.name}</div>
            <div style={{
              fontSize: '12px', fontWeight: 600, fontFamily: 'monospace',
              color: f.status === 'good' ? '#16a34a' : f.status === 'warning' ? '#d97706' : '#dc2626',
            }}>
              {f.score}
            </div>
          </div>
        ))}
      </div>

      {/* Top positives */}
      {data.topPositive.length > 0 && (
        <div style={{ marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600, color: '#16a34a', marginBottom: '4px', textTransform: 'uppercase' }}>
            <TrendingUp size={12} /> Strong areas
          </div>
          {data.topPositive.map((name, i) => (
            <div key={i} style={{ fontSize: '12px', color: '#166534', padding: '1px 0' }}>• {name}</div>
          ))}
        </div>
      )}

      {/* Improvements */}
      {data.improvements.length > 0 && (
        <div style={{ marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600, color: '#d97706', marginBottom: '4px', textTransform: 'uppercase' }}>
            <Lightbulb size={12} /> How to improve
          </div>
          {data.improvements.map((imp, i) => (
            <div key={i} style={{ fontSize: '12px', color: '#78350f', padding: '1px 0' }}>• {imp}</div>
          ))}
        </div>
      )}
    </div>
  )
}

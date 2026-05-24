'use client'

import { useState, useCallback } from 'react'
import { Sparkles, Check, X, Edit3 } from 'lucide-react'

type SuggestedLine = {
  accountCode: string
  accountName: string
  side: 'debit' | 'credit'
  amount: number
}

type Suggestion = {
  lines: SuggestedLine[]
  confidence: number
  engine: string
  matchedVendor?: string | null
  matchedKeyword?: string
}

interface AISuggestionPanelProps {
  description: string
  amount?: number | null
  workspaceId: string
  onAccept: (lines: SuggestedLine[]) => void
  onDismiss: () => void
}

export function AISuggestionPanel({ description, amount, workspaceId, onAccept, onDismiss }: AISuggestionPanelProps) {
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchSuggestion = useCallback(async () => {
    if (!description.trim()) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/v1/erp2/ai/suggest-journal-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description, amount }),
      })

      if (!res.ok) {
        setError('AI suggestion unavailable')
        return
      }

      const json = await res.json()
      if (json.success && json.data?.lines?.length >= 2) {
        setSuggestion(json.data)
      } else {
        setError('Could not generate suggestion')
      }
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }, [description, amount])

  if (!description.trim()) return null

  return (
    <div style={{
      marginTop: '8px',
      padding: '12px',
      borderRadius: '8px',
      background: loading ? '#f8fafc' : suggestion ? 'linear-gradient(135deg, #f0fdf4, #ecfdf5)' : '#fffbeb',
      border: `1px solid ${loading ? '#e2e8f0' : suggestion ? '#bbf7d0' : '#fde68a'}`,
      fontSize: '13px',
    }}>
      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b' }}>
          <Sparkles size={14} style={{ animation: 'pulse 1.5s infinite' }} />
          AI analyzing description...
        </div>
      )}

      {error && !loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#92400e' }}>
          <Sparkles size={14} />
          <span>{error}</span>
        </div>
      )}

      {!suggestion && !loading && !error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={14} color="#d97706" />
          <span style={{ color: '#92400e', flex: 1 }}>
            AI can suggest journal lines for this description
          </span>
          <button
            onClick={fetchSuggestion}
            style={{
              padding: '4px 12px',
              borderRadius: '6px',
              border: '1px solid #d97706',
              background: '#fff',
              color: '#92400e',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Suggest
          </button>
        </div>
      )}

      {suggestion && !loading && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
            <Sparkles size={14} color="#16a34a" />
            <span style={{ fontWeight: 600, color: '#166534', fontSize: '12px' }}>
              AI Suggestion ({suggestion.confidence}% confidence)
              {suggestion.matchedVendor && <span style={{ fontWeight: 400 }}> — matched vendor: {suggestion.matchedVendor}</span>}
            </span>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #d1fae5' }}>
                <th style={{ textAlign: 'left', padding: '4px 8px', color: '#166534' }}>Account</th>
                <th style={{ textAlign: 'left', padding: '4px 8px', color: '#166534' }}>Name</th>
                <th style={{ textAlign: 'center', padding: '4px 8px', color: '#166534' }}>Side</th>
                <th style={{ textAlign: 'right', padding: '4px 8px', color: '#166534' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {suggestion.lines.map((line, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #dcfce7' }}>
                  <td style={{ padding: '4px 8px', fontFamily: 'monospace' }}>{line.accountCode}</td>
                  <td style={{ padding: '4px 8px' }}>{line.accountName}</td>
                  <td style={{ padding: '4px 8px', textAlign: 'center' }}>
                    <span style={{
                      color: line.side === 'debit' ? '#dc2626' : '#2563eb',
                      fontWeight: 600,
                      fontSize: '11px',
                      textTransform: 'uppercase',
                    }}>
                      {line.side}
                    </span>
                  </td>
                  <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace' }}>
                    ${(line.amount / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: 'flex', gap: '8px', marginTop: '8px', justifyContent: 'flex-end' }}>
            <button
              onClick={onDismiss}
              style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                padding: '4px 10px', borderRadius: '6px', border: '1px solid #e2e8f0',
                background: '#fff', color: '#64748b', fontSize: '12px', cursor: 'pointer',
              }}
            >
              <X size={12} /> Dismiss
            </button>
            <button
              onClick={() => onAccept(suggestion.lines)}
              style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                padding: '4px 10px', borderRadius: '6px', border: 'none',
                background: '#16a34a', color: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
              }}
            >
              <Check size={12} /> Accept
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Brain, Cpu, TrendingUp, Activity, Zap, Shield, Target, Radio } from 'lucide-react'
import type { AiRecommendation, SimUnit } from '@/modules/ems/dispatch-simulator'

export default function AiRecommendationPanel({
  recommendation,
  allUnits,
  scanning,
}: {
  recommendation: AiRecommendation | null
  allUnits: SimUnit[]
  scanning: boolean
}) {
  const [scanLines, setScanLines] = useState<number[]>([])

  useEffect(() => {
    if (!scanning) {
      setScanLines([])
      return
    }
    const interval = setInterval(() => {
      setScanLines((prev) => {
        const next = [...prev, Date.now()]
        return next.length > 8 ? next.slice(-8) : next
      })
    }, 600)
    return () => clearInterval(interval)
  }, [scanning])

  if (scanning) {
    return (
      <div style={{ position: 'relative', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(180deg, rgba(59,130,246,0.03) 0%, rgba(124,58,237,0.03) 100%)',
          overflow: 'hidden', pointerEvents: 'none',
        }}>
          {scanLines.map((key) => (
            <motion.div
              key={key}
              initial={{ top: '0%', opacity: 1 }}
              animate={{ top: '100%', opacity: 0 }}
              transition={{ duration: 1.2, ease: 'linear' }}
              style={{
                position: 'absolute', left: 0, right: 0, height: 2,
                background: 'linear-gradient(90deg, transparent, rgba(59,130,246,0.4), rgba(124,58,237,0.4), transparent)',
              }}
            />
          ))}
        </div>

        <div style={{ textAlign: 'center', padding: '32px 16px', position: 'relative', zIndex: 1 }}>
          <motion.div
            animate={{ scale: [1, 1.05, 1], opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            style={{ display: 'inline-flex', gap: 4, marginBottom: 12 }}
          >
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 0.6, delay: i * 0.15, repeat: Infinity }}
                style={{ width: 6, height: 6, borderRadius: '50%', background: '#60a5fa' }}
              />
            ))}
          </motion.div>
          <div style={{ fontSize: 12, color: '#60a5fa', fontWeight: 600, letterSpacing: '0.05em' }}>
            AI neural engine scanning dispatch parameters...
          </div>
          <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>
            Analyzing {allUnits.length} units across 6 factors
          </div>
        </div>
      </div>
    )
  }

  if (!recommendation) return null

  const confidenceColor = recommendation.confidence > 85 ? '#22c55e' : recommendation.confidence > 65 ? '#eab308' : '#ef4444'
  const survivalColor = recommendation.survivalOptimization === 'HIGH' ? '#22c55e' : recommendation.survivalOptimization === 'MEDIUM' ? '#eab308' : '#ef4444'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      <div style={{
        background: 'linear-gradient(135deg, rgba(59,130,246,0.08), rgba(124,58,237,0.08))',
        border: '1px solid rgba(59,130,246,0.2)',
        borderRadius: 12, overflow: 'hidden',
        position: 'relative',
      }}>
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 2,
          background: 'linear-gradient(90deg, #3b82f6, #7c3aed, #3b82f6)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 2s linear infinite',
        }} />
        <style>{`@keyframes shimmer { to { background-position: -200% 0 } }`}</style>

        <div style={{ padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 6,
              background: 'linear-gradient(135deg, #3b82f6, #7c3aed)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Brain size={14} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#93c5fd', letterSpacing: '0.03em' }}>AI DISPATCH RECOMMENDATION</div>
              <div style={{ fontSize: 10, color: '#475569' }}>Powered by Neural Dispatch Engine v2</div>
            </div>
            <motion.div
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 2, repeat: Infinity }}
              style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#22c55e' }}
            >
              <Activity size={10} /> LIVE
            </motion.div>
          </div>

          <div style={{
            background: 'rgba(59,130,246,0.06)',
            border: '1px solid rgba(59,130,246,0.15)',
            borderRadius: 8, padding: '12px 14px', marginBottom: 12,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div>
                <span style={{ fontSize: 18, fontWeight: 800, color: '#f1f5f9' }}>{recommendation.unitNumber}</span>
                <span style={{
                  fontSize: 10, marginLeft: 8, padding: '2px 6px', borderRadius: 3,
                  background: `rgba(${recommendation.type === 'ALS' || recommendation.type === 'MICU' ? '34,197,94' : '148,163,184'},0.15)`,
                  color: recommendation.type === 'ALS' || recommendation.type === 'MICU' ? '#22c55e' : '#94a3b8',
                  fontWeight: 600,
                }}>{recommendation.type}</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: confidenceColor }}>
                  {recommendation.confidence}%
                </div>
                <div style={{ fontSize: 9, color: '#64748b' }}>CONFIDENCE</div>
              </div>
            </div>
            <div style={{ width: '100%', height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, marginTop: 6 }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${recommendation.confidence}%` }}
                transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
                style={{ height: '100%', background: `linear-gradient(90deg, ${confidenceColor}, ${confidenceColor}88)`, borderRadius: 2 }}
              />
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, fontWeight: 600 }}>
              <Cpu size={11} style={{ display: 'inline', marginRight: 4 }} /> Reasoning
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {recommendation.reasoning.map((reason, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: 0.5 + i * 0.1 }}
                  style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 11, color: '#94a3b8', lineHeight: 1.4 }}
                >
                  <Target size={10} style={{ flexShrink: 0, marginTop: 2, color: '#60a5fa' }} />
                  <span>{reason}</span>
                </motion.div>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
            {[
              { label: 'ETA', value: `${Math.round(recommendation.etaSeconds / 60)} min`, icon: Activity, color: '#60a5fa' },
              { label: 'Distance', value: `${recommendation.distanceKm} km`, icon: Target, color: '#22c55e' },
              { label: 'Survival Opt.', value: recommendation.survivalOptimization, icon: TrendingUp, color: survivalColor },
              { label: 'AI Score', value: (recommendation.score * 100).toFixed(0), icon: Zap, color: '#8b5cf6' },
            ].map((stat) => {
              const Icon = stat.icon
              return (
                <div key={stat.label} style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 6, padding: '8px 10px',
                }}>
                  <div style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 3 }}>
                    <Icon size={10} color={stat.color} /> {stat.label}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: stat.color }}>{stat.value}</div>
                </div>
              )
            })}
          </div>

          <div style={{ fontSize: 10, color: '#475569', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8, display: 'flex', justifyContent: 'space-between' }}>
            <span>Neural Dispatch Engine · 6-factor analysis</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <Shield size={10} color="#60a5fa" /> HIPAA-compliant
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

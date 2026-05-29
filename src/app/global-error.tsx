'use client'

import { useEffect, useCallback, useState } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [state, setState] = useState<'critical' | 'reconnecting'>('critical')
  const [logLines, setLogLines] = useState<string[]>([])
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 })

  useEffect(() => {
    console.error('[FATAL] Root error:', error)
  }, [error])

  useEffect(() => {
    const lines = [
      '[SYS] CRITICAL SYSTEM FAILURE.',
      '[AI] Fatal error at application root.',
      '[ERR] ' + (error.message || 'Unknown error'),
      '[DBG] Digest: ' + (error.digest || 'N/A'),
      '[AI] Initializing emergency recovery protocol...',
      '[SYS] Recovery interface active.',
    ]
    let i = 0
    const interval = setInterval(() => {
      if (i < lines.length) {
        setLogLines((prev) => [...prev, lines[i]])
        i++
      } else {
        clearInterval(interval)
      }
    }, 600)
    return () => clearInterval(interval)
  }, [error])

  useEffect(() => {
    const onMouse = (e: MouseEvent) => {
      setMousePos({
        x: e.clientX / window.innerWidth,
        y: e.clientY / window.innerHeight,
      })
    }
    window.addEventListener('mousemove', onMouse)
    return () => window.removeEventListener('mousemove', onMouse)
  }, [])

  const handleRetry = useCallback(() => {
    setState('reconnecting')
    setTimeout(() => {
      reset()
    }, 2500)
  }, [reset])

  const scanHeadX = (mousePos.x - 0.5) * 6
  const scanHeadY = (mousePos.y - 0.5) * 6

  return (
    <html>
      <body style={{ margin: 0, background: '#07090e', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{
          position: 'relative',
          minHeight: '100vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
        }}>
          {/* Animated grid background */}
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.015,
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px',
          }} />

          {/* Ambient glow */}
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: `
              radial-gradient(ellipse 80% 60% at 50% 40%, rgba(244,63,94,0.04) 0%, transparent 70%),
              radial-gradient(ellipse 60% 40% at 30% 60%, rgba(99,102,241,0.03) 0%, transparent 60%)
            `,
          }} />

          {/* Fog layer */}
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.03,
            background: `linear-gradient(180deg, transparent 0%, rgba(244,63,94,0.2) 50%, transparent 100%)`,
            animation: 'globalDrift 8s ease-in-out infinite',
          }} />

          <style>{`
            @keyframes globalDrift {
              0%, 100% { transform: translateY(0) scale(1); opacity: 0.03; }
              50% { transform: translateY(-20px) scale(1.05); opacity: 0.06; }
            }
            @keyframes globalPulse {
              0%, 100% { opacity: 0.3; }
              50% { opacity: 1; }
            }
            @keyframes globalScan {
              0% { transform: translateY(-100%); }
              100% { transform: translateY(100%); }
            }
          `}</style>

          {/* Content */}
          <div style={{
            position: 'relative',
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            maxWidth: '600px',
            width: '100%',
          }}>
            {/* Status badge */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              padding: '6px 16px', borderRadius: '9999px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              marginBottom: '24px',
            }}>
              <div style={{
                width: '8px', height: '8px', borderRadius: '50%',
                background: '#f43f5e',
                animation: 'globalPulse 1.5s ease-in-out infinite',
              }} />
              <span style={{
                fontSize: '10px', letterSpacing: '0.3em',
                color: 'rgba(255,255,255,0.3)',
                fontFamily: 'monospace',
              }}>
                TASKIT OS v3.0 — FATAL ERROR
              </span>
            </div>

            {/* Code */}
            <h1 style={{
              fontSize: 'clamp(3rem, 10vw, 6rem)',
              fontWeight: 700, lineHeight: 1, marginBottom: '16px',
              letterSpacing: '-0.02em',
              background: 'linear-gradient(135deg, #f1f5f9 0%, #f43f5e 50%, #6366f1 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              FTL_500
            </h1>

            <h2 style={{
              fontSize: '1.25rem', fontWeight: 600,
              color: 'rgba(255,255,255,0.7)',
              marginBottom: '8px', letterSpacing: '0.05em',
            }}>
              FATAL SYSTEM ERROR
            </h2>

            <p style={{
              fontSize: '0.875rem', color: 'rgba(255,255,255,0.35)',
              textAlign: 'center', maxWidth: '400px', lineHeight: 1.6,
              marginBottom: '32px',
            }}>
              A critical error occurred at the application root level.
              Emergency protocol has been activated. System diagnostics are being collected.
            </p>

            {/* Robot SVG */}
            <div style={{
              width: '160px', height: '160px', marginBottom: '32px',
              perspective: '800px',
            }}>
              <div style={{
                width: '100%', height: '100%',
                animation: 'floatBreath 4s ease-in-out infinite',
                transform: `rotateX(${scanHeadY}deg) rotateY(${scanHeadX}deg)`,
                transition: 'transform 0.3s ease-out',
              }}>
                <svg viewBox="-80 -80 160 160" style={{ width: '100%', height: '100%' }}>
                  <radialGradient id="gHead" cx="50%" cy="40%" r="60%">
                    <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.08" />
                    <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.02" />
                  </radialGradient>
                  <polygon points="0,-60 52,-30 52,30 0,60 -52,30 -52,-30" fill="url(#gHead)" stroke="#f43f5e" strokeWidth="1" opacity="0.6" />
                  <polygon points="0,-55 48,-27 48,27 0,55 -48,27 -48,-27" fill="none" stroke="#f43f5e" strokeWidth="0.3" opacity="0.15" />
                  {/* Critical X marks */}
                  <line x1="-24" y1="-24" x2="24" y2="24" stroke="#f43f5e" strokeWidth="1.5" opacity="0.8" />
                  <line x1="-24" y1="24" x2="24" y2="-24" stroke="#f43f5e" strokeWidth="1.5" opacity="0.8" />
                  {/* Eyes */}
                  <ellipse cx="-28" cy="0" rx="14" ry="12" fill="none" stroke="#f43f5e" strokeWidth="1" opacity="0.8" />
                  <ellipse cx="28" cy="0" rx="14" ry="12" fill="none" stroke="#f43f5e" strokeWidth="1" opacity="0.8" />
                  <circle cx="-28" cy="0" r="4" fill="#f43f5e" opacity="0.4" />
                  <circle cx="28" cy="0" r="4" fill="#f43f5e" opacity="0.4" />
                  {/* Critical pulse ring */}
                  <circle cx="0" cy="0" r="52" fill="none" stroke="#f43f5e" strokeWidth="0.5" opacity="0.3">
                    <animate attributeName="r" values="52;58;52" dur="2s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.3;0;0.3" dur="2s" repeatCount="indefinite" />
                  </circle>
                </svg>
              </div>
            </div>

            {/* Status bar */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              width: '100%', maxWidth: '500px',
              padding: '12px 16px',
              borderRadius: '8px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              marginBottom: '16px',
            }}>
              <div style={{
                width: '8px', height: '8px', borderRadius: '50%',
                background: '#f43f5e', flexShrink: 0,
                animation: 'globalPulse 1.5s ease-in-out infinite',
              }} />
              <span style={{
                fontSize: '11px', fontFamily: 'monospace',
                letterSpacing: '0.15em', fontWeight: 600,
                color: '#f43f5e',
              }}>
                CRITICAL FAILURE — RECOVERY PROTOCOL
              </span>
            </div>

            {/* Console */}
            <div style={{
              width: '100%', maxWidth: '500px',
              padding: '12px 16px',
              borderRadius: '8px',
              background: 'rgba(0,0,0,0.4)',
              border: '1px solid rgba(255,255,255,0.06)',
              fontFamily: 'monospace',
              fontSize: '11px',
              lineHeight: 1.8,
              minHeight: '140px',
              maxHeight: '200px',
              overflowY: 'auto',
              marginBottom: '24px',
            }}>
              {logLines.map((line, i) => (
                <div key={i} style={{ padding: '1px 0' }}>
                  <span style={{ color: line.startsWith('[ERR]') ? '#f43f5e' : 'rgba(255,255,255,0.4)' }}>
                    {line}
                  </span>
                </div>
              ))}
              {logLines.length < 6 && (
                <span style={{ color: '#f43f5e', opacity: 0.7 }}>
                  <span style={{ animation: 'globalPulse 0.8s step-end infinite' }}>▌</span>
                </span>
              )}
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={handleRetry}
                disabled={state === 'reconnecting'}
                style={{
                  padding: '12px 28px',
                  borderRadius: '8px',
                  fontFamily: 'monospace',
                  fontSize: '11px',
                  letterSpacing: '0.1em',
                  fontWeight: 600,
                  border: '2px solid rgba(244,63,94,0.3)',
                  background: state === 'reconnecting'
                    ? 'rgba(244,63,94,0.05)'
                    : 'rgba(244,63,94,0.1)',
                  color: '#f43f5e',
                  cursor: state === 'reconnecting' ? 'not-allowed' : 'pointer',
                  opacity: state === 'reconnecting' ? 0.5 : 1,
                  transition: 'all 0.3s ease',
                }}
                onMouseEnter={(e) => {
                  if (state !== 'reconnecting') {
                    e.currentTarget.style.borderColor = 'rgba(244,63,94,0.6)'
                    e.currentTarget.style.boxShadow = '0 0 20px rgba(244,63,94,0.15)'
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(244,63,94,0.3)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                {state === 'reconnecting' ? '⟳ RECOVERING...' : '⟳ RETRY APPLICATION'}
              </button>
            </div>

            {/* Footer */}
            <div style={{
              marginTop: '48px',
              fontSize: '10px',
              fontFamily: 'monospace',
              letterSpacing: '0.3em',
              color: 'rgba(255,255,255,0.12)',
            }}>
              TASKIT OS v3.0.1 · FATAL RECOVERY INTERFACE
            </div>
          </div>
        </div>

        <style>{`
          @keyframes floatBreath {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-6px); }
          }
        `}</style>
      </body>
    </html>
  )
}

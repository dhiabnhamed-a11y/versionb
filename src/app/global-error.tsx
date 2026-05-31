'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'

const pageStyles = `
  :root {
    color-scheme: light;
    --bg: #f7f8fa;
    --card: #ffffff;
    --line: #e2e7ee;
    --text: #0b1628;
    --muted: #64748b;
    --secondary: #2e4060;
    --accent: #0369a1;
    --accent-hover: #0284c7;
    --success-bg: #d1fae5;
    --success-text: #065f46;
  }

  * { box-sizing: border-box; }
  body {
    margin: 0;
    min-height: 100vh;
    background:
      radial-gradient(circle at 20% 12%, rgba(8, 145, 178, 0.12), transparent 28rem),
      radial-gradient(circle at 82% 0%, rgba(217, 119, 6, 0.1), transparent 24rem),
      linear-gradient(180deg, #ffffff 0%, var(--bg) 52%, #eef1f5 100%);
    color: var(--text);
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }

  .page {
    min-height: 100vh;
    display: grid;
    place-items: center;
    padding: 24px;
  }

  .panel {
    width: min(920px, 100%);
    display: grid;
    grid-template-columns: minmax(0, 1.08fr) minmax(280px, 0.92fr);
    overflow: hidden;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--card);
    box-shadow: 0 20px 48px rgba(11, 22, 40, 0.13);
  }

  .main, .side { padding: 40px; }
  .main { min-height: 520px; display: flex; flex-direction: column; justify-content: space-between; }
  .side { border-left: 1px solid var(--line); background: #f3f5f8; }
  .brand { display: inline-flex; align-items: center; gap: 12px; color: var(--secondary); font-weight: 700; text-decoration: none; }
  .mark {
    width: 36px;
    height: 36px;
    display: grid;
    place-items: center;
    border-radius: 8px;
    background: linear-gradient(135deg, #2142ff 0%, #24c8f8 55%, #c8fb6d 100%);
    color: #08172b;
    font-weight: 900;
  }
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    width: fit-content;
    border-radius: 999px;
    background: var(--success-bg);
    color: var(--success-text);
    padding: 6px 12px;
    font-size: 12px;
    font-weight: 700;
  }
  .dot { width: 8px; height: 8px; border-radius: 999px; background: #059669; }
  .eyebrow {
    margin-top: 32px;
    color: var(--muted);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }
  h1 { margin: 12px 0 0; font-size: clamp(32px, 5vw, 56px); line-height: 1.05; letter-spacing: 0; }
  p { color: var(--secondary); line-height: 1.7; }
  .actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 32px; }
  button, .link {
    min-height: 46px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    padding: 10px 18px;
    font-size: 14px;
    font-weight: 700;
    text-decoration: none;
    cursor: pointer;
  }
  button {
    border: 0;
    background: linear-gradient(135deg, var(--accent) 0%, #0891b2 100%);
    color: white;
  }
  button:hover { background: var(--accent-hover); }
  button:disabled { opacity: 0.65; cursor: wait; }
  .link { border: 1px solid var(--line); color: var(--text); background: white; }
  .support-card {
    border: 1px solid var(--line);
    border-radius: 8px;
    background: white;
    padding: 18px;
  }
  .support-card + .support-card { margin-top: 12px; }
  .label {
    color: var(--muted);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
  .code { margin-top: 8px; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-weight: 700; }

  @media (max-width: 760px) {
    .panel { grid-template-columns: 1fr; }
    .main { min-height: auto; }
    .main, .side { padding: 28px; }
    .side { border-left: 0; border-top: 1px solid var(--line); }
  }
`

export default function GlobalError({
  error,
  reset,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  reset?: () => void
  unstable_retry?: () => void
}) {
  const [isRetrying, setIsRetrying] = useState(false)

  useEffect(() => {
    console.error('[global-error-boundary] Root error:', {
      message: error.message,
      digest: error.digest,
    })
  }, [error])

  const handleRetry = useCallback(() => {
    setIsRetrying(true)
    const retry = unstable_retry ?? reset

    if (retry) {
      retry()
      return
    }

    window.location.reload()
  }, [reset, unstable_retry])

  return (
    <html lang="en">
      <head>
        <title>TASKIT OS - Temporary issue</title>
        <style>{pageStyles}</style>
      </head>
      <body>
        <main className="page" aria-labelledby="global-error-title">
          <section className="panel">
            <div className="main">
              <div>
                <Link className="brand" href="/">
                  <span className="mark" aria-hidden="true">T</span>
                  <span>TASKIT OS</span>
                </Link>

                <div style={{ marginTop: 56 }}>
                  <div className="badge">
                    <span className="dot" aria-hidden="true" />
                    Secure recovery screen
                  </div>
                  <p className="eyebrow">Reference ERR_500</p>
                  <h1 id="global-error-title">We could not load the application</h1>
                  <p>
                    A temporary issue interrupted TASKIT OS. Your account and workspace data remain protected.
                    Please retry the application or return to the homepage.
                  </p>
                </div>
              </div>

              <div className="actions">
                <button type="button" onClick={handleRetry} disabled={isRetrying}>
                  {isRetrying ? 'Retrying...' : 'Try again'}
                </button>
                <Link className="link" href="/">
                  Back to homepage
                </Link>
              </div>
            </div>

            <aside className="side">
              <div className="support-card">
                <p className="label">What this means</p>
                <p>
                  The interface stopped before it could finish loading. This screen avoids exposing technical
                  details while giving support a reference to investigate.
                </p>
              </div>
              <div className="support-card">
                <p className="label">Support reference</p>
                <p className="code">{error.digest || 'ERR_500'}</p>
              </div>
            </aside>
          </section>
        </main>
      </body>
    </html>
  )
}

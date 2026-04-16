'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Image from 'next/image'
import { useCamera } from '@/hooks/useCamera'
import { CameraControls } from '@/components/camera/CameraControls'
import { Aperture, Camera, Circle, Play, RefreshCw, Video } from 'lucide-react'

type MediaItem = {
  id: string
  fileUrl: string
  type: string
  createdAt: string
}

type Props = {
  projectId: string
}

async function uploadBlob(projectId: string, blob: Blob, type: 'image' | 'video') {
  const fd = new FormData()
  fd.set('projectId', projectId)
  fd.set('type', type)
  const name = type === 'image' ? 'capture.jpg' : 'clip.webm'
  fd.set('file', blob, name)

  const res = await fetch('/api/camera/upload', {
    method: 'POST',
    body: fd,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error((data as { error?: string; detail?: string }).error || (data as { detail?: string }).detail || 'Upload failed')
  }
  return data as MediaItem
}

export function ProjectCamera({ projectId }: Props) {
  const {
    videoRef,
    isActive,
    isStarting,
    isRecording,
    error,
    startCamera,
    stopCamera,
    captureImage,
    startRecording,
    stopRecording,
    clearError,
  } = useCamera()

  const [media, setMedia] = useState<MediaItem[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [recordElapsedMs, setRecordElapsedMs] = useState(0)
  const [showFlash, setShowFlash] = useState(false)
  const flashTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    if (!isRecording) {
      setRecordElapsedMs(0)
      return
    }
    const start = Date.now()
    const t = window.setInterval(() => {
      setRecordElapsedMs(Date.now() - start)
    }, 200)
    return () => window.clearInterval(t)
  }, [isRecording])

  const recordTime = new Date(recordElapsedMs).toISOString().slice(14, 19) // mm:ss

  const loadMedia = useCallback(async () => {
    setLoadingList(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/camera`)
      if (res.ok) {
        const list = (await res.json()) as MediaItem[]
        setMedia(Array.isArray(list) ? list : [])
      }
    } finally {
      setLoadingList(false)
    }
  }, [projectId])

  useEffect(() => {
    void loadMedia()
  }, [loadMedia])

  const handleCapture = async () => {
    setUploadError(null)
    setUploading(true)
    try {
      // Quick shutter flash to make capture feel immediate.
      triggerFlash()
      const blob = await captureImage()
      if (!blob) {
        setUploadError('Could not read a frame from the camera.')
        return
      }
      const row = await uploadBlob(projectId, blob, 'image')
      setMedia((prev) => [row, ...prev])
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleRecordToggle = async () => {
    if (!isRecording) {
      startRecording()
      return
    }
    setUploadError(null)
    setUploading(true)
    try {
      const blob = await stopRecording()
      if (!blob) {
        setUploadError('No video captured.')
        return
      }
      // Flash when the clip is finalized.
      triggerFlash()
      const row = await uploadBlob(projectId, blob, 'video')
      setMedia((prev) => [row, ...prev])
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const triggerFlash = useCallback(() => {
    if (flashTimeoutRef.current) window.clearTimeout(flashTimeoutRef.current)
    setShowFlash(false)
    // Ensure the animation re-triggers even if called rapidly.
    window.requestAnimationFrame(() => setShowFlash(true))
    flashTimeoutRef.current = window.setTimeout(() => setShowFlash(false), 170)
  }, [])

  return (
    <motion.section
      aria-label="Project camera"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-[var(--shadow-card)] md:p-6"
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
            style={{ background: 'var(--accent-subtle)' }}
          >
            <Aperture className="h-5 w-5 text-[var(--accent)]" strokeWidth={2} />
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight text-[var(--text-primary)]">
              Project camera
            </h2>
            <p className="mt-0.5 max-w-xl text-sm text-[var(--text-muted)]">
              Capture stills or short clips with your device camera. Media is stored in your workspace bucket and listed
              here.
            </p>
          </div>
        </div>
        <motion.button
          type="button"
          onClick={() => void loadMedia()}
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.98 }}
          className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--border)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loadingList ? 'animate-spin' : ''}`} />
          Refresh gallery
        </motion.button>
      </div>

      <AnimatePresence>
        {(error || uploadError) && (
          <motion.div
            role="alert"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="mb-4 rounded-[var(--radius-sm)] border px-3 py-2.5 text-sm"
            style={{
              background: 'rgba(220, 38, 38, 0.06)',
              borderColor: 'rgba(220, 38, 38, 0.2)',
              color: '#b91c1c',
            }}
          >
            {error || uploadError}{' '}
            <button
              type="button"
              className="ml-1 underline"
              onClick={() => {
                clearError()
                setUploadError(null)
              }}
            >
              Dismiss
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div>
          <motion.div
            layout
            className="relative aspect-video w-full max-h-[420px] overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-neutral-900"
            style={{ minHeight: '200px' }}
            animate={
              isRecording
                ? { boxShadow: '0 22px 90px rgba(220,38,38,0.22)', borderColor: 'rgba(220,38,38,0.45)' }
                : isActive
                  ? { boxShadow: '0 18px 70px rgba(15,118,110,0.18)', borderColor: 'rgba(15,118,110,0.30)' }
                  : undefined
            }
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            <video ref={videoRef} className="relative z-0 h-full w-full object-cover" playsInline muted autoPlay />

            {/* Subtle editorial motion when idle/recording */}
            <AnimatePresence>
              {(!isActive || isStarting) && (
                <motion.div
                  key="scanlines"
                  className="absolute inset-0 z-[1] pointer-events-none"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, backgroundPositionY: ['0px', '18px'] }}
                  exit={{ opacity: 0 }}
                  style={{
                    backgroundImage:
                      'repeating-linear-gradient(to bottom, rgba(15,118,110,0.10) 0px, rgba(15,118,110,0.10) 1px, transparent 1px, transparent 6px)',
                    maskImage: 'radial-gradient(circle at 50% 40%, black 0%, transparent 68%)',
                    WebkitMaskImage: 'radial-gradient(circle at 50% 40%, black 0%, transparent 68%)',
                  }}
                  transition={{ duration: 3.6, repeat: Infinity, ease: 'linear' }}
                />
              )}
            </AnimatePresence>

            {/* Placeholder overlays */}
            <AnimatePresence>
              {!isActive && !isStarting && (
                <motion.div
                  key="placeholder"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-[var(--bg-elevated)]/95 px-4 text-center text-sm text-[var(--text-muted)] pointer-events-none"
                >
                  <div className="rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 shadow-[0_12px_40px_rgba(0,0,0,0.06)]">
                    <div className="flex items-center gap-2">
                      <div
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--accent-subtle)] text-[var(--accent)]"
                        aria-hidden="true"
                      >
                        <Camera className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-[var(--text-primary)]">Camera ready when you are</div>
                        <div className="mt-0.5 text-xs">Tap “Start camera” to begin capturing.</div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {isStarting && (
                <motion.div
                  key="starting"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 text-sm font-medium text-white pointer-events-none"
                >
                  <div className="flex items-center gap-3 rounded-full bg-black/30 px-4 py-2.5 backdrop-blur">
                    <span className="spinner" />
                    Starting camera…
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Shutter flash */}
            <AnimatePresence>
              {showFlash && (
                <motion.div
                  key="flash"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 0.85, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.16, ease: 'easeOut' }}
                  className="absolute inset-0 z-[15] pointer-events-none"
                >
                  <div
                    className="h-full w-full"
                    style={{
                      background: 'radial-gradient(circle at 50% 45%, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.30) 22%, rgba(255,255,255,0) 55%)',
                      filter: 'blur(1px)',
                    }}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Recording overlays */}
            <AnimatePresence>
              {isRecording && (
                <motion.div
                  key="recording"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="absolute inset-0 z-10 pointer-events-none"
                >
                  <motion.div
                    className="absolute inset-0 rounded-[var(--radius-md)] border-2 border-red-300/40"
                    animate={{ scale: [1, 1.015, 0.995], opacity: [0.65, 1, 0.7] }}
                    transition={{ duration: 1.05, repeat: Infinity, repeatType: 'mirror' }}
                  />
                  <div className="absolute left-3 top-3 inline-flex items-center gap-2 rounded-full border border-red-200/30 bg-red-50/50 px-3 py-1.5 text-xs font-semibold text-red-700 backdrop-blur">
                    <Circle className="h-2.5 w-2.5 fill-current text-red-600" />
                    Recording <span className="tabular-nums">({recordTime})</span>
                  </div>
                  <div className="absolute bottom-3 right-3 inline-flex items-center gap-2 rounded-full border border-[var(--accent-ring)] bg-[var(--accent-subtle)] px-3 py-1.5 text-xs font-semibold text-[var(--accent)]">
                    Live clip
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Control dock */}
            <div className="absolute bottom-3 left-1/2 z-20 w-[calc(100%-1.25rem)] -translate-x-1/2 md:w-[520px]">
              <CameraControls
                className="w-full"
                isActive={isActive}
                isStarting={isStarting}
                isRecording={isRecording}
                uploading={uploading}
                onStart={startCamera}
                onStop={stopCamera}
                onCapture={handleCapture}
                onRecordToggle={handleRecordToggle}
              />
            </div>
          </motion.div>

          <p className="mt-2 text-xs text-[var(--text-muted)]">
            Your browser will request camera access (and microphone for video). Use HTTPS in production.
          </p>
        </div>

        <div>
          <div className="mb-2 flex items-end justify-between gap-3">
            <h3 className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--text-muted)]">Recent captures</h3>
            <span className="text-[10px] font-semibold text-[var(--text-muted)]">{media.length} items</span>
          </div>

          <motion.div layout className="max-h-[min(420px,50vh)] space-y-2 overflow-y-auto pr-1">
            {loadingList && <p className="text-sm text-[var(--text-muted)]">Loading…</p>}
            {!loadingList && media.length === 0 && (
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-[var(--radius-sm)] border border-dashed border-[var(--border)] p-4 text-center text-sm text-[var(--text-muted)]"
              >
                No media yet. Start the camera and capture an image or video.
              </motion.p>
            )}

            <AnimatePresence initial={false}>
              {media.map((m) => (
                <motion.a
                  key={m.id}
                  layout
                  href={m.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.98 }}
                  transition={{ duration: 0.18 }}
                  className="group flex items-center gap-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)] p-2.5 transition hover:border-[var(--accent)]"
                >
                  <motion.div
                    layout
                    className="relative h-12 w-12 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-card)]"
                    whileHover={{ scale: 1.03 }}
                  >
                    {m.type === 'image' ? (
                      <Image
                        src={m.fileUrl}
                        alt={`${m.type} capture`}
                        fill
                        sizes="48px"
                        unoptimized
                        className="object-cover transition duration-200 group-hover:brightness-[1.08]"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[var(--accent-subtle)] to-[var(--bg-elevated)]">
                        <div className="absolute inset-0 bg-[rgba(15,118,110,0.06)]" />
                        <div className="relative flex flex-col items-center gap-1">
                          <Play className="h-4 w-4 text-[var(--accent)]" />
                          <Video className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                        </div>
                      </div>
                    )}
                  </motion.div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="truncate text-xs font-semibold capitalize text-[var(--text-primary)]">
                        {m.type}
                      </div>
                      <span className="shrink-0 rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
                        Open
                      </span>
                    </div>
                    <div className="mt-0.5 text-[10px] text-[var(--text-muted)]">{new Date(m.createdAt).toLocaleString()}</div>
                  </div>
                </motion.a>
              ))}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </motion.section>
  )
}

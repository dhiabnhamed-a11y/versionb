'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { Camera, ImagePlus, Loader2, Square, Video } from 'lucide-react'

type Props = {
  isActive: boolean
  isStarting: boolean
  isRecording: boolean
  uploading: boolean
  className?: string
  onStart: () => void
  onStop: () => void
  onCapture: () => void
  onRecordToggle: () => void
}

export function CameraControls({
  isActive,
  isStarting,
  isRecording,
  uploading,
  className,
  onStart,
  onStop,
  onCapture,
  onRecordToggle,
}: Props) {
  const disabledAll = uploading || isStarting

  return (
    <motion.div
      layout
      transition={{ type: 'spring', stiffness: 420, damping: 30 }}
      animate={
        isRecording
          ? { boxShadow: '0 18px 70px rgba(220,38,38,0.22)', borderColor: 'rgba(220,38,38,0.35)' }
          : undefined
      }
      className={`${className ?? ''} rounded-[999px] border border-[rgba(221,214,200,0.85)] bg-[rgba(255,252,247,0.82)] px-2.5 py-2.5 shadow-[0_18px_60px_rgba(15,20,25,0.18)] backdrop-blur-xl ring-1 ring-[rgba(221,214,200,0.35)]`}
      role="group"
      aria-label="Camera controls"
    >
      {!isActive ? (
        <motion.button
          type="button"
          onClick={onStart}
          disabled={disabledAll}
          whileHover={{ filter: 'brightness(1.05)' }}
          whileTap={{ scale: 0.98 }}
          className="mx-auto flex w-full items-center justify-center gap-2 rounded-full bg-[var(--accent-gradient)] px-6 py-3.5 text-[13px] font-semibold text-white shadow-md transition disabled:opacity-60"
        >
          {isStarting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
          {isStarting ? 'Starting…' : 'Start camera'}
        </motion.button>
      ) : (
        <div className="grid grid-cols-3 items-center gap-2 px-1">
          <motion.button
            type="button"
            onClick={onStop}
            disabled={uploading || isRecording}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.98 }}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-4 py-2.5 text-[12px] font-semibold text-[var(--text-primary)] transition disabled:opacity-50 hover:border-[var(--accent)] hover:text-[var(--accent)]"
            aria-disabled={uploading || isRecording}
          >
            <Square className="h-4 w-4" />
            Stop
          </motion.button>

          <motion.button
            type="button"
            onClick={onCapture}
            disabled={uploading || isRecording}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.98 }}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-4 py-2.5 text-[12px] font-semibold transition disabled:opacity-50 hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
            Capture
          </motion.button>

          <div className="flex flex-col items-center justify-center">
            <div className="relative">
              <AnimatePresence>
                {isRecording && !uploading && (
                  <motion.div
                    key="ring"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.2 }}
                    className="pointer-events-none absolute inset-0 rounded-full"
                    style={{
                      boxShadow: '0 0 0 0 rgba(220, 38, 38, 0.35)',
                    }}
                  />
                )}
              </AnimatePresence>

              <motion.button
                type="button"
                onClick={onRecordToggle}
                disabled={uploading}
                whileHover={uploading ? undefined : { y: -1 }}
                whileTap={{ scale: 0.98 }}
                aria-pressed={isRecording}
                className={`relative grid h-14 w-14 place-items-center rounded-full border transition disabled:opacity-60 ${
                  uploading
                    ? 'border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-secondary)]'
                    : isRecording
                    ? 'border-red-300 bg-red-50 text-red-700 shadow-[0_10px_34px_rgba(220,38,38,0.16)]'
                    : 'border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
                }`}
              >
                <AnimatePresence>
                  {uploading ? (
                    <Loader2 className="relative h-5 w-5 animate-spin" />
                  ) : isRecording ? (
                    <>
                      <motion.span
                        className="pointer-events-none absolute inset-0 rounded-full"
                        initial={{ opacity: 0.2, scale: 0.88 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.8, repeat: Infinity, repeatType: 'mirror' }}
                        style={{
                          background: 'rgba(220, 38, 38, 0.10)',
                          boxShadow: '0 0 0 8px rgba(220,38,38,0.12)',
                        }}
                      />
                      <Square className="relative h-5 w-5" />
                    </>
                  ) : (
                    <Video className="relative h-5 w-5" />
                  )}
                </AnimatePresence>
              </motion.button>
            </div>
            <span
              className={`mt-1 whitespace-nowrap text-[10px] font-bold uppercase tracking-wide ${
                uploading ? 'text-[var(--text-muted)]' : isRecording ? 'text-red-600' : 'text-[var(--text-muted)]'
              }`}
            >
              {uploading ? 'Uploading…' : isRecording ? 'Stop & upload' : 'Record'}
            </span>
          </div>
        </div>
      )}
    </motion.div>
  )
}

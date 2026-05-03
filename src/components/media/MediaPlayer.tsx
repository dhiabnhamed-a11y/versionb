'use client'

/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from 'react'
import { Maximize2, Pause, Play, X } from 'lucide-react'
import videojs from 'video.js'
import type Player from 'video.js/dist/types/player'
import 'video.js/dist/video-js.css'

export type AgencyMediaItem = {
  id: string
  projectId?: string
  url: string
  playbackUrl?: string | null
  thumbnailUrl?: string | null
  type: string
  mimeType: string
  originalFilename?: string
  fileName?: string
  size?: number | null
  fileSize?: number | null
  duration?: number | null
  createdAt?: string
  uploadedBy?: { id: string; name: string }
  user?: { id: string; name: string }
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function VideoPlayer({ media }: { media: AgencyMediaItem }) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const playerRef = useRef<Player | null>(null)
  const src = media.playbackUrl || media.url

  useEffect(() => {
    if (!videoRef.current) return

    playerRef.current = videojs(videoRef.current, {
      controls: true,
      preload: 'metadata',
      fluid: true,
      responsive: true,
      poster: media.thumbnailUrl || undefined,
      sources: [
        {
          src,
          type: src.includes('.m3u8') ? 'application/x-mpegURL' : media.mimeType || 'video/mp4',
        },
      ],
    })

    return () => {
      playerRef.current?.dispose()
      playerRef.current = null
    }
  }, [media.mimeType, media.thumbnailUrl, src])

  return (
    <div className="aspect-video overflow-hidden rounded-[var(--radius-sm)] bg-neutral-950">
      <video ref={videoRef} className="video-js vjs-big-play-centered h-full w-full" playsInline />
    </div>
  )
}

function AudioPlayer({ media }: { media: AgencyMediaItem }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(media.duration ?? 0)

  function toggle() {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) {
      void audio.play()
    } else {
      audio.pause()
    }
  }

  return (
    <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
      <audio
        ref={audioRef}
        src={media.playbackUrl || media.url}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || media.duration || 0)}
        onTimeUpdate={(event) => setCurrent(event.currentTarget.currentTime)}
      />
      <div className="flex items-center gap-3">
        <button type="button" onClick={toggle} className="btn-secondary h-10 w-10 shrink-0 p-0" aria-label={playing ? 'Pause' : 'Play'}>
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-semibold text-[var(--text-primary)]">{media.originalFilename || media.fileName || 'Audio'}</div>
          <input
            type="range"
            min={0}
            max={duration || 0}
            step="0.1"
            value={Math.min(current, duration || current)}
            onChange={(event) => {
              const next = Number(event.target.value)
              setCurrent(next)
              if (audioRef.current) audioRef.current.currentTime = next
            }}
            className="mt-2 w-full accent-sky-700"
            aria-label="Seek audio"
          />
          <div className="mt-1 flex justify-between text-[11px] tabular-nums text-[var(--text-muted)]">
            <span>{formatTime(current)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export function MediaPlayer({ media }: { media: AgencyMediaItem }) {
  const [previewOpen, setPreviewOpen] = useState(false)

  if (media.type === 'video') return <VideoPlayer media={media} />
  if (media.type === 'audio') return <AudioPlayer media={media} />

  return (
    <>
      <button
        type="button"
        onClick={() => setPreviewOpen(true)}
        className="group relative aspect-video w-full overflow-hidden rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)]"
        aria-label="Open image preview"
      >
        <img
          src={media.thumbnailUrl || media.url}
          alt={media.originalFilename || media.fileName || 'Uploaded image'}
          loading="lazy"
          className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.02]"
        />
        <span className="absolute right-2 top-2 rounded-md bg-black/55 p-1.5 text-white opacity-0 transition group-hover:opacity-100">
          <Maximize2 className="h-4 w-4" />
        </span>
      </button>

      {previewOpen && (
        <div className="modal-backdrop" onClick={(event) => event.target === event.currentTarget && setPreviewOpen(false)}>
          <div className="relative w-[min(94vw,980px)] overflow-hidden rounded-[var(--radius-md)] bg-neutral-950 shadow-[var(--shadow-float)]">
            <button
              type="button"
              onClick={() => setPreviewOpen(false)}
              className="absolute right-3 top-3 z-10 rounded-md bg-white/90 p-2 text-neutral-900 shadow-sm"
              aria-label="Close preview"
            >
              <X className="h-4 w-4" />
            </button>
            <img src={media.url} alt={media.originalFilename || media.fileName || 'Uploaded image'} className="max-h-[86vh] w-full object-contain" />
          </div>
        </div>
      )}
    </>
  )
}

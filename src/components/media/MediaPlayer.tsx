'use client'

/* eslint-disable @next/next/no-img-element */

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import { CheckCircle2, Circle, CornerDownRight, Maximize2, MessageSquare, Pause, Play, Send, X } from 'lucide-react'
import videojs from 'video.js'
import type Player from 'video.js/dist/types/player'
import 'video.js/dist/video-js.css'

const COMMENT_TOLERANCE_SECONDS = 0.5

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

type MediaComment = {
  id: string
  fileId: string
  userId: string
  content: string
  timestamp: number
  parentId: string | null
  resolved: boolean
  createdAt: string
  user: { id: string; name: string }
}

type PlayerHandle = {
  seekTo: (seconds: number) => void
  getCurrentTime: () => number
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '00:00'
  const total = Math.floor(seconds)
  const hours = Math.floor(total / 3600)
  const mins = Math.floor((total % 3600) / 60)
  const secs = total % 60

  if (hours > 0) return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

function sortComments(comments: MediaComment[]) {
  return [...comments].sort((a, b) => a.timestamp - b.timestamp || Date.parse(a.createdAt) - Date.parse(b.createdAt))
}

function getActiveCommentId(comments: MediaComment[], currentTime: number) {
  const topLevel = comments.filter((comment) => !comment.parentId)
  let low = 0
  let high = topLevel.length - 1
  let candidate = -1

  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    if (topLevel[mid].timestamp <= currentTime + COMMENT_TOLERANCE_SECONDS) {
      candidate = mid
      low = mid + 1
    } else {
      high = mid - 1
    }
  }

  if (candidate < 0) return null

  const nearby = [topLevel[candidate], topLevel[candidate - 1], topLevel[candidate + 1]].filter(Boolean)
  const match = nearby
    .map((comment) => ({ comment, distance: Math.abs(comment.timestamp - currentTime) }))
    .filter(({ distance }) => distance <= COMMENT_TOLERANCE_SECONDS)
    .sort((a, b) => a.distance - b.distance)[0]

  return match?.comment.id ?? null
}

const VideoPlayer = forwardRef<PlayerHandle, {
  media: AgencyMediaItem
  onTimeChange: (seconds: number) => void
  onDurationChange: (seconds: number) => void
}>(function VideoPlayer({ media, onTimeChange, onDurationChange }, ref) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const playerRef = useRef<Player | null>(null)
  const src = media.playbackUrl || media.url

  useImperativeHandle(ref, () => ({
    seekTo(seconds) {
      const player = playerRef.current
      if (!player) return
      player.currentTime(Math.max(0, seconds))
      void player.play()
    },
    getCurrentTime() {
      const current = playerRef.current?.currentTime()
      return typeof current === 'number' ? current : 0
    },
  }), [])

  useEffect(() => {
    if (!videoRef.current) return

    const player = videojs(videoRef.current, {
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
    playerRef.current = player

    const emitTime = () => {
      const current = player.currentTime()
      if (typeof current === 'number') onTimeChange(current)
    }
    const emitDuration = () => {
      const duration = player.duration()
      if (typeof duration === 'number' && Number.isFinite(duration)) onDurationChange(duration)
    }

    player.on('timeupdate', emitTime)
    player.on('loadedmetadata', emitDuration)
    player.on('durationchange', emitDuration)

    return () => {
      player.off('timeupdate', emitTime)
      player.off('loadedmetadata', emitDuration)
      player.off('durationchange', emitDuration)
      player.dispose()
      playerRef.current = null
    }
  }, [media.mimeType, media.thumbnailUrl, onDurationChange, onTimeChange, src])

  return (
    <div className="aspect-video overflow-hidden rounded-[var(--radius-sm)] bg-neutral-950">
      <video ref={videoRef} className="video-js vjs-big-play-centered h-full w-full" playsInline />
    </div>
  )
})

const AudioPlayer = forwardRef<PlayerHandle, {
  media: AgencyMediaItem
  onTimeChange: (seconds: number) => void
  onDurationChange: (seconds: number) => void
}>(function AudioPlayer({ media, onTimeChange, onDurationChange }, ref) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(media.duration ?? 0)

  useImperativeHandle(ref, () => ({
    seekTo(seconds) {
      const audio = audioRef.current
      if (!audio) return
      audio.currentTime = Math.max(0, seconds)
      void audio.play()
    },
    getCurrentTime() {
      return audioRef.current?.currentTime ?? 0
    },
  }), [])

  function updateCurrent(next: number) {
    setCurrent(next)
    onTimeChange(next)
  }

  function updateDuration(next: number) {
    setDuration(next)
    onDurationChange(next)
  }

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
        onLoadedMetadata={(event) => updateDuration(event.currentTarget.duration || media.duration || 0)}
        onTimeUpdate={(event) => updateCurrent(event.currentTarget.currentTime)}
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
              updateCurrent(next)
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
})

function CommentMarkers({
  comments,
  duration,
  currentTime,
  onSeek,
}: {
  comments: MediaComment[]
  duration: number
  currentTime: number
  onSeek: (seconds: number) => void
}) {
  if (!duration || comments.length === 0) return null

  const progress = Math.min(100, Math.max(0, (currentTime / duration) * 100))

  return (
    <div className="relative mt-3 h-5" aria-label="Comment markers">
      <div className="absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-[var(--bg-secondary)]">
        <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${progress}%` }} />
      </div>
      {comments.map((comment) => {
        const left = Math.min(100, Math.max(0, (comment.timestamp / duration) * 100))
        return (
          <button
            key={comment.id}
            type="button"
            className={`absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-sm transition ${
              comment.resolved ? 'bg-emerald-600' : 'bg-[var(--gold)]'
            }`}
            style={{ left: `${left}%` }}
            title={`${formatTime(comment.timestamp)} - ${comment.content}`}
            aria-label={`Seek to comment at ${formatTime(comment.timestamp)}`}
            onClick={() => onSeek(comment.timestamp)}
          />
        )
      })}
    </div>
  )
}

function TimeSyncedComments({
  media,
  currentTime,
  duration,
  onSeek,
}: {
  media: AgencyMediaItem
  currentTime: number
  duration: number
  onSeek: (seconds: number) => void
}) {
  const [comments, setComments] = useState<MediaComment[]>([])
  const [draft, setDraft] = useState('')
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyDraft, setReplyDraft] = useState('')
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()

    ;(async () => {
      const response = await fetch(`/api/files/${media.id}/comments`, { signal: controller.signal })
      if (!response.ok) {
        if (response.status !== 404) setError('Could not load comments.')
        return
      }
      const body = await response.json()
      if (Array.isArray(body.comments)) setComments(sortComments(body.comments))
    })().catch((loadError) => {
      if (!(loadError instanceof DOMException && loadError.name === 'AbortError')) {
        setError('Could not load comments.')
      }
    })

    return () => controller.abort()
  }, [media.id])

  const topLevelComments = useMemo(() => sortComments(comments.filter((comment) => !comment.parentId)), [comments])
  const repliesByParent = useMemo(() => {
    const groups = new Map<string, MediaComment[]>()
    for (const comment of comments) {
      if (!comment.parentId) continue
      groups.set(comment.parentId, [...(groups.get(comment.parentId) ?? []), comment])
    }
    for (const [parentId, replies] of groups) {
      groups.set(parentId, replies.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)))
    }
    return groups
  }, [comments])
  const activeCommentId = useMemo(() => getActiveCommentId(topLevelComments, currentTime), [currentTime, topLevelComments])

  async function createComment(content: string, parentId?: string) {
    const cleanContent = content.trim()
    if (!cleanContent) return

    setPosting(true)
    setError('')

    const response = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileId: media.id,
        content: cleanContent,
        timestamp: parentId ? undefined : currentTime,
        parentId,
      }),
    })

    setPosting(false)
    if (!response.ok) {
      const body = await response.json().catch(() => null)
      setError(body?.error || 'Could not save comment.')
      return
    }

    const created = await response.json()
    setComments((current) => sortComments([...current, created]))
    if (parentId) {
      setReplyingTo(null)
      setReplyDraft('')
    } else {
      setDraft('')
    }
  }

  async function setResolved(commentId: string, resolved: boolean) {
    setComments((current) => current.map((comment) => (comment.id === commentId ? { ...comment, resolved } : comment)))

    const response = await fetch(`/api/comments/${commentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolved }),
    })

    if (!response.ok) {
      setComments((current) => current.map((comment) => (comment.id === commentId ? { ...comment, resolved: !resolved } : comment)))
      setError('Could not update resolved state.')
    }
  }

  return (
    <section className="border-t border-[var(--border)] bg-white p-3">
      <CommentMarkers comments={topLevelComments} duration={duration} currentTime={currentTime} onSeek={onSeek} />

      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[var(--accent)]">
          <MessageSquare className="h-4 w-4" />
          {topLevelComments.length} comments
        </div>
        <div className="text-[11px] tabular-nums text-[var(--text-muted)]">{formatTime(currentTime)}</div>
      </div>

      <div className="mt-3 grid gap-2">
        <textarea
          className="input min-h-20 resize-y text-sm"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={`Comment at ${formatTime(currentTime)}`}
          maxLength={2000}
        />
        <button type="button" className="btn-primary btn-sm justify-self-start" disabled={posting || !draft.trim()} onClick={() => void createComment(draft)}>
          <Send className="h-3.5 w-3.5" />
          Add comment at current time
        </button>
      </div>

      {error && <div className="mt-3 rounded-[var(--radius-sm)] border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{error}</div>}

      <div className="mt-4 grid max-h-80 gap-2 overflow-y-auto pr-1">
        {topLevelComments.length === 0 ? (
          <div className="rounded-[var(--radius-sm)] border border-dashed border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-4 text-center text-xs text-[var(--text-muted)]">
            No timed comments yet.
          </div>
        ) : (
          topLevelComments.map((comment) => {
            const replies = repliesByParent.get(comment.id) ?? []
            const active = activeCommentId === comment.id

            return (
              <article
                key={comment.id}
                className={`rounded-[var(--radius-sm)] border px-3 py-2 transition ${
                  active
                    ? 'border-[var(--accent)] bg-[var(--accent-subtle)] shadow-[var(--shadow-sm)]'
                    : comment.resolved
                      ? 'border-emerald-200 bg-emerald-50/60'
                      : 'border-[var(--border)] bg-[var(--bg-elevated)]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <button type="button" className="min-w-0 text-left" onClick={() => onSeek(comment.timestamp)}>
                    <span className="font-mono text-[11px] font-bold text-[var(--accent)]">{formatTime(comment.timestamp)}</span>
                    <span className="ml-2 text-xs font-semibold text-[var(--text-primary)]">{comment.user.name}</span>
                  </button>
                  <button
                    type="button"
                    className="shrink-0 rounded-md p-1 text-[var(--text-muted)] transition hover:bg-white hover:text-emerald-700"
                    aria-label={comment.resolved ? 'Mark unresolved' : 'Mark resolved'}
                    title={comment.resolved ? 'Mark unresolved' : 'Mark resolved'}
                    onClick={() => void setResolved(comment.id, !comment.resolved)}
                  >
                    {comment.resolved ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                  </button>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-secondary)]">{comment.content}</p>

                {replies.length > 0 && (
                  <div className="mt-2 grid gap-2 border-l-2 border-[var(--border)] pl-3">
                    {replies.map((reply) => (
                      <div key={reply.id} className="text-xs">
                        <div className="flex items-center gap-1.5 font-semibold text-[var(--text-primary)]">
                          <CornerDownRight className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                          {reply.user.name}
                        </div>
                        <p className="mt-1 whitespace-pre-wrap text-[var(--text-secondary)]">{reply.content}</p>
                      </div>
                    ))}
                  </div>
                )}

                {replyingTo === comment.id ? (
                  <div className="mt-2 grid gap-2">
                    <textarea
                      className="input min-h-16 resize-y text-xs"
                      value={replyDraft}
                      onChange={(event) => setReplyDraft(event.target.value)}
                      placeholder="Reply"
                      maxLength={2000}
                    />
                    <div className="flex gap-2">
                      <button type="button" className="btn-primary btn-sm !min-h-8 !px-3 text-[11px]" disabled={posting || !replyDraft.trim()} onClick={() => void createComment(replyDraft, comment.id)}>
                        Reply
                      </button>
                      <button type="button" className="btn-secondary btn-sm !min-h-8 !px-3 text-[11px]" onClick={() => setReplyingTo(null)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button type="button" className="mt-2 text-xs font-bold text-[var(--accent)] hover:underline" onClick={() => setReplyingTo(comment.id)}>
                    Reply
                  </button>
                )}
              </article>
            )
          })
        )}
      </div>
    </section>
  )
}

function TimedMediaPlayer({ media }: { media: AgencyMediaItem }) {
  const playerRef = useRef<PlayerHandle | null>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(media.duration ?? 0)

  function seekTo(seconds: number) {
    playerRef.current?.seekTo(seconds)
    setCurrentTime(seconds)
  }

  return (
    <>
      {media.type === 'video' ? (
        <VideoPlayer ref={playerRef} media={media} onTimeChange={setCurrentTime} onDurationChange={setDuration} />
      ) : (
        <AudioPlayer ref={playerRef} media={media} onTimeChange={setCurrentTime} onDurationChange={setDuration} />
      )}
      <TimeSyncedComments media={media} currentTime={currentTime} duration={duration} onSeek={seekTo} />
    </>
  )
}

export function MediaPlayer({ media }: { media: AgencyMediaItem }) {
  const [previewOpen, setPreviewOpen] = useState(false)

  if (media.type === 'video' || media.type === 'audio') return <TimedMediaPlayer media={media} />

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

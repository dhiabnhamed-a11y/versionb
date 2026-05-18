'use client'

/* eslint-disable @next/next/no-img-element */

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  CheckCircle2,
  Circle,
  CornerDownRight,
  Download,
  FileAudio2,
  ImageIcon,
  Link2,
  Maximize2,
  MessageSquare,
  MoreHorizontal,
  Pause,
  Play,
  Reply,
  Send,
  Sparkles,
  Video,
  Volume2,
  X,
} from 'lucide-react'
import videojs from 'video.js'
import type Player from 'video.js/dist/types/player'
import 'video.js/dist/video-js.css'
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription'

const COMMENT_TOLERANCE_SECONDS = 0.5
const COMMENT_REALTIME_EVENTS = ['comment_created', 'comment_updated'] as const

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

type ReviewStatus = 'pending' | 'approved' | 'needs_changes'

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '00:00'
  const total = Math.floor(seconds)
  const hours = Math.floor(total / 3600)
  const mins = Math.floor((total % 3600) / 60)
  const secs = total % 60

  if (hours > 0) return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

function formatRelativeTime(value?: string) {
  if (!value) return 'Just now'
  const date = new Date(value)
  const diff = Date.now() - date.getTime()
  if (!Number.isFinite(diff)) return 'Recently'
  const minutes = Math.max(1, Math.floor(diff / 60000))
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatBytes(bytes?: number | null) {
  if (!bytes) return 'Audio asset'
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(bytes > 10 * 1024 * 1024 ? 0 : 1)} MB`
}

function mediaTitle(media: AgencyMediaItem) {
  return media.originalFilename || media.fileName || 'Untitled deliverable'
}

function uploaderName(media: AgencyMediaItem) {
  return media.uploadedBy?.name || media.user?.name || 'Creative team'
}

function sortComments(comments: MediaComment[]) {
  return [...comments].sort((a, b) => a.timestamp - b.timestamp || Date.parse(a.createdAt) - Date.parse(b.createdAt))
}

function mergeComment(current: MediaComment[], next: MediaComment) {
  const existingIndex = current.findIndex((comment) => comment.id === next.id)
  if (existingIndex === -1) return sortComments([...current, next])

  const merged = [...current]
  merged[existingIndex] = next
  return sortComments(merged)
}

function isCommentRealtimePayload(payload: unknown): payload is { fileId: string; comment?: MediaComment } {
  return Boolean(
    payload &&
      typeof payload === 'object' &&
      'fileId' in payload &&
      typeof (payload as { fileId?: unknown }).fileId === 'string'
  )
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

function reviewStatus(topLevelComments: MediaComment[]): ReviewStatus {
  if (topLevelComments.some((comment) => !comment.resolved)) return 'needs_changes'
  if (topLevelComments.length > 0) return 'approved'
  return 'pending'
}

function StatusBadge({ status }: { status: ReviewStatus }) {
  const copy = {
    pending: { label: 'Pending', className: 'bg-amber-50 text-amber-700 ring-amber-200/70' },
    approved: { label: 'Approved', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200/70' },
    needs_changes: { label: 'Needs changes', className: 'bg-blue-50 text-blue-700 ring-blue-200/70' },
  }[status]

  return (
    <span className={`inline-flex h-7 shrink-0 items-center whitespace-nowrap rounded-full px-3 text-[12px] font-semibold ring-1 ${copy.className}`}>
      {copy.label}
    </span>
  )
}

const waveform = Array.from({ length: 78 }, (_, index) => {
  const seed = Math.sin(index * 1.74) + Math.cos(index * 0.41)
  return 26 + Math.round(Math.abs(seed) * 24) + (index % 7 === 0 ? 18 : 0)
})

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
    <div className="overflow-hidden rounded-[18px] bg-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,.08)]">
      <video ref={videoRef} className="video-js vjs-big-play-centered aspect-video h-full w-full" playsInline />
    </div>
  )
})

const AudioPlayer = forwardRef<PlayerHandle, {
  media: AgencyMediaItem
  currentTime: number
  duration: number
  onTimeChange: (seconds: number) => void
  onDurationChange: (seconds: number) => void
}>(function AudioPlayer({ media, currentTime, duration, onTimeChange, onDurationChange }, ref) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [volume, setVolume] = useState(0.82)
  const [speed, setSpeed] = useState(1)
  const progress = duration ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0

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

  function toggle() {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) {
      void audio.play()
    } else {
      audio.pause()
    }
  }

  function scrub(seconds: number) {
    if (audioRef.current) audioRef.current.currentTime = seconds
    onTimeChange(seconds)
  }

  function updateVolume(next: number) {
    setVolume(next)
    if (audioRef.current) audioRef.current.volume = next
  }

  function updateSpeed(next: number) {
    setSpeed(next)
    if (audioRef.current) audioRef.current.playbackRate = next
  }

  return (
    <section className="relative w-full max-w-full overflow-hidden rounded-[20px] bg-[linear-gradient(145deg,#0f172a,#111827_46%,#0b1220)] p-4 text-white shadow-[0_24px_60px_rgba(15,23,42,.20)] sm:p-5">
      <div className="pointer-events-none absolute inset-x-8 top-0 h-24 rounded-full bg-blue-400/20 blur-3xl" />
      <audio
        ref={audioRef}
        src={media.playbackUrl || media.url}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onLoadedMetadata={(event) => onDurationChange(event.currentTarget.duration || media.duration || 0)}
        onTimeUpdate={(event) => onTimeChange(event.currentTarget.currentTime)}
      />

      <div className="relative flex min-w-0 items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold uppercase tracking-[.16em] text-blue-200/70">Studio playback</p>
          <h3 className="mt-2 max-w-full truncate text-[18px] font-semibold tracking-[-.01em] text-white" title={mediaTitle(media)}>{mediaTitle(media)}</h3>
        </div>
        <button
          type="button"
          onClick={toggle}
          className="group grid h-16 w-16 shrink-0 place-items-center rounded-full bg-white text-slate-950 shadow-[0_20px_44px_rgba(37,99,235,.32)] transition duration-200 ease-out hover:scale-[1.03] active:scale-95"
          aria-label={playing ? 'Pause audio' : 'Play audio'}
        >
          {playing ? <Pause className="h-6 w-6" /> : <Play className="ml-1 h-6 w-6 fill-current" />}
        </button>
      </div>

      <div className="relative mt-8">
        <div className="media-waveform" aria-hidden="true">
          {waveform.map((height, index) => (
            <span
              key={`${media.id}-${index}`}
              style={{
                height: `${height}%`,
                opacity: index / waveform.length <= progress / 100 ? 1 : 0.38,
              }}
            />
          ))}
        </div>
        <div className="absolute inset-0 overflow-hidden rounded-[18px]" style={{ width: `${progress}%` }} aria-hidden="true">
          <div className="media-waveform media-waveform-active">
            {waveform.map((height, index) => (
              <span key={`${media.id}-active-${index}`} style={{ height: `${height}%` }} />
            ))}
          </div>
        </div>
        <input
          type="range"
          min={0}
          max={duration || 0}
          step="0.1"
          value={Math.min(currentTime, duration || currentTime)}
          onChange={(event) => scrub(Number(event.target.value))}
          className="media-scrubber"
          aria-label="Scrub audio timeline"
        />
      </div>

      <div className="relative mt-4 flex items-center justify-between text-[13px] font-medium tabular-nums text-slate-300">
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>

      <div className="relative mt-6 grid min-w-0 grid-cols-1 gap-3 rounded-2xl bg-white/[.07] p-3 ring-1 ring-white/10 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
        <label className="flex min-h-11 min-w-0 items-center gap-3 text-[13px] font-medium text-slate-200">
          <Volume2 className="h-4 w-4 shrink-0 text-blue-200" />
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(event) => updateVolume(Number(event.target.value))}
            className="min-w-0 flex-1 accent-blue-300"
            aria-label="Volume"
          />
        </label>
        <select
          value={speed}
          onChange={(event) => updateSpeed(Number(event.target.value))}
          className="h-11 shrink-0 rounded-xl border-0 bg-white/10 px-3 text-[13px] font-semibold text-white outline-none ring-1 ring-white/10 transition focus:ring-2 focus:ring-blue-300 [&_option]:text-slate-950"
          aria-label="Playback speed"
        >
          {[0.75, 1, 1.25, 1.5, 2].map((value) => (
            <option key={value} value={value}>
              {value}x
            </option>
          ))}
        </select>
        <a
          href={media.url}
          download
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-white px-4 py-2 text-[13px] font-semibold text-slate-950 shadow-sm transition hover:bg-blue-50 active:scale-[.98]"
        >
          <Download className="h-4 w-4 shrink-0" />
          Download
        </a>
      </div>
    </section>
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
  const progress = duration ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0

  return (
    <div className="relative h-10" aria-label="Timestamp comment markers">
      <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-blue-600 transition-[width] duration-200 ease-out" style={{ width: `${progress}%` }} />
      </div>
      {comments.map((comment) => {
        const left = duration ? Math.min(100, Math.max(0, (comment.timestamp / duration) * 100)) : 0
        return (
          <button
            key={comment.id}
            type="button"
            className={`absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white shadow-[0_8px_18px_rgba(15,23,42,.18)] transition hover:scale-125 ${
              comment.resolved ? 'bg-emerald-500' : 'bg-blue-600'
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

function CommentsPanel({
  comments,
  repliesByParent,
  currentTime,
  duration,
  activeCommentId,
  replyingTo,
  replyDraft,
  draft,
  posting,
  error,
  justAddedId,
  onDraftChange,
  onReplyDraftChange,
  onReplyingToChange,
  onCreateComment,
  onResolve,
  onSeek,
}: {
  comments: MediaComment[]
  repliesByParent: Map<string, MediaComment[]>
  currentTime: number
  duration: number
  activeCommentId: string | null
  replyingTo: string | null
  replyDraft: string
  draft: string
  posting: boolean
  error: string
  justAddedId: string | null
  onDraftChange: (value: string) => void
  onReplyDraftChange: (value: string) => void
  onReplyingToChange: (commentId: string | null) => void
  onCreateComment: (content: string, parentId?: string) => void
  onResolve: (commentId: string, resolved: boolean) => void
  onSeek: (seconds: number) => void
}) {
  return (
    <aside className="w-full max-w-full min-w-0 rounded-[20px] bg-white/95 p-4 shadow-[0_24px_70px_rgba(15,23,42,.08)] ring-1 ring-slate-200/80 backdrop-blur-xl sm:p-5 xl:min-w-[420px]">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12px] font-semibold uppercase tracking-[.16em] text-blue-600">Review thread</p>
          <h3 className="mt-1 text-[18px] font-semibold tracking-[-.01em] text-slate-950">{comments.length} comments</h3>
        </div>
        <span className="inline-flex h-8 shrink-0 items-center gap-2 rounded-full bg-slate-50 px-3 text-[13px] font-medium tabular-nums text-slate-500">
          <Sparkles className="h-3.5 w-3.5 text-blue-600" />
          {formatTime(currentTime)}
        </span>
      </div>

      <div className="mt-5">
        <CommentMarkers comments={comments} duration={duration} currentTime={currentTime} onSeek={onSeek} />
      </div>

      <div className="mt-5 rounded-[18px] bg-slate-50 p-2 ring-1 ring-slate-200/70">
        <textarea
          className="min-h-24 w-full max-w-full resize-y rounded-2xl border-0 bg-white px-4 py-3 text-[15px] font-medium leading-6 text-slate-900 shadow-sm outline-none ring-1 ring-slate-200/80 transition placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500"
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder={`Comment at ${formatTime(currentTime)}`}
          maxLength={2000}
        />
        <button
          type="button"
          className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-2 text-center text-[15px] font-semibold leading-5 text-white shadow-[0_16px_34px_rgba(37,99,235,.24)] transition duration-200 ease-out hover:-translate-y-0.5 hover:bg-blue-500 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={posting || !draft.trim()}
          onClick={() => onCreateComment(draft)}
        >
          <Send className="h-4 w-4 shrink-0" />
          <span className="min-w-0">Add comment at current time</span>
        </button>
      </div>

      {error && <div className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-[13px] font-semibold text-red-700 ring-1 ring-red-200/80">{error}</div>}

      <div className="mt-5 grid max-h-[32rem] min-w-0 gap-3 overflow-y-auto pr-1">
        {comments.length === 0 ? (
          <div className="rounded-[18px] bg-slate-50 px-5 py-10 text-center ring-1 ring-slate-200/80">
            <MessageSquare className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-3 text-[15px] font-semibold text-slate-900">No timed comments yet</p>
            <p className="mx-auto mt-1 max-w-[15rem] text-[13px] leading-5 text-slate-500">Drop precise feedback while the track plays and it will pin to this timeline.</p>
          </div>
        ) : (
          comments.map((comment, index) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              replies={repliesByParent.get(comment.id) ?? []}
              selected={activeCommentId === comment.id}
              unread={!comment.resolved && index === 0}
              justAdded={justAddedId === comment.id}
              replying={replyingTo === comment.id}
              replyDraft={replyDraft}
              posting={posting}
              onSeek={onSeek}
              onResolve={onResolve}
              onReply={() => onReplyingToChange(comment.id)}
              onCancelReply={() => onReplyingToChange(null)}
              onReplyDraftChange={onReplyDraftChange}
              onSubmitReply={() => onCreateComment(replyDraft, comment.id)}
            />
          ))
        )}
      </div>
    </aside>
  )
}

function CommentItem({
  comment,
  replies,
  selected,
  unread,
  justAdded,
  replying,
  replyDraft,
  posting,
  onSeek,
  onResolve,
  onReply,
  onCancelReply,
  onReplyDraftChange,
  onSubmitReply,
}: {
  comment: MediaComment
  replies: MediaComment[]
  selected: boolean
  unread: boolean
  justAdded: boolean
  replying: boolean
  replyDraft: string
  posting: boolean
  onSeek: (seconds: number) => void
  onResolve: (commentId: string, resolved: boolean) => void
  onReply: () => void
  onCancelReply: () => void
  onReplyDraftChange: (value: string) => void
  onSubmitReply: () => void
}) {
  const initials = comment.user.name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <article
      className={`group w-full max-w-full overflow-hidden rounded-[18px] p-4 transition duration-200 ease-out ${
        selected
          ? 'bg-white shadow-[0_0_0_2px_rgba(37,99,235,.5),0_18px_44px_rgba(37,99,235,.12)]'
          : comment.resolved
            ? 'bg-emerald-50/80 ring-1 ring-emerald-200/70'
            : unread
              ? 'bg-blue-50/80 ring-1 ring-blue-200/70'
              : 'bg-white ring-1 ring-slate-200/80 hover:-translate-y-0.5 hover:shadow-[0_16px_34px_rgba(15,23,42,.08)]'
      } ${justAdded ? 'animate-comment-pop' : ''}`}
    >
      <div className="flex min-w-0 items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-950 text-[12px] font-semibold text-white shadow-sm">
          {initials || '?'}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <button type="button" className="min-w-0 text-left" onClick={() => onSeek(comment.timestamp)}>
              <span className="block truncate text-[14px] font-semibold text-slate-950">{comment.user.name}</span>
              <span className="mt-1 inline-flex h-6 items-center rounded-full bg-slate-100 px-2.5 font-mono text-[12px] font-semibold tabular-nums text-blue-700">
                {formatTime(comment.timestamp)}
              </span>
            </button>
            <button
              type="button"
              className={`grid h-8 w-8 shrink-0 place-items-center rounded-full transition ${
                comment.resolved ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-50 text-slate-500 hover:bg-emerald-50 hover:text-emerald-700'
              }`}
              aria-label={comment.resolved ? 'Mark unresolved' : 'Resolve comment'}
              title={comment.resolved ? 'Mark unresolved' : 'Resolve comment'}
              onClick={() => onResolve(comment.id, !comment.resolved)}
            >
              {comment.resolved ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
            </button>
          </div>
          <p className="mt-3 break-words whitespace-pre-wrap text-[15px] font-medium leading-6 text-slate-700">{comment.content}</p>

          <div className="mt-3 flex items-center gap-3">
            <button type="button" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-blue-600 transition hover:text-blue-500" onClick={onReply}>
              <Reply className="h-3.5 w-3.5" />
              Reply
            </button>
            <span className="text-[12px] text-slate-400">{formatRelativeTime(comment.createdAt)}</span>
          </div>

          {replies.length > 0 && (
            <div className="mt-4 grid min-w-0 gap-3 border-l border-slate-200 pl-4">
              {replies.map((reply) => (
                <div key={reply.id} className="min-w-0 rounded-2xl bg-slate-50 px-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-2 text-[13px] font-semibold text-slate-950">
                    <CornerDownRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className="min-w-0 truncate">{reply.user.name}</span>
                  </div>
                  <p className="mt-1 break-words whitespace-pre-wrap text-[13px] leading-5 text-slate-600">{reply.content}</p>
                </div>
              ))}
            </div>
          )}

          {replying && (
            <div className="mt-4 grid gap-2 rounded-2xl bg-slate-50 p-2 ring-1 ring-slate-200/70">
              <textarea
                className="min-h-20 resize-y rounded-xl border-0 bg-white px-3 py-2 text-[13px] font-medium text-slate-900 outline-none ring-1 ring-slate-200/80 transition placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500"
                value={replyDraft}
                onChange={(event) => onReplyDraftChange(event.target.value)}
                placeholder="Reply with context"
                maxLength={2000}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="inline-flex min-h-9 shrink-0 items-center justify-center whitespace-nowrap rounded-xl bg-slate-950 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
                  disabled={posting || !replyDraft.trim()}
                  onClick={onSubmitReply}
                >
                  Reply
                </button>
                <button type="button" className="inline-flex min-h-9 shrink-0 items-center justify-center whitespace-nowrap rounded-xl bg-white px-4 py-2 text-[13px] font-semibold text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-50" onClick={onCancelReply}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </article>
  )
}

function DeliverableCard({ media }: { media: AgencyMediaItem }) {
  const playerRef = useRef<PlayerHandle | null>(null)
  const [comments, setComments] = useState<MediaComment[]>([])
  const [draft, setDraft] = useState('')
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyDraft, setReplyDraft] = useState('')
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState('')
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(media.duration ?? 0)
  const [justAddedId, setJustAddedId] = useState<string | null>(null)
  const justAddedTimerRef = useRef<number | null>(null)

  const fetchComments = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch(`/api/files/${media.id}/comments`, { cache: 'no-store', signal })
      if (!response.ok) {
        if (response.status !== 404) setError('Could not load comments.')
        return null
      }
      const body = await response.json()
      return Array.isArray(body.comments) ? sortComments(body.comments) : null
    } catch (loadError) {
      if (!(loadError instanceof DOMException && loadError.name === 'AbortError')) {
        setError('Could not load comments.')
      }
      return null
    }
  }, [media.id])

  const loadComments = useCallback(async (signal?: AbortSignal) => {
    const nextComments = await fetchComments(signal)
    if (nextComments) setComments(nextComments)
  }, [fetchComments])

  useEffect(() => {
    const controller = new AbortController()

    ;(async () => {
      const nextComments = await fetchComments(controller.signal)
      if (!controller.signal.aborted && nextComments) setComments(nextComments)
    })()

    return () => controller.abort()
  }, [fetchComments])

  useEffect(() => {
    return () => {
      if (justAddedTimerRef.current) window.clearTimeout(justAddedTimerRef.current)
    }
  }, [])

  useRealtimeSubscription(COMMENT_REALTIME_EVENTS, (eventName, payload) => {
    if (isCommentRealtimePayload(payload)) {
      if (payload.fileId !== media.id) return
      if (payload.comment) {
        setComments((current) => mergeComment(current, payload.comment!))
        return
      }
    }

    if (eventName === 'workspace_event') {
      void loadComments()
    }
  }, 120)

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
  const status = reviewStatus(topLevelComments)
  const unresolvedCount = topLevelComments.filter((comment) => !comment.resolved).length

  function seekTo(seconds: number) {
    playerRef.current?.seekTo(seconds)
    setCurrentTime(seconds)
  }

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

    const created = (await response.json()) as MediaComment
    setComments((current) => mergeComment(current, created))
    setJustAddedId(created.id)
    if (justAddedTimerRef.current) window.clearTimeout(justAddedTimerRef.current)
    justAddedTimerRef.current = window.setTimeout(() => {
      setJustAddedId(null)
      justAddedTimerRef.current = null
    }, 900)
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
      return
    }

    const updated = (await response.json()) as MediaComment
    setComments((current) => mergeComment(current, updated))
  }

  return (
    <article className="group relative w-full max-w-full overflow-hidden rounded-[24px] bg-white p-4 shadow-[0_30px_90px_rgba(15,23,42,.08),0_1px_0_rgba(15,23,42,.04)] ring-1 ring-slate-200/70 transition duration-200 ease-out hover:-translate-y-1 hover:shadow-[0_34px_100px_rgba(15,23,42,.12),0_1px_0_rgba(15,23,42,.04)] sm:p-6">
      <div className="pointer-events-none absolute inset-x-10 -top-24 h-48 rounded-full bg-blue-500/[.06] blur-3xl" />
      <header className="relative flex min-w-0 flex-col gap-5 border-b border-slate-100 pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-[18px] bg-[linear-gradient(145deg,#2563eb,#0f172a)] text-white shadow-[0_18px_36px_rgba(37,99,235,.24)]">
            {media.type === 'video' ? <Video className="h-6 w-6" /> : media.type === 'image' ? <ImageIcon className="h-6 w-6" /> : <FileAudio2 className="h-6 w-6" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h2 className="min-w-0 max-w-full flex-1 truncate text-[18px] font-semibold tracking-[-.01em] text-slate-950" title={mediaTitle(media)}>{mediaTitle(media)}</h2>
              <StatusBadge status={status} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-slate-500">
              <span>{uploaderName(media)}</span>
              <span className="h-1 w-1 rounded-full bg-slate-300" />
              <span>Version 1</span>
              <span className="h-1 w-1 rounded-full bg-slate-300" />
              <span>{formatRelativeTime(media.createdAt)}</span>
              <span className="h-1 w-1 rounded-full bg-slate-300" />
              <span>{formatBytes(media.size ?? media.fileSize)}</span>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">
          <span className="inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-slate-50 px-4 text-[13px] font-semibold text-slate-600 ring-1 ring-slate-200/70">
            <MessageSquare className="h-4 w-4 shrink-0 text-blue-600" />
            {topLevelComments.length} comments
          </span>
          {unresolvedCount > 0 && (
            <span className="inline-flex h-10 shrink-0 items-center whitespace-nowrap rounded-full bg-blue-50 px-4 text-[13px] font-semibold text-blue-700 ring-1 ring-blue-200/70">
              {unresolvedCount} open
            </span>
          )}
          <a
            href={media.url}
            target="_blank"
            rel="noreferrer"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-slate-600 shadow-sm ring-1 ring-slate-200 transition hover:text-blue-600 hover:shadow-md"
            aria-label="Open file"
          >
            <Link2 className="h-4 w-4" />
          </a>
          <details className="relative">
            <summary className="grid h-10 w-10 shrink-0 cursor-pointer list-none place-items-center rounded-full bg-white text-slate-500 shadow-sm ring-1 ring-slate-200 transition hover:text-slate-950 hover:shadow-md [&::-webkit-details-marker]:hidden" aria-label="More actions">
              <MoreHorizontal className="h-4 w-4" />
            </summary>
            <section className="absolute right-0 z-20 mt-2 min-w-[180px] overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
              <a href={media.url} download className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                <Download className="h-4 w-4" /> Download
              </a>
              <button type="button" className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50" onClick={() => void navigator.clipboard.writeText(media.url)}>
                <Link2 className="h-4 w-4" /> Copy link
              </button>
            </section>
          </details>
        </div>
      </header>

      <div className="relative mt-6 grid min-w-0 grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(420px,0.6fr)]">
        <div className="min-w-0 max-w-full">
          {media.type === 'video' ? (
            <VideoPlayer ref={playerRef} media={media} onTimeChange={setCurrentTime} onDurationChange={setDuration} />
          ) : (
            <AudioPlayer
              ref={playerRef}
              media={media}
              currentTime={currentTime}
              duration={duration}
              onTimeChange={setCurrentTime}
              onDurationChange={setDuration}
            />
          )}

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {[
              ['Duration', formatTime(duration)],
              ['Review time', formatTime(currentTime)],
              ['Resolution', status === 'approved' ? 'Approved' : status === 'needs_changes' ? 'Open feedback' : 'Awaiting notes'],
            ].map(([label, value]) => (
              <div key={label} className="min-w-0 rounded-[18px] bg-slate-50 px-4 py-3 ring-1 ring-slate-200/70">
                <div className="text-[12px] font-semibold uppercase tracking-[.14em] text-slate-400">{label}</div>
                <div className="mt-1 truncate text-[15px] font-semibold text-slate-950" title={value}>{value}</div>
              </div>
            ))}
          </div>
        </div>

        <CommentsPanel
          comments={topLevelComments}
          repliesByParent={repliesByParent}
          currentTime={currentTime}
          duration={duration}
          activeCommentId={activeCommentId}
          replyingTo={replyingTo}
          replyDraft={replyDraft}
          draft={draft}
          posting={posting}
          error={error}
          justAddedId={justAddedId}
          onDraftChange={setDraft}
          onReplyDraftChange={setReplyDraft}
          onReplyingToChange={setReplyingTo}
          onCreateComment={(content, parentId) => void createComment(content, parentId)}
          onResolve={(commentId, resolved) => void setResolved(commentId, resolved)}
          onSeek={seekTo}
        />
      </div>
    </article>
  )
}

function ImageReview({ media }: { media: AgencyMediaItem }) {
  const [previewOpen, setPreviewOpen] = useState(false)

  return (
    <>
      <article className="group w-full max-w-full overflow-hidden rounded-[24px] bg-white p-4 shadow-[0_30px_90px_rgba(15,23,42,.08)] ring-1 ring-slate-200/70 transition duration-200 hover:-translate-y-1 hover:shadow-[0_34px_100px_rgba(15,23,42,.12)]">
        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
          className="relative aspect-video w-full overflow-hidden rounded-[20px] bg-slate-100"
          aria-label="Open image preview"
        >
          <img
            src={media.thumbnailUrl || media.url}
            alt={mediaTitle(media)}
            loading="lazy"
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
          />
          <span className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/90 text-slate-700 opacity-0 shadow-lg backdrop-blur transition group-hover:opacity-100">
            <Maximize2 className="h-4 w-4" />
          </span>
        </button>
        <div className="mt-4 flex min-w-0 flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[18px] font-semibold text-slate-950" title={mediaTitle(media)}>{mediaTitle(media)}</h2>
            <p className="mt-1 text-[13px] text-slate-500">{uploaderName(media)} · {formatRelativeTime(media.createdAt)}</p>
          </div>
          <a href={media.url} target="_blank" rel="noreferrer" className="btn-secondary btn-sm shrink-0 whitespace-nowrap">
            <Link2 className="h-4 w-4 shrink-0" />
            Open
          </a>
        </div>
      </article>

      {previewOpen && (
        <div className="modal-backdrop" onClick={(event) => event.target === event.currentTarget && setPreviewOpen(false)}>
          <div className="relative w-[min(94vw,980px)] overflow-hidden rounded-[24px] bg-neutral-950 shadow-[var(--shadow-float)]">
            <button
              type="button"
              onClick={() => setPreviewOpen(false)}
              className="absolute right-4 top-4 z-10 grid h-10 w-10 place-items-center rounded-full bg-white/90 text-neutral-900 shadow-sm backdrop-blur"
              aria-label="Close preview"
            >
              <X className="h-4 w-4" />
            </button>
            <img src={media.url} alt={mediaTitle(media)} className="max-h-[86vh] w-full object-contain" />
          </div>
        </div>
      )}
    </>
  )
}

export function MediaPlayer({ media }: { media: AgencyMediaItem }) {
  if (media.type === 'video' || media.type === 'audio') return <DeliverableCard media={media} />
  return <ImageReview media={media} />
}

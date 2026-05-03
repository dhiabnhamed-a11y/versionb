'use client'

import { useRef, useState } from 'react'
import { FileAudio, ImageIcon, Loader2, UploadCloud, Video } from 'lucide-react'
import { MediaPlayer, type AgencyMediaItem } from '@/components/media/MediaPlayer'

const STANDARD_UPLOAD_LIMIT = 25 * 1024 * 1024
const CHUNK_SIZE = 8 * 1024 * 1024
const MAX_BY_KIND = {
  image: 25 * 1024 * 1024,
  audio: 75 * 1024 * 1024,
  video: 250 * 1024 * 1024,
}

type UploadState = {
  name: string
  progress: number
  status: 'uploading' | 'processing' | 'done' | 'error'
  error?: string
}

function mediaKind(file: File) {
  if (file.type.startsWith('image/')) return 'image'
  if (file.type.startsWith('video/')) return 'video'
  if (file.type.startsWith('audio/')) return 'audio'
  return null
}

function formatBytes(bytes?: number | null) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)}KB`
  return `${Math.ceil(bytes / 1024 / 1024)}MB`
}

function xhrForm(url: string, formData: FormData, onProgress: (progress: number) => void) {
  return new Promise<unknown>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', url)
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100))
    }
    xhr.onload = () => {
      let body: unknown = null
      try {
        body = JSON.parse(xhr.responseText)
      } catch {
        body = null
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(body)
      } else {
        const error = body && typeof body === 'object' && 'error' in body ? String((body as { error: unknown }).error) : 'Upload failed.'
        reject(new Error(error))
      }
    }
    xhr.onerror = () => reject(new Error('Network upload failed.'))
    xhr.send(formData)
  })
}

function makeUploadId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID().replace(/-/g, '')
  }
  return `${Date.now()}${Math.random().toString(16).slice(2)}`.slice(0, 32)
}

async function uploadStandard(projectId: string, file: File, onProgress: (progress: number) => void) {
  const form = new FormData()
  form.set('file', file)
  return xhrForm(`/api/projects/${projectId}/media`, form, onProgress) as Promise<AgencyMediaItem>
}

async function uploadChunked(projectId: string, file: File, onProgress: (progress: number) => void) {
  const uploadId = makeUploadId()
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE)
  let completedBytes = 0
  let finalMedia: AgencyMediaItem | null = null

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
    const start = chunkIndex * CHUNK_SIZE
    const end = Math.min(file.size, start + CHUNK_SIZE)
    const chunk = file.slice(start, end)
    const form = new FormData()
    form.set('chunk', chunk, file.name)
    form.set('uploadId', uploadId)
    form.set('chunkIndex', String(chunkIndex))
    form.set('totalChunks', String(totalChunks))
    form.set('totalSize', String(file.size))
    form.set('fileName', file.name)
    form.set('mimeType', file.type)

    const body = await xhrForm(`/api/projects/${projectId}/media/chunk`, form, (chunkProgress) => {
      const uploadedInChunk = Math.round((chunkProgress / 100) * chunk.size)
      onProgress(Math.min(98, Math.round(((completedBytes + uploadedInChunk) / file.size) * 100)))
    }) as { complete?: boolean; media?: AgencyMediaItem }

    completedBytes += chunk.size
    if (body.complete && body.media) finalMedia = body.media
  }

  if (!finalMedia) throw new Error('Upload finished but media metadata was not returned.')
  onProgress(100)
  return finalMedia
}

function iconFor(type: string) {
  if (type === 'video') return <Video className="h-4 w-4" />
  if (type === 'audio') return <FileAudio className="h-4 w-4" />
  return <ImageIcon className="h-4 w-4" />
}

export function ProjectMediaStudio({
  projectId,
  initialMedia,
}: {
  projectId: string
  initialMedia: AgencyMediaItem[]
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [media, setMedia] = useState<AgencyMediaItem[]>(initialMedia)
  const [dragging, setDragging] = useState(false)
  const [uploads, setUploads] = useState<UploadState[]>([])
  const [error, setError] = useState('')

  async function refresh() {
    const response = await fetch(`/api/projects/${projectId}/media`)
    if (!response.ok) return
    const body = await response.json()
    if (Array.isArray(body)) setMedia(body)
  }

  async function uploadFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList)
    setError('')

    for (const file of files) {
      const kind = mediaKind(file)
      if (!kind) {
        setError('Unsupported file type. Upload images, videos, or audio files only.')
        continue
      }
      if (file.size > MAX_BY_KIND[kind]) {
        setError(`${file.name} is too large for ${kind} uploads.`)
        continue
      }

      setUploads((current) => [{ name: file.name, progress: 0, status: 'uploading' }, ...current])
      try {
        const uploaded =
          file.size > STANDARD_UPLOAD_LIMIT
            ? await uploadChunked(projectId, file, (progress) => {
                setUploads((current) => current.map((item) => (item.name === file.name ? { ...item, progress } : item)))
              })
            : await uploadStandard(projectId, file, (progress) => {
                setUploads((current) => current.map((item) => (item.name === file.name ? { ...item, progress } : item)))
              })

        setUploads((current) => current.map((item) => (item.name === file.name ? { ...item, progress: 100, status: 'done' } : item)))
        setMedia((current) => [uploaded, ...current])
      } catch (uploadError) {
        setUploads((current) =>
          current.map((item) =>
            item.name === file.name
              ? { ...item, status: 'error', error: uploadError instanceof Error ? uploadError.message : 'Upload failed.' }
              : item
          )
        )
      }
    }

    void refresh()
  }

  return (
    <section className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-card)] p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-semibold">Media library</h2>
          <p className="mt-1 text-xs text-[var(--text-muted)]">{media.length} Cloudinary assets</p>
        </div>
        <button type="button" onClick={() => inputRef.current?.click()} className="btn-primary btn-sm">
          <UploadCloud className="h-4 w-4" />
          Upload
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*,video/*,audio/*"
        className="sr-only"
        onChange={(event) => {
          if (event.target.files) void uploadFiles(event.target.files)
          event.currentTarget.value = ''
        }}
      />

      <div
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          void uploadFiles(event.dataTransfer.files)
        }}
        className={`mb-4 flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-[var(--radius-sm)] border border-dashed px-4 py-7 text-center transition ${
          dragging ? 'border-[var(--accent)] bg-[var(--accent-subtle)]' : 'border-[var(--border)] bg-[var(--bg-elevated)]'
        }`}
        onClick={() => inputRef.current?.click()}
      >
        <UploadCloud className="mb-2 h-7 w-7 text-[var(--accent)]" />
        <div className="text-sm font-semibold text-[var(--text-primary)]">Drop images, videos, or audio</div>
        <div className="mt-1 text-xs text-[var(--text-muted)]">Videos up to 250MB use chunk upload automatically</div>
      </div>

      {error && (
        <div className="mb-4 rounded-[var(--radius-sm)] border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
          {error}
        </div>
      )}

      {uploads.length > 0 && (
        <div className="mb-5 grid gap-2">
          {uploads.slice(0, 4).map((upload) => (
            <div key={upload.name} className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="truncate font-semibold text-[var(--text-primary)]">{upload.name}</span>
                <span className="shrink-0 tabular-nums text-[var(--text-muted)]">
                  {upload.status === 'error' ? 'Failed' : `${upload.progress}%`}
                </span>
              </div>
              <div className="progress-bar mt-2">
                <div className="progress-fill" style={{ width: `${upload.progress}%` }} />
              </div>
              {upload.error && <div className="mt-1 text-[11px] text-red-700">{upload.error}</div>}
            </div>
          ))}
        </div>
      )}

      {media.length === 0 ? (
        <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)] p-6 text-center text-sm text-[var(--text-muted)]">
          No media uploaded yet.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {media.map((item) => (
            <article key={item.id} className="overflow-hidden rounded-[var(--radius-sm)] border border-[var(--border)] bg-white">
              <MediaPlayer media={item} />
              <div className="flex items-start justify-between gap-3 p-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">
                    {iconFor(item.type)}
                    {item.type}
                  </div>
                  <div className="mt-1 truncate text-sm font-semibold text-[var(--text-primary)]">
                    {item.originalFilename || item.fileName || 'Media'}
                  </div>
                  <div className="mt-1 text-[11px] text-[var(--text-muted)]">
                    {formatBytes(item.size ?? item.fileSize)} {item.uploadedBy?.name ? `- ${item.uploadedBy.name}` : ''}
                  </div>
                </div>
                {(uploads.some((upload) => upload.name === (item.originalFilename || item.fileName) && upload.status === 'uploading')) && (
                  <Loader2 className="h-4 w-4 animate-spin text-[var(--accent)]" />
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}


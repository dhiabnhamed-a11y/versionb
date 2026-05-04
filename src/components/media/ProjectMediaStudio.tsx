'use client'

import { useRef, useState } from 'react'
import { FileAudio, Loader2, UploadCloud, WandSparkles } from 'lucide-react'
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
    <section className="media-studio-shell w-full max-w-full">
      <div className="mb-8 flex min-w-0 flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 max-w-2xl">
          <div className="inline-flex h-8 items-center gap-2 rounded-full bg-blue-50 px-3 text-[12px] font-semibold text-blue-700 ring-1 ring-blue-200/70">
            <WandSparkles className="h-3.5 w-3.5" />
            Premium review room
          </div>
          <h2 className="mt-4 text-[26px] font-semibold tracking-[-.02em] text-slate-950">Uploaded deliverables</h2>
          <p className="mt-2 text-[15px] leading-7 text-slate-500">
            Review audio, pin timestamped feedback, resolve revisions, and keep every creative decision attached to the file.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-[13px] font-medium text-slate-500">
            <span className="rounded-full bg-white px-3 py-1.5 ring-1 ring-slate-200/70">{media.length} assets</span>
            <span className="rounded-full bg-white px-3 py-1.5 ring-1 ring-slate-200/70">Cloudinary backed</span>
            <span className="rounded-full bg-white px-3 py-1.5 ring-1 ring-slate-200/70">Timestamp comments</span>
          </div>
        </div>
        <button type="button" onClick={() => inputRef.current?.click()} className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-2xl bg-slate-950 px-5 py-2 text-[15px] font-semibold text-white shadow-[0_18px_40px_rgba(15,23,42,.18)] transition hover:-translate-y-0.5 hover:bg-slate-800 active:scale-[.98]">
          <UploadCloud className="h-4 w-4 shrink-0" />
          Upload deliverable
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
        className={`mb-8 flex min-h-40 w-full max-w-full cursor-pointer flex-col items-center justify-center rounded-[24px] border border-dashed px-6 py-8 text-center shadow-sm transition duration-200 ease-out ${
          dragging ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-slate-300/70 bg-white/70 text-slate-600 hover:border-blue-300 hover:bg-white'
        }`}
        onClick={() => inputRef.current?.click()}
      >
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-blue-600 ring-1 ring-blue-200/70">
          <UploadCloud className="h-5 w-5" />
        </div>
        <div className="mt-4 text-[15px] font-semibold text-slate-950">Drop images, videos, or audio</div>
        <div className="mt-1 max-w-full break-words text-[13px] text-slate-500">Large video and audio deliverables upload in resilient chunks automatically.</div>
      </div>

      {error && (
        <div className="mb-5 rounded-2xl bg-red-50 px-4 py-3 text-[13px] font-semibold text-red-700 ring-1 ring-red-200/80">
          {error}
        </div>
      )}

      {uploads.length > 0 && (
        <div className="mb-8 grid gap-3">
          {uploads.slice(0, 4).map((upload) => (
            <div key={upload.name} className="rounded-[20px] bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200/80">
              <div className="flex items-center justify-between gap-3 text-[13px]">
                <span className="truncate font-semibold text-slate-950">{upload.name}</span>
                <span className="shrink-0 tabular-nums text-slate-500">
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
        <div className="rounded-[24px] bg-white px-6 py-16 text-center shadow-[0_30px_90px_rgba(15,23,42,.08)] ring-1 ring-slate-200/80">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-slate-50 text-slate-400 ring-1 ring-slate-200/80">
            <FileAudio className="h-6 w-6" />
          </div>
          <p className="mt-4 text-[18px] font-semibold text-slate-950">No media uploaded yet</p>
          <p className="mx-auto mt-2 max-w-md text-[15px] leading-7 text-slate-500">Upload a first deliverable to unlock premium playback, timestamped comments, and approval-ready review history.</p>
        </div>
      ) : (
        <div className="grid min-w-0 gap-8">
          {media.map((item) => (
            <div key={item.id} className="relative min-w-0">
              <MediaPlayer media={item} />
              {uploads.some((upload) => upload.name === (item.originalFilename || item.fileName) && upload.status === 'uploading') && (
                <div className="absolute right-5 top-5 grid h-10 w-10 place-items-center rounded-full bg-white/90 text-blue-600 shadow-lg ring-1 ring-blue-200/70 backdrop-blur">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type HTMLAttributes } from 'react'
import Image from 'next/image'
import { AnimatePresence, motion } from 'framer-motion'
import videojs from 'video.js'
import type Player from 'video.js/dist/types/player'
import 'video.js/dist/video-js.css'

import { useCamera } from '@/hooks/useCamera'
import { CameraControls } from '@/components/camera/CameraControls'
import {
  Aperture,
  Camera,
  CircleDot,
  ImagePlus,
  Loader2,
  Play,
  RefreshCw,
  Save,
  Square,
  TestTube2,
  Video,
  Wifi,
  WifiOff,
} from 'lucide-react'

type MediaItem = {
  id: string
  fileUrl: string
  type: string
  createdAt: string
}

type ExternalCamera = {
  id: string
  projectId: string
  name: string
  ipAddress: string
  port: number
  username: string
  rtspPath: string
  status: string
  streamUrl: string
  lastError?: string | null
}

type Props = {
  projectId: string
  initialEnabled?: boolean
  initialCameraType?: 'device' | 'external'
  onProjectCameraChange?: (settings: { hasCamera: boolean; cameraType: 'device' | 'external' }) => void
}

type CameraForm = {
  name: string
  ipAddress: string
  port: string
  username: string
  password: string
  rtspPath: string
}

async function readJson<T>(res: Response): Promise<T> {
  return (await res.json().catch(() => ({}))) as T
}

async function uploadBlob(projectId: string, blob: Blob, type: 'image' | 'video') {
  const fd = new FormData()
  fd.set('projectId', projectId)
  fd.set('type', type)
  fd.set('file', blob, type === 'image' ? 'capture.jpg' : 'clip.webm')

  const res = await fetch('/api/camera/upload', {
    method: 'POST',
    body: fd,
  })
  const data = await readJson<MediaItem & { error?: string; detail?: string }>(res)
  if (!res.ok) throw new Error(data.error || data.detail || 'Upload failed')
  return data
}

function HlsPlayer({
  src,
  reloadKey,
  onDisconnect,
}: {
  src: string
  reloadKey: number
  onDisconnect: () => void
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const playerRef = useRef<Player | null>(null)

  useEffect(() => {
    if (!videoRef.current || !src) return

    const player = videojs(videoRef.current, {
      autoplay: true,
      controls: true,
      fluid: true,
      liveui: true,
      muted: true,
      preload: 'auto',
      sources: [{ src, type: 'application/x-mpegURL' }],
    })

    playerRef.current = player
    player.on('error', onDisconnect)

    return () => {
      player.off('error', onDisconnect)
      player.dispose()
      playerRef.current = null
    }
  }, [src, reloadKey, onDisconnect])

  return (
    <div data-vjs-player className="h-full w-full">
      <video ref={videoRef} className="video-js vjs-big-play-centered h-full w-full" playsInline />
    </div>
  )
}

export function ProjectCamera({
  projectId,
  initialEnabled = false,
  initialCameraType = 'device',
  onProjectCameraChange,
}: Props) {
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

  const [enabled, setEnabled] = useState(initialEnabled)
  const [source, setSource] = useState<'device' | 'external'>(initialCameraType)
  const [media, setMedia] = useState<MediaItem[]>([])
  const [externalCamera, setExternalCamera] = useState<ExternalCamera | null>(null)
  const [form, setForm] = useState<CameraForm>({
    name: '',
    ipAddress: '',
    port: '554',
    username: '',
    password: '',
    rtspPath: '/stream',
  })
  const [loadingList, setLoadingList] = useState(true)
  const [loadingCamera, setLoadingCamera] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [panelError, setPanelError] = useState<string | null>(null)
  const [recordElapsedMs, setRecordElapsedMs] = useState(0)
  const [playerReloadKey, setPlayerReloadKey] = useState(0)
  const [reconnectNotice, setReconnectNotice] = useState<string | null>(null)
  const reconnectTimerRef = useRef<number | null>(null)

  const generatedRtspPreview = useMemo(() => {
    const ip = form.ipAddress || 'camera-ip'
    const port = form.port || '554'
    const path = form.rtspPath.startsWith('/') ? form.rtspPath : `/${form.rtspPath || 'stream'}`
    return `rtsp://${form.username || 'username'}:password-hidden@${ip}:${port}${path}`
  }, [form.ipAddress, form.port, form.rtspPath, form.username])

  useEffect(() => {
    if (!isRecording) {
      setRecordElapsedMs(0)
      return
    }
    const start = Date.now()
    const t = window.setInterval(() => setRecordElapsedMs(Date.now() - start), 200)
    return () => window.clearInterval(t)
  }, [isRecording])

  const recordTime = new Date(recordElapsedMs).toISOString().slice(14, 19)

  const loadMedia = useCallback(async () => {
    if (!enabled) {
      setMedia([])
      setLoadingList(false)
      return
    }

    setLoadingList(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/camera`)
      if (res.ok) {
        const list = await readJson<MediaItem[]>(res)
        setMedia(Array.isArray(list) ? list : [])
      }
    } finally {
      setLoadingList(false)
    }
  }, [enabled, projectId])

  const loadExternalCamera = useCallback(async () => {
    setLoadingCamera(true)
    try {
      const res = await fetch(`/api/cameras?projectId=${encodeURIComponent(projectId)}`)
      if (!res.ok) return
      const camera = await readJson<ExternalCamera | null>(res)
      setExternalCamera(camera)
      if (camera) {
        setForm((current) => ({
          ...current,
          name: camera.name,
          ipAddress: camera.ipAddress,
          port: String(camera.port),
          username: camera.username,
          rtspPath: camera.rtspPath || '/stream',
          password: '',
        }))
      }
    } finally {
      setLoadingCamera(false)
    }
  }, [projectId])

  useEffect(() => {
    void loadMedia()
    void loadExternalCamera()
  }, [loadExternalCamera, loadMedia])

  useEffect(() => {
    if (!externalCamera?.id) return

    const timer = window.setInterval(async () => {
      const res = await fetch(`/api/cameras/${externalCamera.id}`)
      if (!res.ok) return
      const fresh = await readJson<ExternalCamera>(res)
      setExternalCamera(fresh)
    }, 5000)

    return () => window.clearInterval(timer)
  }, [externalCamera?.id])

  const updateForm = (key: keyof CameraForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const updateProjectCameraSettings = async (next: { hasCamera: boolean; cameraType: 'device' | 'external' }) => {
    setPanelError(null)
    setBusy('settings')
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      })
      const body = await readJson<{ hasCamera?: boolean; cameraType?: 'device' | 'external'; error?: string }>(res)
      if (!res.ok) throw new Error(body.error || 'Project camera settings could not be saved.')

      const saved: { hasCamera: boolean; cameraType: 'device' | 'external' } = {
        hasCamera: Boolean(body.hasCamera),
        cameraType: body.cameraType === 'external' ? 'external' : 'device',
      }

      setEnabled(saved.hasCamera)
      setSource(saved.cameraType)
      onProjectCameraChange?.(saved)
      setReconnectNotice(saved.hasCamera ? 'Project camera enabled.' : 'Project camera disabled.')
    } catch (e) {
      setPanelError(e instanceof Error ? e.message : 'Project camera settings could not be saved.')
    } finally {
      setBusy(null)
    }
  }

  const handleEnabledChange = (checked: boolean) => {
    void updateProjectCameraSettings({ hasCamera: checked, cameraType: source })
  }

  const handleSourceChange = (value: 'device' | 'external') => {
    setSource(value)
    if (enabled) {
      void updateProjectCameraSettings({ hasCamera: true, cameraType: value })
    }
  }

  const cameraPayload = () => ({
    projectId,
    name: form.name,
    ipAddress: form.ipAddress,
    port: Number(form.port || 554),
    username: form.username,
    password: form.password,
    rtspPath: form.rtspPath || '/stream',
  })

  const handleCapture = async () => {
    setPanelError(null)
    setBusy('capture')
    try {
      const blob = await captureImage()
      if (!blob) throw new Error('Could not read a frame from the camera.')
      const row = await uploadBlob(projectId, blob, 'image')
      setMedia((prev) => [row, ...prev])
    } catch (e) {
      setPanelError(e instanceof Error ? e.message : 'Capture failed')
    } finally {
      setBusy(null)
    }
  }

  const handleRecordToggle = async () => {
    if (!isRecording) {
      startRecording()
      return
    }
    setPanelError(null)
    setBusy('record')
    try {
      const blob = await stopRecording()
      if (!blob) throw new Error('No video captured.')
      const row = await uploadBlob(projectId, blob, 'video')
      setMedia((prev) => [row, ...prev])
    } catch (e) {
      setPanelError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setBusy(null)
    }
  }

  const testCamera = async () => {
    setPanelError(null)
    setBusy('test')
    try {
      const res = await fetch('/api/cameras/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cameraPayload()),
      })
      const body = await readJson<{ error?: string }>(res)
      if (!res.ok) throw new Error(body.error || 'Camera test failed.')
      setReconnectNotice('Camera responded successfully.')
    } catch (e) {
      setPanelError(e instanceof Error ? e.message : 'Camera test failed.')
    } finally {
      setBusy(null)
    }
  }

  const saveCamera = async () => {
    setPanelError(null)
    setBusy('save')
    try {
      const res = await fetch('/api/cameras', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cameraPayload()),
      })
      const body = await readJson<ExternalCamera & { error?: string }>(res)
      if (!res.ok) throw new Error(body.error || 'Camera could not be saved.')
      setExternalCamera(body)
      setForm((current) => ({ ...current, password: '' }))
      setEnabled(true)
      setSource('external')
      onProjectCameraChange?.({ hasCamera: true, cameraType: 'external' })
      setReconnectNotice('Camera saved.')
    } catch (e) {
      setPanelError(e instanceof Error ? e.message : 'Camera could not be saved.')
    } finally {
      setBusy(null)
    }
  }

  const startExternalStream = async () => {
    if (!externalCamera) return
    setPanelError(null)
    setBusy('start')
    try {
      const res = await fetch(`/api/cameras/${externalCamera.id}/start`, { method: 'POST' })
      const body = await readJson<{ streamUrl?: string; camera?: ExternalCamera; error?: string }>(res)
      if (!res.ok) throw new Error(body.error || 'Stream could not be started.')
      if (body.camera) setExternalCamera(body.camera)
      setPlayerReloadKey(Date.now())
    } catch (e) {
      setPanelError(e instanceof Error ? e.message : 'Stream could not be started.')
    } finally {
      setBusy(null)
    }
  }

  const stopExternalStream = async () => {
    if (!externalCamera) return
    setPanelError(null)
    setBusy('stop')
    try {
      const res = await fetch(`/api/cameras/${externalCamera.id}/stop`, { method: 'POST' })
      const body = await readJson<{ camera?: ExternalCamera; error?: string }>(res)
      if (!res.ok) throw new Error(body.error || 'Stream could not be stopped.')
      if (body.camera) setExternalCamera(body.camera)
    } catch (e) {
      setPanelError(e instanceof Error ? e.message : 'Stream could not be stopped.')
    } finally {
      setBusy(null)
    }
  }

  const captureExternalSnapshot = async () => {
    if (!externalCamera) return
    setPanelError(null)
    setBusy('snapshot')
    try {
      const res = await fetch(`/api/cameras/${externalCamera.id}/snapshot`, { method: 'POST' })
      const body = await readJson<MediaItem & { error?: string }>(res)
      if (!res.ok) throw new Error(body.error || 'Snapshot failed.')
      setMedia((prev) => [body, ...prev])
    } catch (e) {
      setPanelError(e instanceof Error ? e.message : 'Snapshot failed.')
    } finally {
      setBusy(null)
    }
  }

  const handlePlayerDisconnect = useCallback(() => {
    if (reconnectTimerRef.current) return
    setReconnectNotice('Stream interrupted. Reconnecting...')
    reconnectTimerRef.current = window.setTimeout(() => {
      setPlayerReloadKey(Date.now())
      reconnectTimerRef.current = null
    }, 1500)
  }, [])

  const status = externalCamera?.status || 'OFFLINE'
  const isOnline = status === 'ONLINE'

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
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-subtle)]">
            <Aperture className="h-5 w-5 text-[var(--accent)]" strokeWidth={2} />
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight text-[var(--text-primary)]">
              Project camera
            </h2>
            <p className="mt-0.5 max-w-xl text-sm text-[var(--text-muted)]">
              Use this browser camera or connect an external RTSP camera through the secure HLS bridge.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-xs font-semibold text-[var(--text-primary)]">
            <input
              type="checkbox"
              checked={enabled}
              disabled={busy === 'settings'}
              onChange={(event) => handleEnabledChange(event.target.checked)}
              className="accent-teal-600"
            />
            Enable Project Camera
            {busy === 'settings' && <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--text-muted)]" />}
          </label>

          <div className="inline-grid grid-cols-2 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)] p-1">
            {(['device', 'external'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => handleSourceChange(value)}
                className={`rounded-md px-3 py-2 text-xs font-semibold transition ${
                  source === value
                    ? 'bg-[var(--bg-card)] text-[var(--accent)] shadow-sm'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                {value === 'device' ? 'This device (browser)' : 'External IP camera'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!enabled && (
        <div className="mb-4 rounded-[var(--radius-sm)] border border-dashed border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2.5 text-sm text-[var(--text-muted)]">
          The camera panel is visible for setup. Enable Project Camera to capture browser media or start an external
          stream.
        </div>
      )}

      <AnimatePresence>
        {(error || panelError || reconnectNotice) && (
          <motion.div
            role="status"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="mb-4 rounded-[var(--radius-sm)] border px-3 py-2.5 text-sm"
            style={{
              background: error || panelError ? 'rgba(220, 38, 38, 0.06)' : 'rgba(5, 150, 105, 0.07)',
              borderColor: error || panelError ? 'rgba(220, 38, 38, 0.2)' : 'rgba(5, 150, 105, 0.2)',
              color: error || panelError ? '#b91c1c' : '#047857',
            }}
          >
            {error || panelError || reconnectNotice}{' '}
            <button
              type="button"
              className="ml-1 underline"
              onClick={() => {
                clearError()
                setPanelError(null)
                setReconnectNotice(null)
              }}
            >
              Dismiss
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {source === 'device' ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div>
            <div className="relative aspect-video w-full max-h-[420px] overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-neutral-900">
              <video ref={videoRef} className="relative z-0 h-full w-full object-cover" playsInline muted autoPlay />
              {!isActive && !isStarting && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--bg-elevated)]/95 px-4 text-center text-sm text-[var(--text-muted)]">
                  <div className="rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.06)]">
                    <div className="flex items-center gap-2">
                      <Camera className="h-4 w-4 text-[var(--accent)]" />
                      <span className="font-semibold text-[var(--text-primary)]">Camera ready</span>
                    </div>
                  </div>
                </div>
              )}
              {isStarting && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 text-sm font-medium text-white">
                  <span className="spinner mr-2" />
                  Starting camera...
                </div>
              )}
              {isRecording && (
                <div className="absolute left-3 top-3 z-10 inline-flex items-center gap-2 rounded-full border border-red-200/30 bg-red-50/70 px-3 py-1.5 text-xs font-semibold text-red-700 backdrop-blur">
                  <CircleDot className="h-3 w-3 fill-current" />
                  Recording <span className="tabular-nums">({recordTime})</span>
                </div>
              )}
              <div className="absolute bottom-3 left-1/2 z-20 w-[calc(100%-1.25rem)] -translate-x-1/2 md:w-[520px]">
                <CameraControls
                  className="w-full"
                  isActive={enabled && isActive}
                  isStarting={enabled && isStarting}
                  isRecording={isRecording}
                  uploading={busy === 'capture' || busy === 'record'}
                  onStart={() => {
                    if (!enabled) {
                      setPanelError('Enable Project Camera before starting browser capture.')
                      return
                    }
                    startCamera()
                  }}
                  onStop={stopCamera}
                  onCapture={handleCapture}
                  onRecordToggle={handleRecordToggle}
                />
              </div>
            </div>
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              Browser capture requires camera permission and HTTPS in production.
            </p>
          </div>
          <MediaGallery media={media} loadingList={loadingList} onRefresh={loadMedia} />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-4">
            <div className="relative aspect-video min-h-[220px] overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-neutral-950">
              {externalCamera?.streamUrl && (isOnline || status === 'STARTING') ? (
                <HlsPlayer
                  src={`${externalCamera.streamUrl}?v=${playerReloadKey}`}
                  reloadKey={playerReloadKey}
                  onDisconnect={handlePlayerDisconnect}
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-[linear-gradient(180deg,#07141d,#0b202d)] px-5 text-center">
                  <div>
                    <WifiOff className="mx-auto mb-3 h-8 w-8 text-slate-400" />
                    <div className="text-sm font-semibold text-white">External camera is offline</div>
                    <div className="mt-1 text-xs text-slate-400">
                      Enable the project camera, save a camera, test it, then start the HLS stream.
                    </div>
                  </div>
                </div>
              )}
              <div className="absolute left-3 top-3 z-10 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/45 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur">
                {isOnline ? <Wifi className="h-3.5 w-3.5 text-emerald-300" /> : <WifiOff className="h-3.5 w-3.5 text-slate-300" />}
                {status}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-primary gap-2 text-xs"
                onClick={startExternalStream}
                disabled={!enabled || !externalCamera || busy === 'start' || busy === 'stop'}
              >
                {busy === 'start' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                Start stream
              </button>
              <button
                type="button"
                className="btn-secondary gap-2 text-xs"
                onClick={stopExternalStream}
                disabled={!enabled || !externalCamera || busy === 'stop'}
              >
                {busy === 'stop' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />}
                Stop
              </button>
              <button
                type="button"
                className="btn-secondary gap-2 text-xs"
                onClick={captureExternalSnapshot}
                disabled={!enabled || !externalCamera || busy === 'snapshot'}
              >
                {busy === 'snapshot' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                Snapshot
              </button>
            </div>

            {externalCamera?.lastError && (
              <p className="rounded-[var(--radius-sm)] border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {externalCamera.lastError}
              </p>
            )}
          </div>

          <aside className="space-y-4">
            <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--text-muted)]">
                  External camera
                </h3>
                {loadingCamera && <Loader2 className="h-4 w-4 animate-spin text-[var(--text-muted)]" />}
              </div>

              <div className="grid gap-3">
                <LabeledInput label="Camera name" value={form.name} onChange={(value) => updateForm('name', value)} />
                <div className="grid grid-cols-[minmax(0,1fr)_96px] gap-2">
                  <LabeledInput label="IP address" value={form.ipAddress} onChange={(value) => updateForm('ipAddress', value)} />
                  <LabeledInput label="Port" value={form.port} onChange={(value) => updateForm('port', value)} inputMode="numeric" />
                </div>
                <LabeledInput label="Username" value={form.username} onChange={(value) => updateForm('username', value)} />
                <LabeledInput
                  label={externalCamera ? 'Password (required to update)' : 'Password'}
                  type="password"
                  value={form.password}
                  onChange={(value) => updateForm('password', value)}
                />
                <LabeledInput label="RTSP path" value={form.rtspPath} onChange={(value) => updateForm('rtspPath', value)} />

                <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2">
                  <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
                    Generated RTSP URL
                  </div>
                  <div className="break-all font-mono text-[11px] text-[var(--text-secondary)]">
                    {generatedRtspPreview}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className="btn-secondary gap-2 px-3 text-xs"
                    onClick={testCamera}
                    disabled={busy === 'test'}
                  >
                    {busy === 'test' ? <Loader2 className="h-4 w-4 animate-spin" /> : <TestTube2 className="h-4 w-4" />}
                    Test
                  </button>
                  <button
                    type="button"
                    className="btn-primary gap-2 px-3 text-xs"
                    onClick={saveCamera}
                    disabled={busy === 'save'}
                  >
                    {busy === 'save' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save
                  </button>
                </div>
              </div>
            </div>

            <MediaGallery media={media} loadingList={loadingList} onRefresh={loadMedia} compact />
          </aside>
        </div>
      )}
    </motion.section>
  )
}

function LabeledInput({
  label,
  value,
  onChange,
  type = 'text',
  inputMode,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  inputMode?: HTMLAttributes<HTMLInputElement>['inputMode']
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        {label}
      </span>
      <input
        className="input"
        type={type}
        inputMode={inputMode}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}

function MediaGallery({
  media,
  loadingList,
  onRefresh,
  compact = false,
}: {
  media: MediaItem[]
  loadingList: boolean
  onRefresh: () => void
  compact?: boolean
}) {
  return (
    <div>
      <div className="mb-2 flex items-end justify-between gap-3">
        <h3 className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--text-muted)]">Recent captures</h3>
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--accent)]"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loadingList ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <motion.div layout className={`${compact ? 'max-h-[260px]' : 'max-h-[min(420px,50vh)]'} space-y-2 overflow-y-auto pr-1`}>
        {loadingList && <p className="text-sm text-[var(--text-muted)]">Loading...</p>}
        {!loadingList && media.length === 0 && (
          <p className="rounded-[var(--radius-sm)] border border-dashed border-[var(--border)] p-4 text-center text-sm text-[var(--text-muted)]">
            No media yet.
          </p>
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
              <div className="relative h-12 w-12 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-card)]">
                {m.type === 'image' ? (
                  <Image
                    src={m.fileUrl}
                    alt="Camera capture"
                    fill
                    sizes="48px"
                    unoptimized
                    className="object-cover transition duration-200 group-hover:brightness-[1.08]"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-[var(--accent-subtle)]">
                    <Video className="h-4 w-4 text-[var(--accent)]" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="truncate text-xs font-semibold capitalize text-[var(--text-primary)]">{m.type}</div>
                  <span className="shrink-0 rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
                    Open
                  </span>
                </div>
                <div className="mt-0.5 text-[10px] text-[var(--text-muted)]">
                  {new Date(m.createdAt).toLocaleString()}
                </div>
              </div>
            </motion.a>
          ))}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}

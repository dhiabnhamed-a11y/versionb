'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const recordChunksRef = useRef<Blob[]>([])

  const [isActive, setIsActive] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const attachStream = useCallback((stream: MediaStream) => {
    streamRef.current = stream
    const el = videoRef.current
    if (el) {
      el.srcObject = stream
      void el.play().catch(() => {})
    }
  }, [])

  const startCamera = useCallback(async () => {
    setError(null)
    setIsStarting(true)
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Camera is not supported in this browser.')
        setIsActive(false)
        return
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      })
      attachStream(stream)
      setIsActive(true)
    } catch (e: unknown) {
      const err = e as { name?: string }
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Permission denied. Allow camera (and microphone for video) in your browser settings.')
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setError('No camera was found on this device.')
      } else {
        setError('Could not start the camera.')
      }
      setIsActive(false)
    } finally {
      setIsStarting(false)
    }
  }, [attachStream])

  const stopCamera = useCallback(() => {
    const rec = recorderRef.current
    if (rec && rec.state === 'recording') {
      rec.stop()
    }
    recorderRef.current = null
    setIsRecording(false)
    recordChunksRef.current = []

    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    const el = videoRef.current
    if (el) el.srcObject = null
    setIsActive(false)
    setIsStarting(false)
  }, [])

  useEffect(() => () => stopCamera(), [stopCamera])

  const captureImage = useCallback(async (): Promise<Blob | null> => {
    const video = videoRef.current
    if (!video || !streamRef.current) return null
    const w = video.videoWidth
    const h = video.videoHeight
    if (!w || !h) return null
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(video, 0, 0, w, h)
    return new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.92)
    })
  }, [])

  const startRecording = useCallback(() => {
    const stream = streamRef.current
    if (!stream || isRecording) return

    let options: MediaRecorderOptions | undefined
    for (const mimeType of ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']) {
      if (MediaRecorder.isTypeSupported(mimeType)) {
        options = { mimeType }
        break
      }
    }

    recordChunksRef.current = []
    try {
      const rec = options ? new MediaRecorder(stream, options) : new MediaRecorder(stream)
      recorderRef.current = rec
      rec.ondataavailable = (ev) => {
        if (ev.data.size) recordChunksRef.current.push(ev.data)
      }
      rec.start(250)
      setIsRecording(true)
      setError(null)
    } catch {
      setError('Could not start recording.')
    }
  }, [isRecording])

  const stopRecording = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const rec = recorderRef.current
      if (!rec || rec.state !== 'recording') {
        resolve(null)
        return
      }
      rec.onstop = () => {
        const chunks = recordChunksRef.current
        const blob = new Blob(chunks, { type: chunks[0]?.type || 'video/webm' })
        recordChunksRef.current = []
        recorderRef.current = null
        setIsRecording(false)
        resolve(blob.size ? blob : null)
      }
      rec.stop()
    })
  }, [])

  return {
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
    clearError: () => setError(null),
  }
}

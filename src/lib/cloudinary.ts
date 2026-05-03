import { createReadStream } from 'fs'
import { v2 as cloudinary, type UploadApiOptions, type UploadApiResponse } from 'cloudinary'

export type AgencyMediaType = 'image' | 'video' | 'audio'

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'])
const VIDEO_TYPES = new Set(['video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska'])
const AUDIO_TYPES = new Set(['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/aac', 'audio/mp4', 'audio/webm'])

export const AGENCY_MEDIA_LIMITS = {
  image: 25 * 1024 * 1024,
  audio: 75 * 1024 * 1024,
  video: 250 * 1024 * 1024,
  standardUpload: 25 * 1024 * 1024,
  chunk: 8 * 1024 * 1024,
} as const

let configured = false

export function configureCloudinary() {
  if (configured) return

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME
  const apiKey = process.env.CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.')
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  })
  configured = true
}

export function getAgencyMediaType(mimeType: string): AgencyMediaType | null {
  const normalized = mimeType.toLowerCase()
  if (IMAGE_TYPES.has(normalized)) return 'image'
  if (VIDEO_TYPES.has(normalized)) return 'video'
  if (AUDIO_TYPES.has(normalized)) return 'audio'
  return null
}

export function validateAgencyMediaFile(input: { mimeType: string; size: number }) {
  const type = getAgencyMediaType(input.mimeType)
  if (!type) {
    return { ok: false as const, error: 'Unsupported file type. Upload images, videos, or audio files only.' }
  }

  const maxSize = AGENCY_MEDIA_LIMITS[type]
  if (input.size <= 0) {
    return { ok: false as const, error: 'Empty files cannot be uploaded.' }
  }
  if (input.size > maxSize) {
    return {
      ok: false as const,
      error: `${type[0].toUpperCase()}${type.slice(1)} files must be ${formatBytes(maxSize)} or smaller.`,
    }
  }

  return { ok: true as const, type }
}

export function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)}KB`
  return `${Math.ceil(bytes / 1024 / 1024)}MB`
}

function folderFor(companyId: string, projectId: string) {
  return `tasked/digital-agency/${companyId}/projects/${projectId}`
}

function uploadOptions(input: {
  companyId: string
  projectId: string
  type: AgencyMediaType
  fileName: string
}): UploadApiOptions {
  const base: UploadApiOptions = {
    folder: folderFor(input.companyId, input.projectId),
    use_filename: true,
    unique_filename: true,
    overwrite: false,
    context: {
      app: 'tasked',
      project_id: input.projectId,
      original_filename: input.fileName,
      media_type: input.type,
    },
  }

  if (input.type === 'image') {
    return {
      ...base,
      resource_type: 'image',
      quality_analysis: true,
      eager: [
        { width: 1200, crop: 'limit', quality: 'auto', fetch_format: 'auto' },
        { width: 480, height: 320, crop: 'fill', gravity: 'auto', quality: 'auto', fetch_format: 'auto' },
      ],
    }
  }

  return {
    ...base,
    resource_type: 'video',
    eager_async: false,
    eager: input.type === 'video'
      ? [
          { streaming_profile: 'auto', format: 'm3u8' },
          { width: 1280, crop: 'limit', quality: 'auto', fetch_format: 'auto' },
          { width: 640, height: 360, crop: 'fill', gravity: 'auto', format: 'jpg' },
        ]
      : [{ quality: 'auto', fetch_format: 'mp3' }],
  }
}

export async function uploadAgencyMediaBuffer(input: {
  buffer: Buffer
  companyId: string
  projectId: string
  type: AgencyMediaType
  fileName: string
}) {
  configureCloudinary()

  return new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      uploadOptions(input),
      (error, result) => (error || !result ? reject(error ?? new Error('Cloudinary upload failed.')) : resolve(result))
    )
    stream.end(input.buffer)
  })
}

export async function uploadAgencyMediaFile(input: {
  filePath: string
  companyId: string
  projectId: string
  type: AgencyMediaType
  fileName: string
}) {
  configureCloudinary()

  return new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      uploadOptions(input),
      (error, result) => (error || !result ? reject(error ?? new Error('Cloudinary upload failed.')) : resolve(result))
    )
    createReadStream(input.filePath).pipe(stream)
  })
}

export function getCloudinaryDeliveryUrls(result: UploadApiResponse, type: AgencyMediaType) {
  const publicId = result.public_id
  if (type === 'image') {
    return {
      url: cloudinary.url(publicId, {
        secure: true,
        resource_type: 'image',
        transformation: [{ width: 1600, crop: 'limit', quality: 'auto', fetch_format: 'auto' }],
      }),
      thumbnailUrl: cloudinary.url(publicId, {
        secure: true,
        resource_type: 'image',
        transformation: [{ width: 520, height: 340, crop: 'fill', gravity: 'auto', quality: 'auto', fetch_format: 'auto' }],
      }),
      playbackUrl: null,
    }
  }

  if (type === 'video') {
    return {
      url: result.secure_url,
      thumbnailUrl: cloudinary.url(publicId, {
        secure: true,
        resource_type: 'video',
        format: 'jpg',
        transformation: [{ width: 640, height: 360, crop: 'fill', gravity: 'auto', quality: 'auto' }],
      }),
      playbackUrl: cloudinary.url(publicId, {
        secure: true,
        resource_type: 'video',
        format: 'm3u8',
        streaming_profile: 'auto',
      }),
    }
  }

  return {
    url: result.secure_url,
    thumbnailUrl: null,
    playbackUrl: result.secure_url,
  }
}


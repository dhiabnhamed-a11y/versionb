const IMAGE_MAGIC: Array<{ mime: string; bytes: number[] }> = [
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: 'image/webp', bytes: [0x52, 0x49, 0x46, 0x46] },
]

export function detectImageMime(buffer: Buffer) {
  for (const candidate of IMAGE_MAGIC) {
    if (candidate.bytes.every((byte, index) => buffer[index] === byte)) return candidate.mime
  }
  return null
}

export function assertUploadSize(buffer: Buffer, maxBytes: number) {
  if (buffer.length > maxBytes) {
    throw {
      code: 'UPLOAD_TOO_LARGE',
      expose: true,
      message: 'File exceeds allowed size.',
      status: 413,
    }
  }
}

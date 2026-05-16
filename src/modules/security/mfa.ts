import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'crypto'

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

function base32Encode(buffer: Buffer) {
  let bits = ''
  for (const byte of buffer) bits += byte.toString(2).padStart(8, '0')

  let output = ''
  for (let index = 0; index < bits.length; index += 5) {
    const chunk = bits.slice(index, index + 5).padEnd(5, '0')
    output += BASE32_ALPHABET[Number.parseInt(chunk, 2)]
  }

  return output
}

function base32Decode(value: string) {
  const clean = value.replace(/=+$/g, '').replace(/\s+/g, '').toUpperCase()
  let bits = ''
  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char)
    if (index < 0) throw new Error('Invalid base32 secret.')
    bits += index.toString(2).padStart(5, '0')
  }

  const bytes: number[] = []
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2))
  }

  return Buffer.from(bytes)
}

function hotp(secret: string, counter: number, digits = 6) {
  const key = base32Decode(secret)
  const buffer = Buffer.alloc(8)
  buffer.writeBigUInt64BE(BigInt(counter))
  const hmac = createHmac('sha1', key).update(buffer).digest()
  const offset = hmac[hmac.length - 1] & 0x0f
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)

  return String(code % 10 ** digits).padStart(digits, '0')
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  return a.length === b.length && timingSafeEqual(a, b)
}

export function generateTotpSecret(bytes = 20) {
  return base32Encode(randomBytes(bytes))
}

export function getTotpCode(secret: string, now = Date.now(), periodSeconds = 30) {
  return hotp(secret, Math.floor(now / 1000 / periodSeconds))
}

export function verifyTotpCode(input: { code: string; secret: string; now?: number; periodSeconds?: number; window?: number }) {
  const normalizedCode = input.code.trim()
  const periodSeconds = input.periodSeconds ?? 30
  const window = input.window ?? 1
  const currentCounter = Math.floor((input.now ?? Date.now()) / 1000 / periodSeconds)

  for (let offset = -window; offset <= window; offset += 1) {
    if (safeEqual(normalizedCode, hotp(input.secret, currentCounter + offset))) return true
  }

  return false
}

export function buildTotpUri(input: { accountName: string; issuer?: string; secret: string }) {
  const issuer = input.issuer ?? 'TASKIT'
  const label = encodeURIComponent(`${issuer}:${input.accountName}`)
  const params = new URLSearchParams({
    issuer,
    secret: input.secret,
    algorithm: 'SHA1',
    digits: '6',
    period: '30',
  })

  return `otpauth://totp/${label}?${params.toString()}`
}

export function generateRecoveryCodes(count = 10) {
  return Array.from({ length: count }, () => `${randomInt(1000, 9999)}-${randomInt(1000, 9999)}-${randomInt(1000, 9999)}`)
}

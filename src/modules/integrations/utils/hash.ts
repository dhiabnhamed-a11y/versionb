import { createHash } from 'crypto'

export function stableHash(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

export function base64UrlEncode(input: Buffer | string) {
  return Buffer.from(input).toString('base64url')
}

export function base64UrlDecode(input: string) {
  return Buffer.from(input, 'base64url').toString('utf8')
}

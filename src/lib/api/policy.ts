import { forbidden } from '@/modules/shared/errors'

export function assertAllowed(condition: unknown, message = 'Forbidden') {
  if (!condition) throw forbidden(message)
}

export async function assertAllowedAsync(check: Promise<unknown>, message = 'Forbidden') {
  assertAllowed(await check, message)
}

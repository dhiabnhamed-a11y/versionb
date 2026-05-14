import { z } from 'zod'
import { badRequest } from '@/modules/shared/errors'

export async function parseJsonObject(req: Request) {
  const body = await req.json().catch(() => ({}))
  return body && typeof body === 'object' ? body : {}
}

export function validateWithSchema<TSchema extends z.ZodType>(schema: TSchema, value: unknown): z.infer<TSchema> {
  const parsed = schema.safeParse(value)
  if (!parsed.success) {
    throw badRequest('Invalid request payload.', parsed.error.flatten())
  }

  return parsed.data
}

export async function validateJson<TSchema extends z.ZodType>(req: Request, schema: TSchema): Promise<z.infer<TSchema>> {
  return validateWithSchema(schema, await parseJsonObject(req))
}

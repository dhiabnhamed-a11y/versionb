import { z } from 'zod'

export function isValidProjectId(id: unknown) {
  return typeof id === 'string' && id.length >= 8 && id.length <= 128 && /^[a-zA-Z0-9_-]+$/.test(id)
}

const trimmedNonEmpty = z.string().trim().min(1)
const optionalNullableString = z.string().trim().nullable().optional()
const optionalString = z.string().trim().min(1).optional()
const cameraType = z.enum(['device', 'external']).optional()

export const createProjectSchema = z.object({
  title: trimmedNonEmpty.max(255),
  description: optionalNullableString,
  managerId: optionalString.nullable(),
  roomId: optionalString.nullable(),
  categoryId: optionalString.nullable(),
  clientId: optionalString.nullable(),
  clientName: optionalNullableString,
  hasCamera: z.boolean().optional(),
  cameraType,
})

export type CreateProjectInput = z.infer<typeof createProjectSchema>

export const updateProjectSchema = z.object({
  title: trimmedNonEmpty.max(255).optional(),
  description: optionalNullableString,
  managerId: optionalNullableString,
  roomId: optionalNullableString,
  categoryId: optionalNullableString,
  clientId: optionalNullableString,
  clientName: optionalNullableString,
  hasCamera: z.boolean().optional(),
  cameraType,
})

export type UpdateProjectInput = z.infer<typeof updateProjectSchema>

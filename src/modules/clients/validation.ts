import { z } from 'zod'

const optionalText = z.union([z.string(), z.null(), z.undefined()])

export const clientStatusSchema = z.union([z.literal('active'), z.literal('inactive')]).optional()

export const clientCreateSchema = z.object({
  companyName: z.string().trim().min(1, 'Company name is required.'),
  contactPerson: optionalText,
  email: optionalText,
  phone: optionalText,
  country: optionalText,
  address: optionalText,
  notes: optionalText,
  avatarUrl: optionalText,
  status: clientStatusSchema,
})

export const clientPatchSchema = clientCreateSchema.partial().refine((value) => Object.keys(value).length > 0, {
  message: 'At least one client field is required.',
})

export type ClientCreateInput = z.infer<typeof clientCreateSchema>
export type ClientPatchInput = z.infer<typeof clientPatchSchema>

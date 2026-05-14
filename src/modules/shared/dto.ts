import { z } from 'zod'

export const paginationDtoSchema = z.object({
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  total: z.number().int().min(0),
  pageCount: z.number().int().min(0),
})

export const apiErrorDtoSchema = z.object({
  data: z.null(),
  error: z.string(),
  code: z.string(),
  requestId: z.string(),
  pagination: paginationDtoSchema.optional(),
  details: z.unknown().optional(),
})

export function apiResponseDtoSchema<TSchema extends z.ZodType>(dataSchema: TSchema) {
  return z.object({
    data: dataSchema.nullable(),
    error: z.string().nullable(),
    code: z.string().nullable(),
    requestId: z.string(),
    pagination: paginationDtoSchema.optional(),
  })
}

export type PaginationDto = z.infer<typeof paginationDtoSchema>
export type ApiErrorDto = z.infer<typeof apiErrorDtoSchema>

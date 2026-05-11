import { z } from 'zod'

const nullableText = z.preprocess((value) => (value === '' ? null : value), z.string().nullable().optional())
const optionalText = z.preprocess((value) => (value === '' ? undefined : value), z.string().optional())

export const invoiceItemSchema = z.object({
  description: z.unknown().optional(),
  quantity: z.unknown().optional(),
  unitPrice: z.unknown().optional(),
})

export const createInvoiceSchema = z.object({
  clientId: optionalText,
  campaignId: optionalText,
  briefId: optionalText,
  clientName: optionalText,
  clientEmail: optionalText,
  clientAddress: optionalText,
  status: optionalText,
  currency: optionalText,
  locale: optionalText,
  issueDate: optionalText,
  dueDate: optionalText,
  notes: optionalText,
  taxRate: z.unknown().optional(),
  items: z.array(invoiceItemSchema).optional().default([]),
})

export const updateInvoiceSchema = z.object({
  clientId: nullableText,
  campaignId: nullableText,
  briefId: nullableText,
  clientName: optionalText,
  clientEmail: nullableText,
  clientAddress: nullableText,
  status: optionalText,
  currency: optionalText,
  locale: optionalText,
  issueDate: optionalText,
  dueDate: nullableText,
  notes: nullableText,
  taxRate: z.unknown().optional(),
  items: z.array(invoiceItemSchema).optional(),
})

export const deleteInvoiceSchema = z.object({
  confirmation: z.unknown().optional(),
})

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>
export type DeleteInvoiceInput = z.infer<typeof deleteInvoiceSchema>

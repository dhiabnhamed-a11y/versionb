import { z } from 'zod'

const optionalText = z.preprocess((value) => (value === '' ? undefined : value), z.string().optional())
const nullableText = z.preprocess((value) => (value === '' ? null : value), z.string().nullable().optional())

export const createTaskSchema = z.object({
  title: z.string().trim().min(1, 'Task title is required.'),
  description: optionalText,
  priority: optionalText,
  deliverableType: optionalText,
  deliverableId: optionalText,
  dependencyIds: z.array(z.string()).optional().default([]),
  deadline: optionalText,
  assigneeId: optionalText,
  projectId: optionalText,
  enterpriseAssignedTeamId: nullableText,
  enterpriseDepartmentId: nullableText,
})

export const updateTaskSchema = z.object({
  stage: optionalText,
  title: optionalText,
  description: nullableText,
  priority: optionalText,
  deliverableType: optionalText,
  deliverableId: optionalText,
  dependencyIds: z.array(z.string()).optional(),
  deadline: nullableText,
  assigneeId: nullableText,
  projectId: optionalText,
  reviewComment: optionalText,
  enterpriseAssignedTeamId: nullableText,
  enterpriseDepartmentId: nullableText,
})

export type CreateTaskInput = z.infer<typeof createTaskSchema>
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>

import { Prisma } from '@prisma/client'
import { enterpriseRepositoryPrisma, enterpriseRepositoryTransaction } from '@/modules/enterprise/enterprise.repository'
import { publishDomainEvent } from '@/modules/events/event-bus'
import { logger } from '@/modules/shared/logger'

function computeNextRun(input: {
  frequency: string
  intervalValue: number
  lastRunAt: Date | null
  dayOfWeek?: number | null
  dayOfMonth?: number | null
}): Date {
  const base = input.lastRunAt || new Date()
  const next = new Date(base)

  switch (input.frequency) {
    case 'DAILY':
      next.setDate(next.getDate() + input.intervalValue)
      break
    case 'WEEKLY': {
      next.setDate(next.getDate() + input.intervalValue * 7)
      if (input.dayOfWeek != null) {
        while (next.getDay() !== input.dayOfWeek) next.setDate(next.getDate() + 1)
      }
      break
    }
    case 'MONTHLY': {
      next.setMonth(next.getMonth() + input.intervalValue)
      if (input.dayOfMonth != null) {
        next.setDate(Math.min(input.dayOfMonth, new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()))
      }
      break
    }
    case 'QUARTERLY':
      next.setMonth(next.getMonth() + input.intervalValue * 3)
      break
    case 'YEARLY':
      next.setFullYear(next.getFullYear() + input.intervalValue)
      break
  }

  if (next <= new Date()) {
    next.setDate(next.getDate() + 1)
  }

  return next
}

export async function generateRecurringTickets(): Promise<{ generated: number }> {
  const now = new Date()
  let generated = 0

  const dueTickets = await enterpriseRepositoryPrisma.enterpriseRecurringTicket.findMany({
    where: {
      isActive: true,
      nextRunAt: { lte: now },
      AND: [
        ...(false as any ? [] : []), // placeholder for maxRuns check
      ],
    },
  })

  const filtered = dueTickets.filter((t) => !t.maxRuns || t.runCount < t.maxRuns)

  for (const template of filtered) {
    try {
      await enterpriseRepositoryTransaction(async (tx) => {
        const lastSequence = await tx.enterpriseIncident.count({
          where: { companyId: template.companyId },
        })

        const incident = await tx.enterpriseIncident.create({
          data: {
            companyId: template.companyId,
            incidentNumber: `REC-${String(lastSequence + 1).padStart(6, '0')}`,
            title: template.title,
            description: template.description || `Auto-generated from recurring ticket template`,
            type: template.type,
            priority: template.priority,
            status: 'OPEN',
            source: 'RECURRING',
            assignedTeamId: template.assignedTeamId,
            assignedToId: template.assignedToId,
            metadata: {
              recurringTicketId: template.id,
              generatedAt: now.toISOString(),
            } as Prisma.InputJsonValue,
          },
        })

        await tx.enterpriseRecurringTicket.update({
          where: { id: template.id },
          data: {
            lastRunAt: now,
            runCount: { increment: 1 },
            nextRunAt: computeNextRun({
              frequency: template.frequency,
              intervalValue: template.intervalValue,
              lastRunAt: now,
              dayOfWeek: template.dayOfWeek,
              dayOfMonth: template.dayOfMonth,
            }),
          },
        })

        await publishDomainEvent({
          type: 'enterprise.incident.created',
          companyId: template.companyId,
          actorId: null,
          entityType: 'enterprise_incident',
          entityId: incident.id,
          action: 'Recurring ticket generated',
          payload: { incident, templateId: template.id },
        })
      })

      generated++
    } catch (err) {
      logger.error('enterprise.recurring_generation_error', err, { templateId: template.id })
    }
  }

  logger.info('enterprise.recurring_tickets_run', { checked: dueTickets.length, generated })
  return { generated }
}

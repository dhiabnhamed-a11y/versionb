import { Worker, Queue } from 'bullmq'
import { prisma } from '@/lib/db'
import { getRedisConnection } from '@/lib/redis'
import { FieldMappingService } from '@/lib/ems/integration'
import { IntegrationRegistry } from '@/lib/ems/integration'

const connection = getRedisConnection()

const webhookWorker = new Worker('ems:webhook-processing', async (job) => {
  const { eventId, companyId, integrationId, webhookConfigId, entityType } = job.data

  await prisma.emsIntegrationEvent.update({
    where: { id: eventId },
    data: { status: 'processing' },
  })

  try {
    const event = await prisma.emsIntegrationEvent.findUnique({ where: { id: eventId } })
    if (!event || !event.rawPayload) throw new Error('Event not found or empty')

    const mappingService = new FieldMappingService(companyId, integrationId)
    const registry = IntegrationRegistry.getInstance()
    const connector = registry.getConnector(integrationId)

    if (connector) {
      const syncResult = await connector.sync(entityType || 'incidents')
      if (event.rawPayload) {
        const data = Array.isArray(event.rawPayload) ? event.rawPayload[0] : event.rawPayload
        const transformed = await mappingService.applyMappings(entityType || 'unknown', data as Record<string, unknown>)
        await prisma.emsIntegrationEvent.update({
          where: { id: eventId },
          data: {
            transformedPayload: transformed as any,
            status: 'completed',
            processedAt: new Date(),
            processingTimeMs: Date.now() - new Date(event.receivedAt).getTime(),
          },
        })
      }
    } else {
      // No connector - just mark complete
      await prisma.emsIntegrationEvent.update({
        where: { id: eventId },
        data: { status: 'completed', processedAt: new Date() },
      })
    }
  } catch (err) {
    await prisma.emsIntegrationEvent.update({
      where: { id: eventId },
      data: {
        status: 'failed',
        errorMessage: err instanceof Error ? err.message : 'Processing failed',
        processedAt: new Date(),
        retryCount: { increment: 1 },
      },
    })
    throw err // BullMQ will retry
  }
}, {
  connection,
  concurrency: 5,
  lockDuration: 30000,
})

const syncWorker = new Worker('ems:sync', async (job) => {
  const { integrationId, entityType, params } = job.data

  const registry = IntegrationRegistry.getInstance()
  const connector = registry.getConnector(integrationId)
  if (!connector) throw new Error('Connector not found')

  return connector.sync(entityType, params)
}, {
  connection,
  concurrency: 3,
  lockDuration: 60000,
})

webhookWorker.on('completed', (job) => {
  console.log(`Webhook job ${job.id} completed`)
})

webhookWorker.on('failed', (job, err) => {
  console.error(`Webhook job ${job?.id} failed:`, err.message)
})

syncWorker.on('completed', (job) => {
  console.log(`Sync job ${job.id} completed`)
})

syncWorker.on('failed', (job, err) => {
  console.error(`Sync job ${job?.id} failed:`, err.message)
})

export function startIntegrationWorkers() {
  return { webhookWorker, syncWorker }
}

export async function stopIntegrationWorkers() {
  await webhookWorker.close()
  await syncWorker.close()
}

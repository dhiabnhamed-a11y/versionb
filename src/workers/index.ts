import 'dotenv/config'
import { startBackgroundJobWorkers } from '@/modules/jobs/job-worker'
import { startRealtimeDeliveryWorker } from '@/modules/realtime/events/worker'
import { keepWorkerAlive, installWorkerShutdown } from '@/workers/runtime'

const realtimeWorker = startRealtimeDeliveryWorker()
await startBackgroundJobWorkers()

installWorkerShutdown('all', [realtimeWorker])
keepWorkerAlive('all')

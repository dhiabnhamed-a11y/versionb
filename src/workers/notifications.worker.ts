import 'dotenv/config'
import { startBackgroundJobWorkers } from '@/modules/jobs/job-worker'
import { keepWorkerAlive, installWorkerShutdown } from '@/workers/runtime'

const started = await startBackgroundJobWorkers()
installWorkerShutdown('notifications', [])
keepWorkerAlive(started ? 'notifications' : 'notifications-disabled')

import 'dotenv/config'
import { startRealtimeDeliveryWorker } from '@/modules/realtime/events/worker'
import { keepWorkerAlive, installWorkerShutdown } from '@/workers/runtime'

const worker = startRealtimeDeliveryWorker()
installWorkerShutdown('realtime', [worker])
keepWorkerAlive('realtime')

import { logger } from '@/modules/shared/logger'

type CloseableWorker = {
  close: () => Promise<unknown>
}

export function installWorkerShutdown(workerName: string, workers: Array<CloseableWorker | null>) {
  const shutdown = async (signal: string) => {
    logger.info('worker.shutdown_started', { workerName, signal })
    await Promise.allSettled(workers.filter((worker): worker is CloseableWorker => Boolean(worker)).map((worker) => worker.close()))
    logger.info('worker.shutdown_completed', { workerName, signal })
    process.exit(0)
  }

  process.once('SIGTERM', () => void shutdown('SIGTERM'))
  process.once('SIGINT', () => void shutdown('SIGINT'))
}

export function keepWorkerAlive(workerName: string) {
  logger.info('worker.runtime_ready', { workerName, pid: process.pid })
}

import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { StatsReportDocument } from '@/lib/StatsReportDocument'
import type { WorkspaceStatsExport } from '@/lib/settings'

const PDF_SIGNATURE = '%PDF-'

type StatsPdfContext = {
  requestId?: string
  companyId?: string
  startedAt?: number
}

function errorDetails(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      code: 'code' in error ? error.code : undefined,
      stack: error.stack,
    }
  }

  return { message: String(error) }
}

function logStatsPdfEvent(level: 'info' | 'warn' | 'error', event: string, context: StatsPdfContext, meta: Record<string, unknown> = {}) {
  const payload = {
    scope: 'stats-pdf-renderer',
    renderer: '@react-pdf/renderer',
    event,
    requestId: context.requestId,
    companyId: context.companyId,
    durationMs: context.startedAt ? Date.now() - context.startedAt : undefined,
    ...meta,
  }

  if (level === 'error') console.error('[stats-pdf-renderer]', payload)
  else if (level === 'warn') console.warn('[stats-pdf-renderer]', payload)
  else console.info('[stats-pdf-renderer]', payload)
}

function assertPdfBuffer(pdf: Uint8Array) {
  const signature = Buffer.from(pdf.slice(0, 5)).toString('ascii')
  if (pdf.byteLength < 5 || signature !== PDF_SIGNATURE) {
    throw new Error(`Stats PDF renderer returned invalid output. byteLength=${pdf.byteLength} signature=${signature}`)
  }
}

export async function generateStatsPdf(data: WorkspaceStatsExport, context: StatsPdfContext = {}) {
  const logContext = {
    ...context,
    startedAt: context.startedAt ?? Date.now(),
  }

  try {
    logStatsPdfEvent('info', 'pdf-render-started', logContext, {
      projects: data.summary.totalProjects,
      tasks: data.summary.totalTasks,
      invoices: data.billing.invoiceCount,
    })
    const document = createElement(StatsReportDocument, { data }) as unknown as Parameters<typeof renderToBuffer>[0]
    const pdf = await renderToBuffer(document)
    assertPdfBuffer(pdf)
    logStatsPdfEvent('info', 'pdf-render-completed', logContext, { byteLength: pdf.byteLength })
    return pdf
  } catch (error) {
    logStatsPdfEvent('error', 'pdf-render-failed', logContext, { error: errorDetails(error) })
    throw error
  }
}

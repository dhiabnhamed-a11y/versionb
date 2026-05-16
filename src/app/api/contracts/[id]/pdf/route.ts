import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { generateContractPdf } from '@/lib/contract-pdf'
import { getContractVersionContent, recordContractDownload } from '@/modules/contracts/contract.service'
import type { SessionUser } from '@/modules/shared/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

type RouteCtx = {
  params: Promise<{ id?: string }>
}

const PDF_SIGNATURE = '%PDF-'

function requestId() {
  return globalThis.crypto?.randomUUID?.() ?? `contract_pdf_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

function jsonHeaders(reqId: string) {
  return {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    Pragma: 'no-cache',
    Expires: '0',
    'X-Request-Id': reqId,
    'Access-Control-Expose-Headers': 'X-Request-Id',
  }
}

function jsonError(message: string, status: number, reqId: string) {
  return NextResponse.json({ error: message, requestId: reqId }, { status, headers: jsonHeaders(reqId) })
}

function assertPdf(pdf: Uint8Array) {
  const signature = Buffer.from(pdf.slice(0, 5)).toString('ascii')
  if (pdf.byteLength < 5 || signature !== PDF_SIGNATURE) {
    throw new Error(`PDF renderer returned invalid output. byteLength=${pdf.byteLength} signature=${signature}`)
  }
}

function asciiFilename(value: string) {
  const base = value.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^_+|_+$/g, '') || 'contract'
  return base.slice(0, 120)
}

function encodeRfc5987(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)
}

function pdfHeaders(contractNumber: string, byteLength: number) {
  const asciiName = `${asciiFilename(contractNumber)}.pdf`
  const utf8Name = `${contractNumber.replace(/[\\/:*?"<>|]+/g, '_').slice(0, 120) || 'contract'}.pdf`

  return {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeRfc5987(utf8Name)}`,
    'Content-Length': String(byteLength),
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    Pragma: 'no-cache',
    Expires: '0',
    'X-Content-Type-Options': 'nosniff',
    'Access-Control-Expose-Headers': 'Content-Disposition, Content-Length, X-Request-Id',
  }
}

function pdfResponse(pdf: Uint8Array, contractNumber: string, reqId: string) {
  assertPdf(pdf)
  const body = new ArrayBuffer(pdf.byteLength)
  new Uint8Array(body).set(pdf)

  return new Response(body, {
    status: 200,
    headers: {
      ...pdfHeaders(contractNumber, pdf.byteLength),
      'X-Request-Id': reqId,
    },
  })
}

async function routeParams(context: RouteCtx) {
  try {
    const params = await context.params
    return typeof params?.id === 'string' ? params.id.trim() : ''
  } catch {
    return ''
  }
}

function log(level: 'info' | 'warn' | 'error', message: string, meta: Record<string, unknown>) {
  const payload = { scope: 'contract-pdf-route', ...meta }
  if (level === 'error') console.error(message, payload)
  else if (level === 'warn') console.warn(message, payload)
  else console.info(message, payload)
}

function errorDetails(error: unknown) {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack }
  }
  return { message: String(error) }
}

export async function GET(req: NextRequest, context: RouteCtx) {
  const reqId = requestId()
  const startedAt = Date.now()
  let contractId = ''
  let phase = 'route-params'

  try {
    contractId = await routeParams(context)
    if (!contractId) return jsonError('Contract id is required.', 400, reqId)

    phase = 'auth'
    const session = await auth()
    if (!session) return jsonError('Unauthorized', 401, reqId)

    phase = 'load-contract'
    const versionId = req.nextUrl.searchParams.get('versionId')
    const user = session.user as SessionUser
    const { contract, version, content } = await getContractVersionContent(user, contractId, versionId)

    phase = 'generate-pdf'
    const pdf = await generateContractPdf(content, {
      requestId: reqId,
      contractId,
      versionId: version.id,
      contractNumber: contract.contractNumber,
      startedAt,
    })

    phase = 'audit'
    await recordContractDownload(user, {
      contractId,
      versionId: version.id,
      requestId: reqId,
      byteLength: pdf.byteLength,
    })

    log('info', 'Contract PDF request completed.', {
      requestId: reqId,
      contractId,
      versionId: version.id,
      byteLength: pdf.byteLength,
      durationMs: Date.now() - startedAt,
    })

    return pdfResponse(pdf, contract.contractNumber, reqId)
  } catch (error) {
    log('error', 'Contract PDF request failed.', {
      requestId: reqId,
      contractId,
      phase,
      durationMs: Date.now() - startedAt,
      error: errorDetails(error),
    })
    return jsonError('Contract PDF could not be generated right now. Please try again in a moment.', 503, reqId)
  }
}

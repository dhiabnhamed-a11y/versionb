import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({ ready: true }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ ready: false }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}

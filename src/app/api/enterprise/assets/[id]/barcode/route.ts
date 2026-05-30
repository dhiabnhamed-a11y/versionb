import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/modules/auth/session'
import { generateBarcode } from '@/modules/enterprise/enterprise-qr'

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await getSessionUser()
    const code = await generateBarcode(id)
    if (!code) return NextResponse.json({ error: 'Asset not found.' }, { status: 404 })
    return NextResponse.json({ barcode: code })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status || e.code || 500 })
  }
}

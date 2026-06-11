import { requireSessionUser } from '@/modules/shared/session'
import { NextRequest, NextResponse } from 'next/server'

import { getCameraForUser, toCameraDto } from '@/lib/camera-access'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = withApiHandler(async ({ req, params }) => {
const user = await requireSessionUser()
const { id } = await params as { id: string }
const result = await getCameraForUser(id, user)

if (!result) return NextResponse.json({ error: 'Camera not found.' }, { status: 404 })

return NextResponse.json(toCameraDto(result.camera))
}, { auth: 'required' });

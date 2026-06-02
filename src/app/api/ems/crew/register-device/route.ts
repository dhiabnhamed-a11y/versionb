/**
 * EMS crew device registration.
 * Crew members register their FCM push tokens here so they receive dispatch alerts.
 * Supports token rotation — old token is cleaned up on new registration.
 */
import { NextRequest, NextResponse } from 'next/server'
import { handleApiRoute, parseJsonObject, apiData } from '@/lib/api'
import { prisma } from '@/lib/db'
import { z } from 'zod'

export const runtime = 'nodejs'

const RegisterSchema = z.object({
  token: z.string().min(10),
  previousToken: z.string().optional(),
  platform: z.enum(['android', 'ios', 'web']).default('android'),
  appVersion: z.string().optional(),
  deviceModel: z.string().optional(),
})

export async function POST(req: NextRequest) {
  return handleApiRoute(req, undefined, async ({ user }) => {
    const body = await parseJsonObject(req)
    const parsed = RegisterSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid body', details: parsed.error.flatten().fieldErrors }, { status: 400 })
    }
    const { token, previousToken, platform, appVersion, deviceModel } = parsed.data
    const userId = user.id
    const userAgent = req.headers.get('user-agent') || undefined

    // Upsert push token
    const pushToken = await prisma.pushToken.upsert({
      where: { token },
      update: { userId, userAgent, lastUsedAt: new Date() },
      create: { token, userId, userAgent, lastUsedAt: new Date() },
    })

    // Rotate old token
    if (previousToken && previousToken !== token) {
      await prisma.pushToken.deleteMany({ where: { token: previousToken, userId } })
    }

    // Update crew member record with device info (best effort)
    try {
      await prisma.emsCrewMember.updateMany({
        where: { userId },
        data: { status: 'available' },
      })
    } catch { /* crew member may not exist for this user */ }

    return apiData({
      ok: true,
      tokenId: pushToken.id,
      platform,
      registeredAt: new Date().toISOString(),
      message: 'Device registered for EMS dispatch alerts.',
    })
  }, {
    auth: 'required',
    responseMode: 'legacy',
    route: '/api/ems/crew/register-device',
  })
}

export async function DELETE(req: NextRequest) {
  return handleApiRoute(req, undefined, async ({ user }) => {
    const body = await parseJsonObject(req)
    const { token } = z.object({ token: z.string().min(10) }).parse(body)
    await prisma.pushToken.deleteMany({ where: { token, userId: user.id } })
    return apiData({ ok: true })
  }, {
    auth: 'required',
    responseMode: 'legacy',
    route: '/api/ems/crew/register-device',
  })
}

export async function GET(req: NextRequest) {
  return handleApiRoute(req, undefined, async ({ user }) => {
    const tokens = await prisma.pushToken.findMany({
      where: { userId: user.id },
      select: { id: true, userAgent: true, lastUsedAt: true, createdAt: true },
      orderBy: { lastUsedAt: 'desc' },
    })
    return apiData({ registeredDevices: tokens.length, devices: tokens })
  }, {
    auth: 'required',
    responseMode: 'legacy',
    route: '/api/ems/crew/register-device',
  })
}

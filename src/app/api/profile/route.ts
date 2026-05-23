import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { detectImageMime } from '@/lib/security/upload'
import {
  getProfileAvatarUrl,
  uploadProfileAvatarBuffer,
  validateProfileAvatarFile,
} from '@/lib/cloudinary'
import { requireSessionUser } from '@/modules/shared/session'
import { AppError } from '@/modules/shared/errors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function cleanName(value: FormDataEntryValue | null) {
  if (typeof value !== 'string') return null
  const name = value.trim().replace(/\s+/g, ' ')
  if (name.length < 2 || name.length > 80) return null
  return name
}

function profileResponse(user: {
  id: string
  name: string
  email: string
  role: string
  avatar: string | null
  companyId: string | null
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatar: user.avatar,
    companyId: user.companyId,
  }
}

export async function GET(req: NextRequest) {
  try {
    const sessionUser = await requireSessionUser(req)
    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: { id: true, name: true, email: true, role: true, avatar: true, companyId: true },
    })

    if (!user) return NextResponse.json({ error: 'Profile not found.' }, { status: 404 })
    return NextResponse.json(profileResponse(user))
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('[api/profile][GET]', error)
    return NextResponse.json({ error: 'Failed to load profile.' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const sessionUser = await requireSessionUser(req)
    const formData = await req.formData()
    const name = cleanName(formData.get('name'))
    if (!name) {
      return NextResponse.json({ error: 'Name must be between 2 and 80 characters.' }, { status: 400 })
    }

    const data: { name: string; avatar?: string } = { name }
    const file = formData.get('avatar')

    if (file instanceof File && file.size > 0) {
      const validation = validateProfileAvatarFile({ mimeType: file.type, size: file.size })
      if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 400 })

      const buffer = Buffer.from(await file.arrayBuffer())
      const detectedMime = detectImageMime(buffer)
      if (!detectedMime || detectedMime !== file.type.toLowerCase()) {
        return NextResponse.json({ error: 'Profile image type could not be verified.' }, { status: 400 })
      }

      const upload = await uploadProfileAvatarBuffer({
        buffer,
        companyId: sessionUser.companyId,
        userId: sessionUser.id,
        fileName: file.name || 'profile-avatar',
      })
      data.avatar = getProfileAvatarUrl(upload)
    }

    const updated = await prisma.user.update({
      where: { id: sessionUser.id },
      data,
      select: { id: true, name: true, email: true, role: true, avatar: true, companyId: true },
    })

    return NextResponse.json(profileResponse(updated))
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    if (error instanceof Error && error.message.includes('Cloudinary is not configured')) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    console.error('[api/profile][PATCH]', error)
    return NextResponse.json({ error: 'Failed to update profile.' }, { status: 500 })
  }
}

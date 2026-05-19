import { requireSessionUser } from '@/modules/shared/session'
import { NextRequest, NextResponse } from 'next/server'

import {
  getDashboardDesignImageUrl,
  uploadDashboardDesignImageBuffer,
  validateDashboardDesignImageFile,
} from '@/lib/cloudinary'
import { NO_STORE_HEADERS } from '@/lib/http'
import { SettingsAccessError } from '@/lib/settings'

export async function POST(req: NextRequest) {
  const user = await requireSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    if (!user.id) throw new SettingsAccessError('Unauthorized', 401)

    const formData = await req.formData()
    const file = formData.get('file')

    if (!(file instanceof File)) {
      throw new SettingsAccessError('Upload a dashboard background image.')
    }

    const validation = validateDashboardDesignImageFile({
      mimeType: file.type,
      size: file.size,
    })

    if (!validation.ok) {
      throw new SettingsAccessError(validation.error)
    }

    const result = await uploadDashboardDesignImageBuffer({
      buffer: Buffer.from(await file.arrayBuffer()),
      companyId: user.companyId,
      userId: user.id,
      fileName: file.name,
    })

    return NextResponse.json(
      {
        image: {
          url: getDashboardDesignImageUrl(result),
          secureUrl: result.secure_url,
          publicId: result.public_id,
          width: result.width ?? null,
          height: result.height ?? null,
        },
      },
      { headers: NO_STORE_HEADERS }
    )
  } catch (error) {
    if (error instanceof SettingsAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error('[dashboard-background-upload]', error)
    return NextResponse.json({ error: 'Failed to upload dashboard background.' }, { status: 500 })
  }
}

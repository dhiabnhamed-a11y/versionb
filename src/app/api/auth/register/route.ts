import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  try {
    const { name, email, password, role } = (await req.json()) as {
      name?: string
      email?: string
      password?: string
      role?: string
    }

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: 'Email already exists' }, { status: 409 })
    }

    const hashed = await bcrypt.hash(password, 12)

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashed,
        role: role || 'EMPLOYEE',
      },
    })

    // If OWNER, create a company automatically
    if (role === 'OWNER') {
      const company = await prisma.company.create({
        data: {
          name: `${name}'s Company`,
          ownerId: user.id,
        },
      })
      await prisma.user.update({
        where: { id: user.id },
        data: { companyId: company.id },
      })
    }

    return NextResponse.json({ success: true, userId: user.id }, { status: 201 })
  } catch (err: unknown) {
    console.error(err)
    const message = err instanceof Error ? err.message : 'Server error'
    return NextResponse.json({ error: message, details: String(err) }, { status: 500 })
  }
}

import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, parseJsonObject } from '@/lib/api'
import { EmsService } from '@/modules/ems/ems.service'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  return handleApiRoute(req, undefined, async ({ user }) => {
    const companyId = user.companyId || ''
    const body = await parseJsonObject(req)
    if (body.action === 'add_vitals' && body.patientId) {
      return apiData(await EmsService.addPatientVitals(companyId, body.patientId, body.vitals))
    }
    const patient = await prisma.emsPatient.create({
      data: {
        incidentId: body.incidentId,
        patientNumber: body.patientNumber || 1,
        name: body.name, age: body.age, gender: body.gender,
        chiefComplaint: body.chiefComplaint, symptoms: body.symptoms,
        medicalHistory: body.medicalHistory, allergies: body.allergies, medications: body.medications,
      },
    })
    return apiData(patient, { status: 201 })
  }, {
    auth: 'required', responseMode: 'legacy', route: '/api/ems/patients',
  })
}

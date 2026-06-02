import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, parseJsonObject } from '@/lib/api'
import { EmsService } from '@/modules/ems/ems.service'
import { prisma } from '@/lib/db'
import { logPhiAccess } from '@/lib/ems/hipaa/audit-enforcer'
import { encryptPhiRecord, PHI_PATIENT_FIELDS } from '@/lib/ems/hipaa/phi-crypto'
import { z } from 'zod'

export const runtime = 'nodejs'

const CreatePatientSchema = z.object({
  incidentId: z.string().min(1),
  patientNumber: z.number().int().min(1).optional(),
  name: z.string().max(200).optional(),
  age: z.number().int().min(0).max(150).optional(),
  gender: z.string().max(20).optional(),
  dateOfBirth: z.string().optional(),
  chiefComplaint: z.string().max(500).optional(),
  symptoms: z.string().max(2000).optional(),
  medicalHistory: z.string().max(5000).optional(),
  allergies: z.string().max(2000).optional(),
  medications: z.string().max(2000).optional(),
  triage: z.string().optional(),
  status: z.string().optional(),
})

export async function POST(req: NextRequest) {
  return handleApiRoute(req, undefined, async ({ user }) => {
    const companyId = user.companyId || ''
    const body = await parseJsonObject(req)

    if (body.action === 'add_vitals' && body.patientId) {
      await logPhiAccess({ companyId, actorId: user.id, actorRole: user.role, route: '/api/ems/patients' }, 'patient', body.patientId, 'WRITE')
      return apiData(await EmsService.addPatientVitals(companyId, body.patientId, body.vitals))
    }

    const parsed = CreatePatientSchema.safeParse(body)
    if (!parsed.success) {
      return apiData({ error: 'Invalid request', details: parsed.error.flatten().fieldErrors }, { status: 400 })
    }

    // Encrypt PHI before storing
    const encryptedData = encryptPhiRecord(parsed.data, PHI_PATIENT_FIELDS)

    const patient = await prisma.emsPatient.create({
      data: {
        incidentId: encryptedData.incidentId,
        patientNumber: encryptedData.patientNumber || 1,
        name: encryptedData.name,
        age: encryptedData.age,
        gender: encryptedData.gender,
        chiefComplaint: encryptedData.chiefComplaint,
        symptoms: encryptedData.symptoms,
        medicalHistory: encryptedData.medicalHistory,
        allergies: encryptedData.allergies,
        medications: encryptedData.medications,
      },
    })

    await logPhiAccess({ companyId, actorId: user.id, actorRole: user.role, route: '/api/ems/patients' }, 'patient', patient.id, 'WRITE')

    return apiData(patient, { status: 201 })
  }, {
    auth: 'required',
    requiredRole: ['MANAGER', 'OWNER', 'SUPER_ADMIN'],
    responseMode: 'legacy',
    route: '/api/ems/patients',
  })
}

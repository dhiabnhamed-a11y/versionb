import type { Prisma } from '@prisma/client'

type EmsProvisioningClient = Prisma.TransactionClient

type EnsureEmsWorkspaceOptions = {
  ownerId?: string | null
}

const DEFAULT_STATIONS = [
  { name: 'Central Response Station', code: 'EMS-01', lat: 36.8065, lng: 10.1815, address: 'Central operations district', type: 'primary', capacity: 8 },
  { name: 'North Coverage Post', code: 'EMS-02', lat: 36.838, lng: 10.1658, address: 'North coverage zone', type: 'substation', capacity: 4 },
  { name: 'South Staging Post', code: 'EMS-03', lat: 36.773, lng: 10.206, address: 'South response corridor', type: 'staging', capacity: 4 },
] as const

const DEFAULT_UNITS = [
  { unitNumber: 'A-101', type: 'ALS_AMBULANCE', stationCode: 'EMS-01', lat: 36.8065, lng: 10.1815 },
  { unitNumber: 'A-102', type: 'BLS_AMBULANCE', stationCode: 'EMS-01', lat: 36.809, lng: 10.1785 },
  { unitNumber: 'M-201', type: 'MICU', stationCode: 'EMS-02', lat: 36.838, lng: 10.1658 },
  { unitNumber: 'S-301', type: 'SUPERVISOR', stationCode: 'EMS-03', lat: 36.773, lng: 10.206 },
] as const

const DEFAULT_HOSPITALS = [
  {
    name: 'Central Receiving Hospital',
    code: 'CRH',
    lat: 36.8008,
    lng: 10.1846,
    bedCount: 180,
    availableBeds: 46,
    icuBeds: 24,
    availableIcu: 6,
    traumaLevel: 2,
    capabilities: ['LEVEL_2_TRAUMA', 'STROKE_CENTER', 'CARDIAC_CENTER'],
    waitTimeMinutes: 18,
  },
  {
    name: 'North Emergency Department',
    code: 'NED',
    lat: 36.842,
    lng: 10.173,
    bedCount: 120,
    availableBeds: 31,
    icuBeds: 12,
    availableIcu: 3,
    traumaLevel: 3,
    capabilities: ['LEVEL_3_TRAUMA', 'PEDIATRIC'],
    waitTimeMinutes: 24,
  },
  {
    name: 'South Trauma Center',
    code: 'STC',
    lat: 36.764,
    lng: 10.215,
    bedCount: 220,
    availableBeds: 52,
    icuBeds: 32,
    availableIcu: 9,
    traumaLevel: 1,
    capabilities: ['LEVEL_1_TRAUMA', 'BURN_CENTER', 'DECONTAMINATION'],
    waitTimeMinutes: 15,
  },
] as const

const DEFAULT_CREWS = [
  { name: 'Alpha ALS Crew', code: 'ALPHA', type: 'ALS', unitNumber: 'A-101', members: [{ role: 'paramedic' }, { role: 'emt' }] },
  { name: 'Bravo BLS Crew', code: 'BRAVO', type: 'BLS', unitNumber: 'A-102', members: [{ role: 'emt' }, { role: 'driver' }] },
  { name: 'Medic Critical Care', code: 'MEDIC', type: 'MICU', unitNumber: 'M-201', members: [{ role: 'paramedic' }, { role: 'nurse' }] },
] as const

const DEFAULT_PROTOCOLS = [
  { name: 'Cardiac Arrest Response', code: 'MED-CPR', type: 'medical', severity: 'ECHO', content: { steps: ['Confirm arrest', 'Start CPR', 'Attach AED/monitor', 'Request ALS backup', 'Transport per medical control'] } },
  { name: 'Major Trauma Response', code: 'MED-TRAUMA', type: 'medical', severity: 'DELTA', content: { steps: ['Scene safety', 'Control bleeding', 'Protect airway', 'Rapid transport to trauma center'] } },
  { name: 'Mass Casualty Incident', code: 'OPS-MCI', type: 'mci', severity: 'OMEGA', content: { steps: ['Establish command', 'Declare MCI', 'Start triage', 'Stage incoming units', 'Coordinate hospital distribution'] } },
  { name: 'Hospital Diversion Coordination', code: 'OPS-DIVERT', type: 'operational', severity: null, content: { steps: ['Verify receiving capacity', 'Notify dispatch desk', 'Update destination guidance', 'Log diversion reason'] } },
] as const

const DEFAULT_AUTOMATION_RULES = [
  {
    name: 'High Severity Dispatch Review',
    description: 'Run AI unit recommendation and notify command staff for DELTA or higher calls.',
    trigger: 'incident_created',
    conditions: { severity: ['DELTA', 'ECHO', 'OMEGA'] },
    actions: [{ type: 'run_ai_dispatch' }, { type: 'notify_commander' }],
    priority: 100,
    isActive: true,
  },
  {
    name: 'Hospital Capacity Watch',
    description: 'Flag hospitals when available bed capacity drops below the operating threshold.',
    trigger: 'hospital_capacity_updated',
    conditions: { availableBedPercent: { lt: 15 } },
    actions: [{ type: 'notify_dispatch' }, { type: 'recommend_alternate_destination' }],
    priority: 70,
    isActive: true,
  },
] as const

export async function ensureEmsWorkspaceInitialized(
  tx: EmsProvisioningClient,
  companyId: string,
  options: EnsureEmsWorkspaceOptions = {}
) {
  if (!companyId) return { provisioned: false as const, reason: 'missing_company' }

  await tx.emsCompany.upsert({
    where: { companyId },
    update: {},
    create: {
      companyId,
      regionCode: 'EMS-DEFAULT',
      timezone: 'UTC',
      dispatchMode: 'semi_auto',
      defaultRadioChannel: 'Dispatch-1',
      autoDispatchThreshold: 0.65,
      responseTimeTarget: 480,
      enableAiClassification: true,
      enableAutoDispatch: false,
      enablePredictiveAlerts: true,
    },
  })

  const [stationCount, unitCount, hospitalCount, crewCount, protocolCount, automationCount] = await Promise.all([
    tx.emsStation.count({ where: { companyId } }),
    tx.emsUnit.count({ where: { companyId } }),
    tx.emsHospital.count({ where: { companyId } }),
    tx.emsCrew.count({ where: { companyId } }),
    tx.emsProtocol.count({ where: { companyId } }),
    tx.emsAutomationRule.count({ where: { companyId } }),
  ])

  if (stationCount === 0) {
    await tx.emsStation.createMany({
      data: DEFAULT_STATIONS.map((station) => ({ companyId, ...station })),
    })
  }

  const stations = await tx.emsStation.findMany({ where: { companyId } })
  const stationByCode = new Map(stations.map((station) => [station.code, station]))

  if (unitCount === 0) {
    await tx.emsUnit.createMany({
      data: DEFAULT_UNITS.map((unit, index) => ({
        companyId,
        unitNumber: unit.unitNumber,
        type: unit.type as any,
        status: index === DEFAULT_UNITS.length - 1 ? 'RESERVE' : 'AVAILABLE',
        stationId: stationByCode.get(unit.stationCode)?.id,
        lat: unit.lat,
        lng: unit.lng,
        fuelLevel: 82 - index * 6,
        batteryLevel: 96 - index * 4,
        odometer: 12000 + index * 7300,
        isOnline: true,
        lastGpsUpdate: new Date(),
        lastPing: new Date(),
        equipment: { monitor: true, oxygen: true, stretcher: true },
        capabilities: unit.type === 'MICU' ? ['critical_care', 'ventilator'] : ['transport', 'basic_life_support'],
      })),
    })
  }

  if (hospitalCount === 0) {
    await tx.emsHospital.createMany({
      data: DEFAULT_HOSPITALS.map((hospital) => ({
        companyId,
        ...hospital,
        capabilities: hospital.capabilities as any,
        status: 'OPEN' as any,
        phone: '+1-555-0100',
        edPhone: '+1-555-0199',
      })),
    })
  }

  const units = await tx.emsUnit.findMany({ where: { companyId } })
  const unitByNumber = new Map(units.map((unit) => [unit.unitNumber, unit]))

  if (crewCount === 0) {
    for (const crewTemplate of DEFAULT_CREWS) {
      const crew = await tx.emsCrew.create({
        data: {
          companyId,
          name: crewTemplate.name,
          code: crewTemplate.code,
          type: crewTemplate.type,
          isActive: true,
        },
      })

      const unit = unitByNumber.get(crewTemplate.unitNumber)
      await tx.emsCrewMember.createMany({
        data: crewTemplate.members.map((member, index) => ({
          crewId: crew.id,
          unitId: unit?.id,
          userId: options.ownerId && index === 0 ? options.ownerId : `ems-${crewTemplate.code.toLowerCase()}-${member.role}-${index + 1}`,
          role: member.role,
          certified: true,
          status: 'available',
          fatigue: 20 + index * 8,
        })),
      })
    }
  }

  if (protocolCount === 0) {
    await tx.emsProtocol.createMany({
      data: DEFAULT_PROTOCOLS.map((protocol) => ({
        companyId,
        ...protocol,
        severity: protocol.severity as any,
      })),
    })
  }

  if (automationCount === 0) {
    await tx.emsAutomationRule.createMany({
      data: DEFAULT_AUTOMATION_RULES.map((rule) => ({
        companyId,
        ...rule,
      })),
    })
  }

  return {
    provisioned: true as const,
    stations: stationCount === 0 ? DEFAULT_STATIONS.length : stationCount,
    units: unitCount === 0 ? DEFAULT_UNITS.length : unitCount,
    hospitals: hospitalCount === 0 ? DEFAULT_HOSPITALS.length : hospitalCount,
    crews: crewCount === 0 ? DEFAULT_CREWS.length : crewCount,
    protocols: protocolCount === 0 ? DEFAULT_PROTOCOLS.length : protocolCount,
    automationRules: automationCount === 0 ? DEFAULT_AUTOMATION_RULES.length : automationCount,
  }
}

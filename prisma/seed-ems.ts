import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding EMS data...')

  // Use the TaskForce company
  let company = await prisma.company.findFirst({ where: { name: 'TaskForce Inc.' } })
  if (!company) {
    company = await prisma.company.findFirst({ orderBy: { createdAt: 'asc' } })
  }
  if (!company) {
    console.log('No company found. Run prisma/seed.ts first.')
    return
  }
  const companyId = company.id

  // Upsert EmsCompany config
  await prisma.emsCompany.upsert({
    where: { companyId },
    update: {
      regionCode: 'US-CA-01',
      timezone: 'America/Los_Angeles',
      dispatchMode: 'semi_auto',
      defaultRadioChannel: 'CH-1 Dispatch',
      autoDispatchThreshold: 0.65,
      responseTimeTarget: 360,
      enableAiClassification: true,
      enableAutoDispatch: true,
      enablePredictiveAlerts: true,
    },
    create: {
      companyId,
      regionCode: 'US-CA-01',
      timezone: 'America/Los_Angeles',
      dispatchMode: 'semi_auto',
      defaultRadioChannel: 'CH-1 Dispatch',
      autoDispatchThreshold: 0.65,
      responseTimeTarget: 360,
      enableAiClassification: true,
      enableAutoDispatch: true,
      enablePredictiveAlerts: true,
    },
  })
  console.log('  EmsCompany config created')

  // Stations
  const stationsData = [
    { name: 'Downtown Station', code: 'S01', lat: 34.0522, lng: -118.2437, address: '101 Main St, Los Angeles, CA', type: 'primary', capacity: 12 },
    { name: 'Hollywood Station', code: 'S02', lat: 34.0928, lng: -118.3287, address: '202 Sunset Blvd, Hollywood, CA', type: 'primary', capacity: 8 },
    { name: 'Valley Station', code: 'S03', lat: 34.1693, lng: -118.4528, address: '303 Ventura Blvd, Van Nuys, CA', type: 'primary', capacity: 10 },
    { name: 'Harbor Substation', code: 'S04', lat: 33.7420, lng: -118.2710, address: '404 Harbor Blvd, San Pedro, CA', type: 'substation', capacity: 4 },
    { name: 'Pasadena Staging', code: 'S05', lat: 34.1478, lng: -118.1445, address: '505 Colorado Blvd, Pasadena, CA', type: 'staging', capacity: 6 },
  ]
  const stations = []
  for (const s of stationsData) {
    const station = await prisma.emsStation.upsert({
      where: { id: `station-${s.code}` },
      update: s,
      create: { id: `station-${s.code}`, companyId, ...s },
    })
    stations.push(station)
  }
  console.log(`  ${stations.length} stations created`)

  // Units
  const unitsData = [
    { unitNumber: 'A-1', type: 'ALS_AMBULANCE', stationId: stations[0].id, lat: 34.0522, lng: -118.2437 },
    { unitNumber: 'A-2', type: 'ALS_AMBULANCE', stationId: stations[0].id, lat: 34.0530, lng: -118.2445 },
    { unitNumber: 'B-1', type: 'BLS_AMBULANCE', stationId: stations[1].id, lat: 34.0928, lng: -118.3287 },
    { unitNumber: 'B-2', type: 'BLS_AMBULANCE', stationId: stations[1].id, lat: 34.0935, lng: -118.3295 },
    { unitNumber: 'M-1', type: 'MICU', stationId: stations[2].id, lat: 34.1693, lng: -118.4528 },
    { unitNumber: 'S-1', type: 'SUPERVISOR', stationId: stations[0].id, lat: 34.0525, lng: -118.2440 },
    { unitNumber: 'R-1', type: 'RESPONSE_VEHICLE', stationId: stations[3].id, lat: 33.7420, lng: -118.2710 },
    { unitNumber: 'H-1', type: 'AIR_AMBULANCE', stationId: stations[4].id, lat: 34.1478, lng: -118.1445 },
    { unitNumber: 'A-3', type: 'AMBULANCE', stationId: stations[2].id, lat: 34.1700, lng: -118.4530 },
    { unitNumber: 'MCI-1', type: 'MASS_CASUALTY_BUS', stationId: stations[0].id, lat: 34.0518, lng: -118.2430 },
  ]
  const units = []
  for (const u of unitsData) {
    const unitId = `unit-${u.unitNumber}`
    const existing = await prisma.emsUnit.findFirst({ where: { companyId, unitNumber: u.unitNumber } })
    if (existing) {
      units.push(existing)
      continue
    }
    const unit = await prisma.emsUnit.create({
      data: {
        id: unitId,
        companyId,
        unitNumber: u.unitNumber,
        type: u.type as any,
        status: 'AVAILABLE',
        stationId: u.stationId,
        lat: u.lat,
        lng: u.lng,
        fuelLevel: 85 + Math.floor(Math.random() * 15),
        odometer: 5000 + Math.floor(Math.random() * 50000),
        batteryLevel: 90 + Math.floor(Math.random() * 10),
        isOnline: true,
        lastGpsUpdate: new Date(),
        lastPing: new Date(),
      },
    })
    units.push(unit)
  }
  console.log(`  ${units.length} units created`)

  // Hospitals
  const hospitalsData = [
    { name: 'LA General Medical Center', code: 'LAGMC', lat: 34.0390, lng: -118.2660, beds: 450, icuBeds: 80, capabilities: ['LEVEL_1_TRAUMA', 'STROKE_CENTER', 'CARDIAC_CENTER', 'BURN_CENTER'] },
    { name: 'Cedars-Sinai Medical Center', code: 'CSMC', lat: 34.0754, lng: -118.3775, beds: 320, icuBeds: 60, capabilities: ['LEVEL_1_TRAUMA', 'CARDIAC_CENTER', 'NEONATAL_ICU'] },
    { name: 'UCLA Medical Center', code: 'UCLA', lat: 34.0650, lng: -118.4450, beds: 280, icuBeds: 55, capabilities: ['LEVEL_1_TRAUMA', 'STROKE_CENTER', 'PEDIATRIC'] },
    { name: 'Hollywood Presbyterian', code: 'HPC', lat: 34.0920, lng: -118.3200, beds: 180, icuBeds: 25, capabilities: ['LEVEL_3_TRAUMA'] },
    { name: 'Harbor-UCLA Medical Center', code: 'HUMC', lat: 33.7400, lng: -118.2750, beds: 220, icuBeds: 40, capabilities: ['LEVEL_2_TRAUMA', 'DECONTAMINATION'] },
    { name: 'Downtown Urgent Care', code: 'DTUC', lat: 34.0450, lng: -118.2500, beds: 40, icuBeds: 0, capabilities: [] },
  ]
  const hospitals = []
  for (const h of hospitalsData) {
    const hospId = `hosp-${h.code}`
    const existing = await prisma.emsHospital.findFirst({ where: { companyId, code: h.code } })
    if (existing) { hospitals.push(existing); continue }
    const hosp = await prisma.emsHospital.create({
      data: {
        id: hospId,
        companyId,
        name: h.name,
        code: h.code,
        lat: h.lat,
        lng: h.lng,
        availableBeds: Math.floor(h.beds * (0.7 + Math.random() * 0.25)),
        bedCount: h.beds,
        availableIcu: Math.floor(h.icuBeds * (0.6 + Math.random() * 0.3)),
        icuBeds: h.icuBeds,
        capabilities: h.capabilities,
        status: 'OPEN',
        phone: '(555) 000-0000',
        waitTimeMinutes: 15 + Math.floor(Math.random() * 45),
      },
    })
    hospitals.push(hosp)
  }
  console.log(`  ${hospitals.length} hospitals created`)

  // Crews
  const crewsData = [
    { name: 'Alpha Shift Lead', type: 'ALS' },
    { name: 'Bravo Shift Lead', type: 'ALS' },
    { name: 'Charlie Shift Lead', type: 'ALS' },
    { name: 'EMT Alpha', type: 'BLS' },
    { name: 'EMT Bravo', type: 'BLS' },
    { name: 'EMT Charlie', type: 'BLS' },
    { name: 'EMT Delta', type: 'BLS' },
    { name: 'Nurse Specialist', type: 'ALS' },
  ]
  const crews = []
  for (const c of crewsData) {
    const crewId = `crew-${c.name.replace(/\s+/g, '').toLowerCase()}`
    const existing = await prisma.emsCrew.findFirst({ where: { companyId, name: c.name } })
    if (existing) { crews.push(existing); continue }
    const crew = await prisma.emsCrew.create({
      data: { id: crewId, companyId, name: c.name, type: c.type, isActive: true },
    })
    crews.push(crew)
  }
  console.log(`  ${crews.length} crews created`)

  // Crew members (assign to units with roles)
  const memberData = [
    { crewIdx: 0, unitIdx: 0, role: 'paramedic', userId: 'seed-paramedic-1' },
    { crewIdx: 1, unitIdx: 1, role: 'paramedic', userId: 'seed-paramedic-2' },
    { crewIdx: 2, unitIdx: 4, role: 'paramedic', userId: 'seed-paramedic-3' },
    { crewIdx: 3, unitIdx: 0, role: 'emt', userId: 'seed-emt-1' },
    { crewIdx: 4, unitIdx: 1, role: 'emt', userId: 'seed-emt-2' },
    { crewIdx: 5, unitIdx: 2, role: 'emt', userId: 'seed-emt-3' },
    { crewIdx: 6, unitIdx: 3, role: 'emt', userId: 'seed-emt-4' },
    { crewIdx: 7, unitIdx: 4, role: 'nurse', userId: 'seed-nurse-1' },
  ]
  for (const m of memberData) {
    const crewId = crews[m.crewIdx]?.id
    const unitId = units[m.unitIdx]?.id
    if (!crewId || !unitId) continue
    const exists = await prisma.emsCrewMember.findFirst({ where: { crewId, userId: m.userId } })
    if (!exists) {
      await prisma.emsCrewMember.create({
        data: { crewId, unitId, userId: m.userId, role: m.role, status: 'available' },
      })
    }
  }
  console.log('  Crew members assigned to units')

  // Automation rules
  const rulesData = [
    { name: 'High-Severity Auto-Dispatch', trigger: 'incident_created', conditions: { severity: ['DELTA', 'ECHO', 'OMEGA'] }, actions: [{ type: 'run_ai_dispatch' }, { type: 'notify_commander' }], priority: 100, isActive: true },
    { name: 'Hospital Notification', trigger: 'unit_transporting', conditions: { status: 'TRANSPORTING' }, actions: [{ type: 'alert_hospital_ed', params: { includePatientCount: true } }], priority: 80, isActive: true },
    { name: 'Crew Fatigue Alert', trigger: 'crew_status_changed', conditions: { fatigueScore: { gt: 80 } }, actions: [{ type: 'notify_supervisor' }, { type: 'flag_for_rotation' }], priority: 90, isActive: true },
    { name: 'MCI Protocol Activation', trigger: 'incident_created', conditions: { patientCount: { gte: 10 } }, actions: [{ type: 'declare_mci' }, { type: 'dispatch_all_available' }, { type: 'alert_all_hospitals' }], priority: 150, isActive: true },
    { name: 'Low Fuel Alert', trigger: 'unit_status_changed', conditions: { fuelLevel: { lt: 15 } }, actions: [{ type: 'notify_mechanic' }, { type: 'route_to_station' }], priority: 50, isActive: false },
  ]
  for (const r of rulesData) {
    const exists = await prisma.emsAutomationRule.findFirst({ where: { companyId, name: r.name } })
    if (!exists) {
      await prisma.emsAutomationRule.create({ data: { companyId, ...r } })
    }
  }
  console.log(`  ${rulesData.length} automation rules created`)

  // Protocols
  const protocolsData = [
    { name: 'MCI Triage Protocol', code: 'MCI-01', type: 'mci', severity: 'OMEGA', content: { steps: ['Establish command', 'Triage patients', 'Request additional resources', 'Begin transport'] } },
    { name: 'Cardiac Arrest Protocol', code: 'MED-01', type: 'medical', severity: 'ECHO', content: { steps: ['Assess responsiveness', 'Call for ALS backup', 'Begin CPR', 'Apply AED', 'Administer epinephrine'] } },
    { name: 'Trauma Response', code: 'MED-02', type: 'medical', severity: 'DELTA', content: { steps: ['Scene safety', 'C-spine control', 'Rapid trauma assessment', 'Transport to Level 1'] } },
    { name: 'Hazmat Decontamination', code: 'HAZ-01', type: 'hazmat', severity: 'DELTA', content: { steps: ['Establish hot zone', 'Don PPE', 'Decontaminate', 'Medical evaluation'] } },
    { name: 'Evacuation Protocol', code: 'OPS-01', type: 'operational', severity: null, content: { steps: ['Identify evacuation route', 'Account for all personnel', 'Establish staging area', 'Document all actions'] } },
    { name: 'Stroke Response', code: 'MED-03', type: 'medical', severity: 'CHARLIE', content: { steps: ['FAST assessment', 'Last known well time', 'Alert stroke center', 'Rapid transport'] } },
  ]
  for (const p of protocolsData) {
    const exists = await prisma.emsProtocol.findFirst({ where: { companyId, code: p.code } })
    if (!exists) {
      await prisma.emsProtocol.create({ data: { companyId, ...p, isActive: true, version: 1 } })
    }
  }
  console.log(`  ${protocolsData.length} protocols created`)

  // Sample active incidents
  const existingIncidents = await prisma.emsIncident.count({ where: { companyId, status: { notIn: ['COMPLETED', 'CANCELLED'] } } })
  if (existingIncidents === 0) {
    const sampleIncidents = [
      {
        incidentNumber: 'INC-20260527-0001',
        severity: 'CHARLIE',
        status: 'ON_SCENE',
        callSource: 'PHONE',
        lat: 34.0600, lng: -118.2900,
        address: '500 Wilshire Blvd, Los Angeles, CA',
        chiefComplaint: 'Chest pain',
        symptoms: 'Shortness of breath, radiating pain to left arm',
        mechanismOfInjury: 'Medical',
        patientCount: 1,
        callerName: 'John Smith',
        callerPhone: '(555) 123-4567',
        callerNotes: 'Patient is conscious, diaphoretic. Hx of hypertension.',
        calledAt: new Date(Date.now() - 2700000),
        enRouteAt: new Date(Date.now() - 2400000),
        onSceneAt: new Date(Date.now() - 2100000),
        assignedUnitId: units[0]?.id || null,
      },
      {
        incidentNumber: 'INC-20260527-0002',
        severity: 'DELTA',
        status: 'TRANSPORTING',
        callSource: 'RADIO',
        lat: 34.0800, lng: -118.3100,
        address: '1200 Sunset Blvd, Los Angeles, CA',
        chiefComplaint: 'Motor vehicle accident',
        symptoms: 'Multiple trauma, possible head injury',
        mechanismOfInjury: 'MVC - high speed',
        patientCount: 2,
        callerName: 'Dispatch Relay',
        callerPhone: '(555) 000-0000',
        calledAt: new Date(Date.now() - 3600000),
        dispatchedAt: new Date(Date.now() - 3300000),
        enRouteAt: new Date(Date.now() - 3200000),
        onSceneAt: new Date(Date.now() - 2800000),
        transportingAt: new Date(Date.now() - 1800000),
        assignedUnitId: units[1]?.id || null,
      },
      {
        incidentNumber: 'INC-20260527-0003',
        severity: 'BRAVO',
        status: 'PENDING',
        callSource: 'MOBILE_APP',
        lat: 34.0400, lng: -118.2300,
        address: '800 Alameda St, Los Angeles, CA',
        chiefComplaint: 'Falls',
        symptoms: 'Elderly fall, possible hip fracture',
        mechanismOfInjury: 'Fall from standing',
        patientCount: 1,
        callerName: 'Jane Doe',
        callerPhone: '(555) 987-6543',
        calledAt: new Date(Date.now() - 600000),
      },
      {
        incidentNumber: 'INC-20260527-0004',
        severity: 'ECHO',
        status: 'DISPATCHED',
        callSource: 'PHONE',
        lat: 34.1000, lng: -118.3400,
        address: '200 Hollywood Blvd, Hollywood, CA',
        chiefComplaint: 'Unresponsive',
        symptoms: 'Found down, not breathing, no pulse',
        mechanismOfInjury: 'Medical - possible overdose',
        patientCount: 1,
        callerName: 'Bystander',
        callerPhone: '(555) 456-7890',
        calledAt: new Date(Date.now() - 1200000),
        dispatchedAt: new Date(Date.now() - 900000),
        assignedUnitId: null,
      },
    ]

    for (const inc of sampleIncidents) {
      const created = await prisma.emsIncident.create({ data: { companyId, ...inc } })
      await prisma.emsIncidentTimeline.create({
        data: {
          incidentId: created.id,
          eventType: 'incident_created',
          title: 'Incident created',
          description: `Call from ${inc.callerName}`,
          recordedAt: inc.calledAt,
        },
      })
    }
    console.log(`  ${sampleIncidents.length} sample incidents created`)

    // Add dispatch log for the dispatched incident
    const dispatchedInc = await prisma.emsIncident.findFirst({ where: { companyId, status: 'DISPATCHED' } })
    if (dispatchedInc && units[2]) {
      await prisma.emsDispatchLog.create({
        data: {
          incidentId: dispatchedInc.id,
          action: 'dispatched',
          dispatchedUnitIds: [units[2].id],
          decisionType: 'AI_AUTO_DISPATCH',
          responseTime: 42,
        },
      })
    }
    console.log('  Dispatch log created')
  } else {
    console.log(`  ${existingIncidents} active incidents already exist, skipping sample data`)
  }

  console.log('EMS seed complete!')
}

main()
  .catch((e) => {
    console.error('Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

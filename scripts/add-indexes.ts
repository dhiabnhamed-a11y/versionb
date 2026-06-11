import { readFileSync, writeFileSync } from 'fs'

let schema = readFileSync('./prisma/schema.prisma', 'utf8')

function addIndex(modelName: string, indexes: string) {
  const regex = new RegExp(`(model ${modelName} \\{[\\s\\S]*?)(\\})`, 'm')
  schema = schema.replace(regex, `$1\n${indexes}\n$2`)
}

if (!schema.includes('@@index([companyId, status, createdAt])', schema.indexOf('model Project {'))) {
  addIndex('Project', '  @@index([companyId, status, createdAt])\n  @@index([companyId, clientId, createdAt])\n  @@index([companyId, roomId, createdAt])')
}
if (!schema.includes('@@index([assigneeId, status])', schema.indexOf('model Task {'))) {
  addIndex('Task', '  @@index([companyId, status, createdAt])\n  @@index([assigneeId, status])\n  @@index([projectId, status, createdAt])')
}
if (!schema.includes('@@index([companyId, createdAt])', schema.indexOf('model AiRun {'))) {
  addIndex('AiRun', '  @@index([companyId, createdAt])\n  @@index([companyId, status, createdAt])')
}

writeFileSync('./prisma/schema.prisma', schema)
console.log('Missing indexes injected.')

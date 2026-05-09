import { Prisma } from '@prisma/client'

type Tx = Prisma.TransactionClient

const DELETE_GRAPH_TABLES = [
  'Activity',
  'ApprovalDecision',
  'Brief',
  'CalendarEvent',
  'Client',
  'ClientActivity',
  'Comment',
  'Deliverable',
  'DeliverableActivity',
  'DeliverableFile',
  'DeliverableRevision',
  'Invoice',
  'InvoiceItem',
  'Project',
  'ProjectCamera',
  'ProjectCameraMedia',
  'ProjectMedia',
  'Subtask',
  'Task',
  'TaskDependency',
  'TaskSubmission',
] as const

type DeleteGraphTable = (typeof DELETE_GRAPH_TABLES)[number]

type SchemaSupport = {
  tables: Set<string>
  columns: Map<string, Set<string>>
}

type IdRow = {
  id: string
}

type TableRow = {
  table_name: string
}

type ColumnRow = {
  table_name: string
  column_name: string
}

async function getDeleteGraphSchemaSupport(tx: Tx): Promise<SchemaSupport> {
  const [tables, columns] = await Promise.all([
    tx.$queryRaw<TableRow[]>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = current_schema()
        AND table_name IN (${Prisma.join([...DELETE_GRAPH_TABLES])})
    `,
    tx.$queryRaw<ColumnRow[]>`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name IN (${Prisma.join([...DELETE_GRAPH_TABLES])})
    `,
  ])

  const columnsByTable = new Map<string, Set<string>>()
  for (const column of columns) {
    const tableColumns = columnsByTable.get(column.table_name) ?? new Set<string>()
    tableColumns.add(column.column_name)
    columnsByTable.set(column.table_name, tableColumns)
  }

  return {
    tables: new Set(tables.map((table) => table.table_name)),
    columns: columnsByTable,
  }
}

function hasTable(schema: SchemaSupport, table: DeleteGraphTable) {
  return schema.tables.has(table)
}

function hasColumn(schema: SchemaSupport, table: DeleteGraphTable, column: string) {
  return schema.columns.get(table)?.has(column) ?? false
}

async function findTaskIdsForProject(tx: Tx, schema: SchemaSupport, projectId: string) {
  if (!hasTable(schema, 'Task') || !hasColumn(schema, 'Task', 'projectId')) return []

  const rows = await tx.$queryRaw<IdRow[]>`
    SELECT "id"
    FROM "Task"
    WHERE "projectId" = ${projectId}
  `
  return rows.map((row) => row.id)
}

async function findIdsByProject(tx: Tx, schema: SchemaSupport, table: DeleteGraphTable, projectColumn: 'campaignId' | 'projectId', projectId: string) {
  if (!hasTable(schema, table) || !hasColumn(schema, table, projectColumn)) return []

  if (table === 'Deliverable' && projectColumn === 'campaignId') {
    const rows = await tx.$queryRaw<IdRow[]>`
      SELECT "id"
      FROM "Deliverable"
      WHERE "campaignId" = ${projectId}
    `
    return rows.map((row) => row.id)
  }

  if (table === 'Brief' && projectColumn === 'campaignId') {
    const rows = await tx.$queryRaw<IdRow[]>`
      SELECT "id"
      FROM "Brief"
      WHERE "campaignId" = ${projectId}
    `
    return rows.map((row) => row.id)
  }

  if (table === 'ProjectMedia' && projectColumn === 'projectId') {
    const rows = await tx.$queryRaw<IdRow[]>`
      SELECT "id"
      FROM "ProjectMedia"
      WHERE "projectId" = ${projectId}
    `
    return rows.map((row) => row.id)
  }

  return []
}

async function findTaskSubmissionIds(tx: Tx, schema: SchemaSupport, taskIds: string[]) {
  if (taskIds.length === 0 || !hasTable(schema, 'TaskSubmission') || !hasColumn(schema, 'TaskSubmission', 'taskId')) return []

  const rows = await tx.$queryRaw<IdRow[]>`
    SELECT "id"
    FROM "TaskSubmission"
    WHERE "taskId" IN (${Prisma.join(taskIds)})
  `
  return rows.map((row) => row.id)
}

async function findDeliverableFileIds(tx: Tx, schema: SchemaSupport, deliverableIds: string[]) {
  if (deliverableIds.length === 0 || !hasTable(schema, 'DeliverableFile') || !hasColumn(schema, 'DeliverableFile', 'deliverableId')) return []

  const rows = await tx.$queryRaw<IdRow[]>`
    SELECT "id"
    FROM "DeliverableFile"
    WHERE "deliverableId" IN (${Prisma.join(deliverableIds)})
  `
  return rows.map((row) => row.id)
}

async function deleteCommentsForFileIds(tx: Tx, schema: SchemaSupport, fileIds: string[]) {
  if (fileIds.length === 0 || !hasTable(schema, 'Comment') || !hasColumn(schema, 'Comment', 'fileId')) return

  await tx.$executeRaw`
    DELETE FROM "Comment"
    WHERE "fileId" IN (${Prisma.join(fileIds)})
  `
}

async function deleteCommentsForDeliverableFiles(tx: Tx, schema: SchemaSupport, fileIds: string[]) {
  if (fileIds.length === 0 || !hasTable(schema, 'Comment')) return

  if (hasColumn(schema, 'Comment', 'deliverableFileId') && hasColumn(schema, 'Comment', 'fileId')) {
    await tx.$executeRaw`
      DELETE FROM "Comment"
      WHERE "deliverableFileId" IN (${Prisma.join(fileIds)})
         OR "fileId" IN (${Prisma.join(fileIds)})
    `
    return
  }

  if (hasColumn(schema, 'Comment', 'deliverableFileId')) {
    await tx.$executeRaw`
      DELETE FROM "Comment"
      WHERE "deliverableFileId" IN (${Prisma.join(fileIds)})
    `
  }
}

async function unlinkInvoicesForTasks(tx: Tx, schema: SchemaSupport, taskIds: string[]) {
  if (taskIds.length === 0 || !hasTable(schema, 'Invoice') || !hasColumn(schema, 'Invoice', 'briefId')) return

  await tx.$executeRaw`
    UPDATE "Invoice"
    SET "briefId" = NULL
    WHERE "briefId" IN (${Prisma.join(taskIds)})
  `
}

async function unlinkInvoicesForProject(tx: Tx, schema: SchemaSupport, projectId: string, taskIds: string[]) {
  if (!hasTable(schema, 'Invoice')) return

  const hasCampaignId = hasColumn(schema, 'Invoice', 'campaignId')
  const hasBriefId = hasColumn(schema, 'Invoice', 'briefId')

  if (hasCampaignId && hasBriefId && taskIds.length > 0) {
    await tx.$executeRaw`
      UPDATE "Invoice"
      SET "campaignId" = NULL,
          "briefId" = NULL
      WHERE "campaignId" = ${projectId}
         OR "briefId" IN (${Prisma.join(taskIds)})
    `
    return
  }

  if (hasCampaignId) {
    await tx.$executeRaw`
      UPDATE "Invoice"
      SET "campaignId" = NULL
      WHERE "campaignId" = ${projectId}
    `
  }

  if (hasBriefId && taskIds.length > 0) {
    await tx.$executeRaw`
      UPDATE "Invoice"
      SET "briefId" = NULL
      WHERE "briefId" IN (${Prisma.join(taskIds)})
    `
  }
}

async function deleteTasksByIdWithSchema(tx: Tx, schema: SchemaSupport, taskIds: string[]) {
  const ids = [...new Set(taskIds)].filter(Boolean)
  if (ids.length === 0 || !hasTable(schema, 'Task')) return

  const submissionIds = await findTaskSubmissionIds(tx, schema, ids)
  await unlinkInvoicesForTasks(tx, schema, ids)
  await deleteCommentsForFileIds(tx, schema, submissionIds)

  if (hasTable(schema, 'CalendarEvent') && hasColumn(schema, 'CalendarEvent', 'taskId')) {
    await tx.$executeRaw`
      UPDATE "CalendarEvent"
      SET "taskId" = NULL
      WHERE "taskId" IN (${Prisma.join(ids)})
    `
  }

  if (hasTable(schema, 'Activity') && hasColumn(schema, 'Activity', 'taskId')) {
    await tx.$executeRaw`
      DELETE FROM "Activity"
      WHERE "taskId" IN (${Prisma.join(ids)})
    `
  }

  if (hasTable(schema, 'TaskDependency')) {
    const hasTaskId = hasColumn(schema, 'TaskDependency', 'taskId')
    const hasDependsOnTaskId = hasColumn(schema, 'TaskDependency', 'dependsOnTaskId')

    if (hasTaskId && hasDependsOnTaskId) {
      await tx.$executeRaw`
        DELETE FROM "TaskDependency"
        WHERE "taskId" IN (${Prisma.join(ids)})
           OR "dependsOnTaskId" IN (${Prisma.join(ids)})
      `
    } else if (hasTaskId) {
      await tx.$executeRaw`
        DELETE FROM "TaskDependency"
        WHERE "taskId" IN (${Prisma.join(ids)})
      `
    }
  }

  if (hasTable(schema, 'Subtask') && hasColumn(schema, 'Subtask', 'taskId')) {
    await tx.$executeRaw`
      DELETE FROM "Subtask"
      WHERE "taskId" IN (${Prisma.join(ids)})
    `
  }

  if (hasTable(schema, 'TaskSubmission') && hasColumn(schema, 'TaskSubmission', 'taskId')) {
    await tx.$executeRaw`
      DELETE FROM "TaskSubmission"
      WHERE "taskId" IN (${Prisma.join(ids)})
    `
  }

  await tx.$executeRaw`
    DELETE FROM "Task"
    WHERE "id" IN (${Prisma.join(ids)})
  `
}

async function deleteDeliverablesById(tx: Tx, schema: SchemaSupport, deliverableIds: string[]) {
  const ids = [...new Set(deliverableIds)].filter(Boolean)
  if (ids.length === 0 || !hasTable(schema, 'Deliverable')) return

  const fileIds = await findDeliverableFileIds(tx, schema, ids)
  await deleteCommentsForDeliverableFiles(tx, schema, fileIds)

  if (hasTable(schema, 'InvoiceItem') && hasColumn(schema, 'InvoiceItem', 'deliverableId')) {
    await tx.$executeRaw`
      UPDATE "InvoiceItem"
      SET "deliverableId" = NULL
      WHERE "deliverableId" IN (${Prisma.join(ids)})
    `
  }

  if (hasTable(schema, 'ApprovalDecision') && hasColumn(schema, 'ApprovalDecision', 'deliverableId')) {
    await tx.$executeRaw`
      DELETE FROM "ApprovalDecision"
      WHERE "deliverableId" IN (${Prisma.join(ids)})
    `
  }

  if (hasTable(schema, 'DeliverableActivity') && hasColumn(schema, 'DeliverableActivity', 'deliverableId')) {
    await tx.$executeRaw`
      DELETE FROM "DeliverableActivity"
      WHERE "deliverableId" IN (${Prisma.join(ids)})
    `
  }

  if (hasTable(schema, 'DeliverableRevision') && hasColumn(schema, 'DeliverableRevision', 'deliverableId')) {
    await tx.$executeRaw`
      DELETE FROM "DeliverableRevision"
      WHERE "deliverableId" IN (${Prisma.join(ids)})
    `
  }

  if (hasTable(schema, 'DeliverableFile') && hasColumn(schema, 'DeliverableFile', 'deliverableId')) {
    await tx.$executeRaw`
      DELETE FROM "DeliverableFile"
      WHERE "deliverableId" IN (${Prisma.join(ids)})
    `
  }

  await tx.$executeRaw`
    DELETE FROM "Deliverable"
    WHERE "id" IN (${Prisma.join(ids)})
  `
}

export async function deleteTasksById(tx: Tx, taskIds: string[]) {
  const schema = await getDeleteGraphSchemaSupport(tx)
  await deleteTasksByIdWithSchema(tx, schema, taskIds)
}

export async function deleteProjectGraph(tx: Tx, projectId: string) {
  const schema = await getDeleteGraphSchemaSupport(tx)

  const [taskIds, deliverableIds, briefIds, projectMediaIds] = await Promise.all([
    findTaskIdsForProject(tx, schema, projectId),
    findIdsByProject(tx, schema, 'Deliverable', 'campaignId', projectId),
    findIdsByProject(tx, schema, 'Brief', 'campaignId', projectId),
    findIdsByProject(tx, schema, 'ProjectMedia', 'projectId', projectId),
  ])

  await deleteCommentsForFileIds(tx, schema, projectMediaIds)
  await unlinkInvoicesForProject(tx, schema, projectId, taskIds)
  await deleteTasksByIdWithSchema(tx, schema, taskIds)
  await deleteDeliverablesById(tx, schema, deliverableIds)

  if (briefIds.length > 0 && hasTable(schema, 'DeliverableActivity') && hasColumn(schema, 'DeliverableActivity', 'briefId')) {
    await tx.$executeRaw`
      DELETE FROM "DeliverableActivity"
      WHERE "briefId" IN (${Prisma.join(briefIds)})
    `
  }

  if (briefIds.length > 0 && hasTable(schema, 'Brief')) {
    await tx.$executeRaw`
      DELETE FROM "Brief"
      WHERE "id" IN (${Prisma.join(briefIds)})
    `
  }

  if (hasTable(schema, 'CalendarEvent') && hasColumn(schema, 'CalendarEvent', 'projectId')) {
    await tx.$executeRaw`
      DELETE FROM "CalendarEvent"
      WHERE "projectId" = ${projectId}
    `
  }

  if (hasTable(schema, 'ProjectCamera') && hasColumn(schema, 'ProjectCamera', 'projectId')) {
    await tx.$executeRaw`
      DELETE FROM "ProjectCamera"
      WHERE "projectId" = ${projectId}
    `
  }

  if (hasTable(schema, 'ProjectCameraMedia') && hasColumn(schema, 'ProjectCameraMedia', 'projectId')) {
    await tx.$executeRaw`
      DELETE FROM "ProjectCameraMedia"
      WHERE "projectId" = ${projectId}
    `
  }

  if (hasTable(schema, 'ProjectMedia') && hasColumn(schema, 'ProjectMedia', 'projectId')) {
    await tx.$executeRaw`
      DELETE FROM "ProjectMedia"
      WHERE "projectId" = ${projectId}
    `
  }

  await tx.$executeRaw`
    DELETE FROM "Project"
    WHERE "id" = ${projectId}
  `
}

export async function deleteClientGraph(tx: Tx, clientId: string) {
  const schema = await getDeleteGraphSchemaSupport(tx)

  if (hasTable(schema, 'Project') && hasColumn(schema, 'Project', 'clientId')) {
    await tx.$executeRaw`
      UPDATE "Project"
      SET "clientId" = NULL
      WHERE "clientId" = ${clientId}
    `
  }

  if (hasTable(schema, 'Invoice') && hasColumn(schema, 'Invoice', 'clientId')) {
    await tx.$executeRaw`
      UPDATE "Invoice"
      SET "clientId" = NULL
      WHERE "clientId" = ${clientId}
    `
  }

  if (hasTable(schema, 'Brief') && hasColumn(schema, 'Brief', 'clientId')) {
    await tx.$executeRaw`
      UPDATE "Brief"
      SET "clientId" = NULL
      WHERE "clientId" = ${clientId}
    `
  }

  if (hasTable(schema, 'ApprovalDecision') && hasColumn(schema, 'ApprovalDecision', 'clientId')) {
    await tx.$executeRaw`
      UPDATE "ApprovalDecision"
      SET "clientId" = NULL
      WHERE "clientId" = ${clientId}
    `
  }

  if (hasTable(schema, 'ClientActivity') && hasColumn(schema, 'ClientActivity', 'clientId')) {
    await tx.$executeRaw`
      DELETE FROM "ClientActivity"
      WHERE "clientId" = ${clientId}
    `
  }

  await tx.$executeRaw`
    DELETE FROM "Client"
    WHERE "id" = ${clientId}
  `
}

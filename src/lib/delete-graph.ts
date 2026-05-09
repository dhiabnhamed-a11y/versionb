import type { Prisma } from '@prisma/client'

type Tx = Prisma.TransactionClient

type DeleteProjectGraphOptions = {
  hasCameraMediaTable?: boolean
  hasCameraTable?: boolean
  hasProjectMediaTable?: boolean
}

export async function deleteTasksById(tx: Tx, taskIds: string[]) {
  const ids = [...new Set(taskIds)].filter(Boolean)
  if (ids.length === 0) return

  const submissions = await tx.taskSubmission.findMany({
    where: { taskId: { in: ids } },
    select: { id: true },
  })
  const submissionIds = submissions.map((submission) => submission.id)

  await tx.invoice.updateMany({
    where: { briefId: { in: ids } },
    data: { briefId: null },
  })

  if (submissionIds.length > 0) {
    await tx.comment.deleteMany({ where: { fileId: { in: submissionIds } } })
  }

  await tx.calendarEvent.updateMany({
    where: { taskId: { in: ids } },
    data: { taskId: null },
  })
  await tx.activity.deleteMany({ where: { taskId: { in: ids } } })
  await tx.taskDependency.deleteMany({
    where: {
      OR: [{ taskId: { in: ids } }, { dependsOnTaskId: { in: ids } }],
    },
  })
  await tx.subtask.deleteMany({ where: { taskId: { in: ids } } })
  await tx.taskSubmission.deleteMany({ where: { taskId: { in: ids } } })
  await tx.task.deleteMany({ where: { id: { in: ids } } })
}

export async function deleteProjectGraph(tx: Tx, projectId: string, options: DeleteProjectGraphOptions = {}) {
  const hasCameraMediaTable = options.hasCameraMediaTable ?? true
  const hasCameraTable = options.hasCameraTable ?? true
  const hasProjectMediaTable = options.hasProjectMediaTable ?? true
  const [tasks, deliverables, briefs, projectMedia] = await Promise.all([
    tx.task.findMany({ where: { projectId }, select: { id: true } }),
    tx.deliverable.findMany({ where: { campaignId: projectId }, select: { id: true } }),
    tx.brief.findMany({ where: { campaignId: projectId }, select: { id: true } }),
    hasProjectMediaTable ? tx.projectMedia.findMany({ where: { projectId }, select: { id: true } }) : Promise.resolve([]),
  ])

  const taskIds = tasks.map((task) => task.id)
  const deliverableIds = deliverables.map((deliverable) => deliverable.id)
  const briefIds = briefs.map((brief) => brief.id)
  const projectMediaIds = projectMedia.map((media) => media.id)

  if (projectMediaIds.length > 0) {
    await tx.comment.deleteMany({ where: { fileId: { in: projectMediaIds } } })
  }

  await tx.invoice.updateMany({
    where: {
      OR: [{ campaignId: projectId }, ...(taskIds.length > 0 ? [{ briefId: { in: taskIds } }] : [])],
    },
    data: { campaignId: null, briefId: null },
  })

  await deleteTasksById(tx, taskIds)

  if (deliverableIds.length > 0) {
    const deliverableFiles = await tx.deliverableFile.findMany({
      where: { deliverableId: { in: deliverableIds } },
      select: { id: true },
    })
    const deliverableFileIds = deliverableFiles.map((file) => file.id)

    if (deliverableFileIds.length > 0) {
      await tx.comment.deleteMany({
        where: {
          OR: [{ deliverableFileId: { in: deliverableFileIds } }, { fileId: { in: deliverableFileIds } }],
        },
      })
    }

    await tx.invoiceItem.updateMany({
      where: { deliverableId: { in: deliverableIds } },
      data: { deliverableId: null },
    })
    await tx.approvalDecision.deleteMany({ where: { deliverableId: { in: deliverableIds } } })
    await tx.deliverableActivity.deleteMany({ where: { deliverableId: { in: deliverableIds } } })
    await tx.deliverableRevision.deleteMany({ where: { deliverableId: { in: deliverableIds } } })
    await tx.deliverableFile.deleteMany({ where: { deliverableId: { in: deliverableIds } } })
    await tx.deliverable.deleteMany({ where: { id: { in: deliverableIds } } })
  }

  if (briefIds.length > 0) {
    await tx.deliverableActivity.deleteMany({ where: { briefId: { in: briefIds } } })
    await tx.brief.deleteMany({ where: { id: { in: briefIds } } })
  }

  await tx.calendarEvent.deleteMany({ where: { projectId } })
  if (hasCameraTable) {
    await tx.projectCamera.deleteMany({ where: { projectId } })
  }
  if (hasCameraMediaTable) {
    await tx.projectCameraMedia.deleteMany({ where: { projectId } })
  }
  if (hasProjectMediaTable) {
    await tx.projectMedia.deleteMany({ where: { projectId } })
  }
  await tx.project.delete({ where: { id: projectId } })
}

export async function deleteClientGraph(tx: Tx, clientId: string) {
  await tx.project.updateMany({
    where: { clientId },
    data: { clientId: null },
  })
  await tx.invoice.updateMany({
    where: { clientId },
    data: { clientId: null },
  })
  await tx.brief.updateMany({
    where: { clientId },
    data: { clientId: null },
  })
  await tx.approvalDecision.updateMany({
    where: { clientId },
    data: { clientId: null },
  })
  await tx.clientActivity.deleteMany({ where: { clientId } })
  await tx.client.delete({ where: { id: clientId } })
}

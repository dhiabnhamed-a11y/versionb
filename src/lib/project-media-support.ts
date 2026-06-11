import { tenantQueryRaw } from '@/lib/tenant/tenant-raw-query';
import { prisma } from '@/lib/db'

type ProjectMediaSupport = {
  hasProjectMediaTable: boolean
  hasTaskSubmissionCloudinaryColumns: boolean
}

const globalForProjectMediaSupport = globalThis as typeof globalThis & {
  projectMediaSupportPromise?: Promise<ProjectMediaSupport>
}

export async function getProjectMediaSupport(): Promise<ProjectMediaSupport> {
  if (!globalForProjectMediaSupport.projectMediaSupportPromise) {
    globalForProjectMediaSupport.projectMediaSupportPromise = (async () => {
      try {
        const [tables, columns] = await Promise.all([
          tenantQueryRaw<Array<{ table_name: string }>>`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = current_schema()
              AND table_name = 'ProjectMedia'
          `,
          tenantQueryRaw<Array<{ column_name: string }>>`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = current_schema()
              AND table_name = 'TaskSubmission'
              AND column_name IN ('mediaType', 'fileSize', 'duration', 'thumbnailUrl', 'playbackUrl', 'cloudinaryPublicId')
          `,
        ])
        const columnNames = new Set(columns.map((column) => column.column_name))

        return {
          hasProjectMediaTable: tables.some((table) => table.table_name === 'ProjectMedia'),
          hasTaskSubmissionCloudinaryColumns: [
            'mediaType',
            'fileSize',
            'duration',
            'thumbnailUrl',
            'playbackUrl',
            'cloudinaryPublicId',
          ].every((column) => columnNames.has(column)),
        }
      } catch (error) {
        console.warn('[project-media-support] Falling back to media-disabled compatibility mode.', error)
        return {
          hasProjectMediaTable: false,
          hasTaskSubmissionCloudinaryColumns: false,
        }
      }
    })()
  }

  return globalForProjectMediaSupport.projectMediaSupportPromise
}


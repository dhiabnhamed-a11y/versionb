import { prisma } from '@/lib/db'

type CameraTypeValue = 'device' | 'external'

type ProjectCameraSupport = {
  hasCameraColumns: boolean
  hasCameraTable: boolean
  hasCameraMediaTable: boolean
  hasCameraTypeEnum: boolean
}

type ProjectWithOptionalCameraFields = {
  [key: string]: unknown
  hasCamera?: boolean | null
  cameraType?: CameraTypeValue | null
}

const globalForProjectCameraSupport = globalThis as typeof globalThis & {
  projectCameraSupportPromise?: Promise<ProjectCameraSupport>
}

export async function getProjectCameraSupport(): Promise<ProjectCameraSupport> {
  if (!globalForProjectCameraSupport.projectCameraSupportPromise) {
    globalForProjectCameraSupport.projectCameraSupportPromise = (async () => {
      try {
        const [columns, tables, enums] = await Promise.all([
          tenantQueryRaw<Array<{ column_name: string }>>`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = current_schema()
              AND table_name = 'Project'
              AND column_name IN ('hasCamera', 'cameraType')
          `,
          tenantQueryRaw<Array<{ table_name: string }>>`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = current_schema()
              AND table_name IN ('ProjectCamera', 'ProjectCameraMedia')
          `,
          tenantQueryRaw<Array<{ typname: string }>>`
            SELECT t.typname
            FROM pg_type t
            JOIN pg_namespace n ON n.oid = t.typnamespace
            WHERE n.nspname = current_schema()
              AND t.typname = 'CameraType'
          `,
        ])

        const columnNames = new Set(columns.map((column) => column.column_name))
        const hasCameraTypeEnum = enums.some((entry) => entry.typname === 'CameraType')

        return {
          hasCameraColumns: columnNames.has('hasCamera') && columnNames.has('cameraType') && hasCameraTypeEnum,
          hasCameraTable: tables.some((table) => table.table_name === 'ProjectCamera'),
          hasCameraMediaTable: tables.some((table) => table.table_name === 'ProjectCameraMedia'),
          hasCameraTypeEnum,
        }
      } catch (error) {
        console.warn('[project-camera-support] Falling back to camera-disabled compatibility mode.', error)
        return {
          hasCameraColumns: false,
          hasCameraTable: false,
          hasCameraMediaTable: false,
          hasCameraTypeEnum: false,
        }
      }
    })()
  }

  return globalForProjectCameraSupport.projectCameraSupportPromise
}

export function withProjectCameraDefaults<T extends ProjectWithOptionalCameraFields>(
  project: T
): Omit<T, 'hasCamera' | 'cameraType'> & { hasCamera: boolean; cameraType: CameraTypeValue } {
  return {
    ...project,
    hasCamera: project.hasCamera ?? false,
    cameraType: project.cameraType === 'external' ? 'external' : 'device',
  }
}

export function isProjectCameraEnumCompatibilityError(error: unknown) {
  if (!(error instanceof Error)) {
    return false
  }

  const message = error.message

  return (
    message.includes('type "public.CameraType" does not exist') ||
    message.includes('type "CameraType" does not exist') ||
    message.includes("Attempted to serialize non-enum-compatible value 'null' for enum 'CameraType'") ||
    (message.includes('non-enum-compatible value') && message.includes('CameraType')) ||
    message.includes('Error converting field "cameraType"') ||
    message.includes('Error converting field "hasCamera"') ||
    message.includes('Failed to deserialize column of type') ||
    message.includes('column "cameraType"') ||
    message.includes('column "hasCamera"')
  )
}

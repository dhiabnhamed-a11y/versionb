import { prisma } from '@/lib/db'

type CameraTypeValue = 'device' | 'external'

type ProjectCameraSupport = {
  hasCameraColumns: boolean
  hasCameraMediaTable: boolean
}

type ProjectWithOptionalCameraFields = {
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
        const [columns, tables] = await Promise.all([
          prisma.$queryRaw<Array<{ column_name: string }>>`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = current_schema()
              AND table_name = 'Project'
              AND column_name IN ('hasCamera', 'cameraType')
          `,
          prisma.$queryRaw<Array<{ table_name: string }>>`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = current_schema()
              AND table_name = 'ProjectCameraMedia'
          `,
        ])

        const columnNames = new Set(columns.map((column) => column.column_name))

        return {
          hasCameraColumns: columnNames.has('hasCamera') && columnNames.has('cameraType'),
          hasCameraMediaTable: tables.some((table) => table.table_name === 'ProjectCameraMedia'),
        }
      } catch (error) {
        console.warn('[project-camera-support] Falling back to camera-disabled compatibility mode.', error)
        return {
          hasCameraColumns: false,
          hasCameraMediaTable: false,
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

  return (
    error.message.includes('type "public.CameraType" does not exist') ||
    error.message.includes('type "CameraType" does not exist') ||
    error.message.includes("Attempted to serialize non-enum-compatible value 'null' for enum 'CameraType'") ||
    error.message.includes('non-enum-compatible value') && error.message.includes('CameraType')
  )
}

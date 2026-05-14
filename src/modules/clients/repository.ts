import { prisma } from '@/lib/db'

export { findClientForCompany, logClientActivity } from '@/lib/clients'

export const clientRepository = {
  prisma,
}

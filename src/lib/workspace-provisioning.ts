import { Prisma } from '@prisma/client'

import { isErpWorkspaceType, normalizeCompanyType, type CompanyType } from '@/lib/company-types'
import { getWorkspaceBlueprint } from '@/lib/workspace-routing'
import { ensureErpWorkspaceInitialized } from '@/services/erp2/setup.service'
import { provisionEnterpriseOperationsWorkspace } from '@/modules/enterprise/enterprise-onboarding'

type TransactionClient = Prisma.TransactionClient

export type ProvisionWorkspaceInput = {
  companyId: string
  ownerId: string
  companyType: CompanyType
}

export async function provisionWorkspaceForCompany(tx: TransactionClient, input: ProvisionWorkspaceInput) {
  const companyType = normalizeCompanyType(input.companyType)
  const blueprint = getWorkspaceBlueprint(companyType)

  const enterprise = await provisionEnterpriseOperationsWorkspace(tx, {
    companyId: input.companyId,
    ownerId: input.ownerId,
    companyType,
  })

  const erp = isErpWorkspaceType(companyType)
    ? await ensureErpWorkspaceInitialized(tx, input.companyId)
    : null

  await tx.auditLog.create({
    data: {
      companyId: input.companyId,
      actorId: input.ownerId,
      action: 'workspace.provisioned',
      entityType: 'workspace',
      entityId: input.companyId,
      after: {
        companyType,
        shell: blueprint.shell,
        surface: blueprint.surface,
        homePath: blueprint.homePath,
        modules: blueprint.modules,
        aiContext: blueprint.aiContext,
        enterprise,
        erp,
      },
      metadata: {
        source: 'signup_onboarding',
        provisioner: 'workspace_provisioning_v1',
      },
    },
  })

  return {
    companyType,
    homePath: blueprint.homePath,
    shell: blueprint.shell,
    modules: blueprint.modules,
    enterprise,
    erp,
  }
}

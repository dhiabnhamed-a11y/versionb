import test from 'node:test'
import assert from 'node:assert/strict'

import {
  getCompanyTypeFromSlug,
  getCompanyTypeSlug,
} from '@/lib/company-types'
import {
  getWorkspaceApiAccessError,
  getWorkspaceHomePath,
  getWorkspaceRouteRedirect,
  getWorkspaceSurface,
} from '@/lib/workspace-routing'

test('workspace home path is driven by workspace type before generic role dashboards', () => {
  assert.equal(getWorkspaceHomePath({ role: 'OWNER', companyType: 'ERP_WORKSPACE' }), '/erp')
  assert.equal(getWorkspaceHomePath({ role: 'EMPLOYEE', companyType: 'ERP_WORKSPACE' }), '/erp')
  assert.equal(getWorkspaceHomePath({ role: 'OWNER', companyType: 'DIGITAL_AGENCY' }), '/dashboard/admin')
  assert.equal(getWorkspaceHomePath({ role: 'EMPLOYEE', companyType: 'DIGITAL_AGENCY' }), '/dashboard/employee')
  assert.equal(getWorkspaceHomePath({ role: 'SUPER_ADMIN', companyType: 'ERP_WORKSPACE' }), '/dashboard/super-admin')
})

test('workspace route guard prevents ERP users from landing in generic dashboard shells', () => {
  assert.deepEqual(
    getWorkspaceRouteRedirect('/dashboard/admin', { role: 'OWNER', companyType: 'ERP_WORKSPACE' }),
    { destination: '/erp', reason: 'erp_workspace_requires_erp_shell' }
  )
  assert.deepEqual(
    getWorkspaceRouteRedirect('/dashboard/profile', { role: 'OWNER', companyType: 'ERP_WORKSPACE' }),
    { destination: '/erp/profile', reason: 'erp_profile_shell_required' }
  )
  assert.deepEqual(
    getWorkspaceRouteRedirect('/erp', { role: 'OWNER', companyType: 'DIGITAL_AGENCY' }),
    { destination: '/dashboard/admin', reason: 'non_erp_workspace_cannot_use_erp_shell' }
  )
  assert.equal(getWorkspaceRouteRedirect('/erp/general-ledger', { role: 'OWNER', companyType: 'ERP_WORKSPACE' }), null)
})

test('workspace api guard isolates dedicated backend surfaces', () => {
  assert.equal(getWorkspaceApiAccessError('/api/v1/erp2/setup', { companyType: 'DIGITAL_AGENCY' }), 'ERP APIs are only available inside ERP workspaces.')
  assert.equal(getWorkspaceApiAccessError('/api/v1/erp2/setup', { companyType: 'ERP_WORKSPACE' }), null)
  assert.equal(getWorkspaceApiAccessError('/api/enterprise/assets', { companyType: 'OTHER' }), 'Enterprise operations APIs are only available for enterprise, healthcare, and IT operations workspaces.')
  assert.equal(getWorkspaceApiAccessError('/api/enterprise/assets', { companyType: 'HEALTHCARE' }), null)
})

test('workspace surface maps company types to product experiences', () => {
  assert.equal(getWorkspaceSurface('ERP_WORKSPACE'), 'erp')
  assert.equal(getWorkspaceSurface('CLINIC_HOSPITAL'), 'healthcare')
  assert.equal(getWorkspaceSurface('CONTENT_CREATION_AGENCY'), 'agency')
  assert.equal(getWorkspaceSurface('CORPORATE_IT_OPERATIONS'), 'enterprise')
})

test('company type slug parsing accepts canonical slugs and enum-style query values', () => {
  assert.equal(getCompanyTypeSlug('ERP_WORKSPACE'), 'erp-workspace')
  assert.equal(getCompanyTypeFromSlug('erp-workspace'), 'ERP_WORKSPACE')
  assert.equal(getCompanyTypeFromSlug('erp_workspace'), 'ERP_WORKSPACE')
  assert.equal(getCompanyTypeFromSlug('ERP_WORKSPACE'), 'ERP_WORKSPACE')
})

import type { CompanyType } from '@/lib/company-types'
import type { TranslationKey } from '@/lib/i18n'

type Translator = (key: TranslationKey) => string

export type LocalizedCompanyCopy = {
  workspaceLabel: string
  projectLabel: string
  projectPluralLabel: string
  taskLabel: string
  taskPluralLabel: string
  groupLabel: string
  groupPluralLabel: string
}

export function getLocalizedCompanyCopy(type: CompanyType, t: Translator): LocalizedCompanyCopy {
  if (type === 'INDUSTRY') {
    return {
      workspaceLabel: t('workspace.operations'),
      projectLabel: t('entity.project'),
      projectPluralLabel: t('entity.projects'),
      taskLabel: t('entity.task'),
      taskPluralLabel: t('entity.tasks'),
      groupLabel: t('entity.room'),
      groupPluralLabel: t('entity.rooms'),
    }
  }

  if (type === 'DIGITAL_AGENCY') {
    return {
      workspaceLabel: t('workspace.agency'),
      projectLabel: t('entity.campaign'),
      projectPluralLabel: t('entity.campaigns'),
      taskLabel: t('entity.brief'),
      taskPluralLabel: t('entity.briefs'),
      groupLabel: t('entity.category'),
      groupPluralLabel: t('entity.categories'),
    }
  }

  if (type === 'CONTENT_CREATION_AGENCY') {
    return {
      workspaceLabel: t('workspace.content'),
      projectLabel: t('entity.campaign'),
      projectPluralLabel: t('entity.campaigns'),
      taskLabel: t('entity.brief'),
      taskPluralLabel: t('entity.briefs'),
      groupLabel: t('entity.category'),
      groupPluralLabel: t('entity.categories'),
    }
  }

  return {
    workspaceLabel: t('workspace.standard'),
    projectLabel: t('entity.project'),
    projectPluralLabel: t('entity.projects'),
    taskLabel: t('entity.task'),
    taskPluralLabel: t('entity.tasks'),
    groupLabel: t('entity.workspace'),
    groupPluralLabel: t('entity.workspaces'),
  }
}

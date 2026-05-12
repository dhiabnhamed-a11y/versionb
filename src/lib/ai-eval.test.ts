import { resolveIntent, type AIEntity, type AILanguage, type IntentRecordCandidate, type IntentType } from '@/lib/ai-intent'

type EvalResult = 'PERMISSION_DENIED' | 'AMBIGUITY_PANEL' | 'CONFIRMATION_PANEL'

type EvalCase = {
  input: string
  role?: 'OWNER' | 'MANAGER' | 'EMPLOYEE'
  expected_intent?: IntentType
  expected_entity?: AIEntity
  expected_lang?: AILanguage
  expected_result?: EvalResult
}

export const EVAL_CASES: EvalCase[] = [
  { input: 'delet invoce #142', expected_intent: 'DELETE_RECORD', expected_entity: 'invoice' },
  { input: 'mak invoice paid', expected_intent: 'MARK_PAID', expected_entity: 'invoice' },
  { input: 'creat campain for cliend acme', expected_intent: 'CREATE_RECORD', expected_entity: 'campaign' },
  { input: 'del camp spring', expected_intent: 'DELETE_RECORD', expected_entity: 'campaign' },
  { input: 'upd inv due', expected_intent: 'UPDATE_RECORD', expected_entity: 'invoice' },
  { input: 'show all revenue', role: 'EMPLOYEE', expected_result: 'PERMISSION_DENIED' },
  { input: 'إنشاء فاتورة للعميل أكمي', expected_intent: 'CREATE_RECORD', expected_entity: 'invoice', expected_lang: 'ar' },
  { input: 'احذف الحملة', expected_intent: 'DELETE_RECORD', expected_entity: 'campaign', expected_lang: 'ar' },
  { input: 'créer une campagne pour le client Dupont', expected_intent: 'CREATE_RECORD', expected_entity: 'campaign', expected_lang: 'fr' },
  { input: 'supprimer la facture', expected_intent: 'DELETE_RECORD', expected_entity: 'invoice', expected_lang: 'fr' },
  { input: 'delete campaign spring', expected_result: 'AMBIGUITY_PANEL' },
  { input: 'delete client acme', expected_result: 'CONFIRMATION_PANEL' },
]

const EVAL_RECORDS: IntentRecordCandidate[] = [
  { id: 'campaign-spring-launch', entity: 'campaign', label: 'Spring Launch', details: 'Client: Acme' },
  { id: 'campaign-spring-sale', entity: 'campaign', label: 'Spring Sale', details: 'Client: Dupont' },
  { id: 'client-acme', entity: 'client', label: 'Acme', details: 'Client' },
]

function expectedOutcome(input: EvalCase): EvalResult | null {
  const resolved = resolveIntent(input.input, { records: EVAL_RECORDS })
  if (input.role === 'EMPLOYEE' && /\brevenue\b/i.test(input.input)) return 'PERMISSION_DENIED'
  if (resolved.ambiguous) return 'AMBIGUITY_PANEL'
  if (resolved.params.requiresConfirmation === true) return 'CONFIRMATION_PANEL'
  return null
}

export function runAiIntentEval() {
  const failures: string[] = []

  for (const testCase of EVAL_CASES) {
    const resolved = resolveIntent(testCase.input, { records: EVAL_RECORDS })
    const outcome = expectedOutcome(testCase)

    if (testCase.expected_intent && resolved.type !== testCase.expected_intent) {
      failures.push(`${testCase.input}: expected intent ${testCase.expected_intent}, received ${resolved.type}`)
    }

    if (testCase.expected_entity && resolved.entity !== testCase.expected_entity) {
      failures.push(`${testCase.input}: expected entity ${testCase.expected_entity}, received ${resolved.entity ?? 'none'}`)
    }

    if (testCase.expected_lang && resolved.language !== testCase.expected_lang) {
      failures.push(`${testCase.input}: expected language ${testCase.expected_lang}, received ${resolved.language}`)
    }

    if (testCase.expected_result && outcome !== testCase.expected_result) {
      failures.push(`${testCase.input}: expected result ${testCase.expected_result}, received ${outcome ?? 'none'}`)
    }
  }

  return {
    passed: failures.length === 0,
    failures,
    total: EVAL_CASES.length,
  }
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('ai-eval.test.ts')) {
  const result = runAiIntentEval()
  if (!result.passed) {
    console.error(`AI eval failed (${result.failures.length}/${result.total})`)
    for (const failure of result.failures) console.error(`- ${failure}`)
    process.exit(1)
  }

  console.log(`AI eval passed (${result.total}/${result.total})`)
}

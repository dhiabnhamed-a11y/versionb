import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createCheckoutSession, type DodoClient } from '@/lib/dodo'
import { calculateWorkspacePrice, type BillingInterval } from '@/lib/pricing'

function createMockDodoClient(calls: unknown[]) {
  return {
    checkoutSessions: {
      create: async (body: unknown) => {
        calls.push(body)
        return { checkout_url: 'https://checkout.test/session', session_id: 'cs_test' }
      },
    },
    customers: {},
    payments: {},
    subscriptions: {},
    webhooks: {},
  } as DodoClient
}

const cases: Array<{
  interval: BillingInterval
  quantity: number
  workspaceId: string
}> = [
  { interval: 'monthly', quantity: 3, workspaceId: 'operations' },
  { interval: 'annual', quantity: 3, workspaceId: 'operations' },
  { interval: 'lifetime', quantity: 3, workspaceId: 'operations' },
  { interval: 'monthly', quantity: 10, workspaceId: 'enterprise_ops' },
  { interval: 'annual', quantity: 10, workspaceId: 'enterprise_ops' },
  { interval: 'lifetime', quantity: 10, workspaceId: 'enterprise_ops' },
  { interval: 'monthly', quantity: 40, workspaceId: 'erp' },
  { interval: 'annual', quantity: 40, workspaceId: 'erp' },
  { interval: 'lifetime', quantity: 40, workspaceId: 'erp' },
]

describe('createCheckoutSession', () => {
  for (const testCase of cases) {
    it(`creates ${testCase.workspaceId} ${testCase.interval} checkout`, async () => {
      const calls: unknown[] = []
      const result = await createCheckoutSession(
        {
          cancelUrl: 'https://app.test/signup?step=workspace',
          customerEmail: 'buyer@example.com',
          customerName: 'Buyer',
          interval: testCase.interval,
          quantity: testCase.quantity,
          successUrl: 'https://app.test/onboarding/success',
          workspaceId: testCase.workspaceId,
        },
        createMockDodoClient(calls)
      )
      const body = calls[0] as {
        metadata: Record<string, string>
        product_cart: Array<{ amount?: number; product_id: string; quantity: number }>
        subscription_data?: { trial_period_days: number }
      }
      const expected = calculateWorkspacePrice(testCase)

      assert.equal(result.url, 'https://checkout.test/session')
      assert.equal(result.total, expected.total)
      assert.equal(body.metadata.workspace_id, testCase.workspaceId)
      assert.equal(body.metadata.interval, testCase.interval)
      assert.equal(body.metadata.total_usd, String(expected.total))
      assert.equal(body.product_cart[0].quantity, expected.billableQuantity)
      assert.match(body.product_cart[0].product_id, new RegExp(`${testCase.workspaceId}_${testCase.interval}$`))

      if (testCase.interval === 'lifetime') {
        assert.equal(body.subscription_data, undefined)
        assert.equal(body.product_cart[0].amount, expected.total * 100)
      } else {
        assert.deepEqual(body.subscription_data, { trial_period_days: 0 })
        assert.equal(body.product_cart[0].amount, undefined)
      }
    })
  }
})

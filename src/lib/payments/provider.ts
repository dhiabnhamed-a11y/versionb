import type { PaymentProviderName, PaymentProviderAdapter } from './types'
import { StripeAdapter } from './stripe-adapter'
import { DodoAdapter } from './dodo-adapter'

const adapters = new Map<PaymentProviderName, PaymentProviderAdapter>()

export function getPrimaryProvider(): PaymentProviderName {
  const provider = (process.env.PAYMENT_PROVIDER || 'stripe') as PaymentProviderName
  if (provider !== 'stripe' && provider !== 'dodo') {
    console.warn(`Invalid PAYMENT_PROVIDER "${provider}". Falling back to "stripe".`)
    return 'stripe'
  }
  return provider
}

export function getPaymentAdapter(provider?: PaymentProviderName): PaymentProviderAdapter {
  const name = provider ?? getPrimaryProvider()
  let adapter = adapters.get(name)
  if (!adapter) {
    switch (name) {
      case 'stripe':
        adapter = new StripeAdapter()
        break
      case 'dodo':
        adapter = new DodoAdapter()
        break
      default:
        throw new Error(`Unknown payment provider: ${name}`)
    }
    adapters.set(name, adapter)
  }
  return adapter
}

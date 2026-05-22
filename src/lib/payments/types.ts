export type PaymentProviderName = 'stripe' | 'dodo'

export type CheckoutSessionParams = {
  planKey: string
  seats: number
  companyId: string
  companyName: string
  customerEmail: string
  customerName: string
  returnUrl: string
}

export type CheckoutSessionResult = {
  url: string
}

export type PortalSessionParams = {
  companyId: string
  returnUrl: string
}

export type PortalSessionResult = {
  url: string
}

export interface PaymentProviderAdapter {
  readonly name: PaymentProviderName
  createCheckoutSession(params: CheckoutSessionParams): Promise<CheckoutSessionResult>
  createPortalSession(params: PortalSessionParams): Promise<PortalSessionResult>
}

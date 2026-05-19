export const PLANS = {
  STARTER_MONTHLY: {
    name: 'Starter',
    pricePerSeat: 3,
    interval: 'monthly' as const,
    stripePriceId: process.env.STRIPE_PRICE_MONTHLY,
    minSeats: 1,
    maxSeats: 49,
  },
  STARTER_YEARLY: {
    name: 'Starter (Annual)',
    pricePerSeat: 3,
    interval: 'yearly' as const,
    stripePriceId: process.env.STRIPE_PRICE_YEARLY,
    minSeats: 1,
    maxSeats: 49,
    savings: '2 months free',
  },
  TEAM_MONTHLY: {
    name: 'Team',
    pricePerSeat: 2.5,
    interval: 'monthly' as const,
    stripePriceId: process.env.STRIPE_PRICE_TEAM_MONTHLY,
    minSeats: 50,
    maxSeats: null,
  },
  LIFETIME: {
    name: 'Lifetime',
    pricePerSeat: 99,
    interval: 'lifetime' as const,
    stripePriceId: process.env.STRIPE_PRICE_LIFETIME,
    minSeats: 1,
    maxSeats: null,
    oneTime: true,
  },
} as const

export type PlanKey = keyof typeof PLANS

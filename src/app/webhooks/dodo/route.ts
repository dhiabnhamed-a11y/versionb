import { POST as handleDodoWebhook } from '@/app/api/billing/dodo-webhook/route'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const POST = handleDodoWebhook

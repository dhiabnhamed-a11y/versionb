import { POST as handleDodoWebhook } from '@/app/api/webhooks/dodo/route'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const POST = handleDodoWebhook

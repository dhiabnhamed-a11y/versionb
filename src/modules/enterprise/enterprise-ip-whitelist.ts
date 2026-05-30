import { enterpriseRepositoryPrisma } from '@/modules/enterprise/enterprise.repository'
import { forbidden } from '@/modules/shared/errors'

const IP_CACHE = new Map<string, { networks: string[]; expiry: number }>()
const CACHE_TTL = 300_000

function ipToNumber(ip: string): number {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0
}

function cidrToRange(cidr: string): { start: number; end: number } | null {
  const [ip, bits] = cidr.split('/')
  if (!ip || !bits) return null
  const mask = ~(2 ** (32 - parseInt(bits, 10)) - 1)
  const ipNum = ipToNumber(ip)
  return { start: ipNum & mask, end: ipNum | ~mask }
}

export function isIpAllowed(ip: string, allowedNetworks: string[]): boolean {
  if (allowedNetworks.length === 0) return true
  const ipNum = ipToNumber(ip)
  return allowedNetworks.some((network) => {
    const range = cidrToRange(network.trim())
    return range ? ipNum >= range.start && ipNum <= range.end : false
  })
}

export async function checkEnterpriseIpWhitelist(
  companyId: string,
  ip: string | null
): Promise<void> {
  if (!ip || ip === 'unknown' || ip === '127.0.0.1' || ip === '::1') return

  const cached = IP_CACHE.get(companyId)
  if (cached && cached.expiry > Date.now()) {
    if (!isIpAllowed(ip, cached.networks)) {
      throw forbidden('Access denied: IP not in enterprise whitelist.')
    }
    return
  }

  const company = await enterpriseRepositoryPrisma.company.findFirst({
    where: { id: companyId },
    select: { metadata: true },
  })

  if (!company) return

  const metadata = company.metadata as Record<string, unknown> | null
  const networks = (metadata?.enterpriseIpWhitelist as string[]) || []

  IP_CACHE.set(companyId, { networks, expiry: Date.now() + CACHE_TTL })

  if (networks.length > 0 && !isIpAllowed(ip, networks)) {
    throw forbidden('Access denied: IP not in enterprise whitelist.')
  }
}

export function getClientIp(request: { headers: { get: (name: string) => string | null } }): string | null {
  return (
    request.headers.get('cf-connecting-ip')?.trim() ||
    request.headers.get('x-real-ip')?.trim() ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    null
  )
}

export async function updateIpWhitelist(
  companyId: string,
  networks: string[]
): Promise<string[]> {
  const company = await enterpriseRepositoryPrisma.company.findFirst({
    where: { id: companyId },
    select: { id: true, metadata: true },
  })
  if (!company) throw Object.assign(new Error('Company not found.'), { status: 404 })

  const metadata = (company.metadata as Record<string, unknown>) || {}
  metadata.enterpriseIpWhitelist = networks

  await enterpriseRepositoryPrisma.company.update({
    where: { id: companyId },
    data: { metadata: metadata as any },
  })

  IP_CACHE.set(companyId, { networks, expiry: Date.now() + CACHE_TTL })

  return networks
}

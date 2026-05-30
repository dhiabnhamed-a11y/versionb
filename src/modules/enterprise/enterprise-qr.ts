import { enterpriseRepositoryPrisma } from '@/modules/enterprise/enterprise.repository'
import { logger } from '@/modules/shared/logger'

let qrcode: any = null

async function getQrCodeModule() {
  if (!qrcode) {
    qrcode = await import('qrcode')
  }
  return qrcode
}

export async function generateQrCodeSvg(data: string): Promise<string> {
  const qr = await getQrCodeModule()
  return qr.toString(data, { type: 'svg' })
}

export interface AssetQrPayload {
  id: string
  tag: string
  name: string
  companyId: string
}

export function buildAssetQrPayload(asset: { id: string; assetTag: string; name: string; companyId: string }): string {
  return JSON.stringify({
    a: asset.id,
    t: asset.assetTag,
    n: asset.name,
    c: asset.companyId,
  })
}

export async function generateAssetQr(assetId: string): Promise<string | null> {
  const asset = await enterpriseRepositoryPrisma.enterpriseAsset.findFirst({
    where: { id: assetId, deletedAt: null },
    select: { id: true, assetTag: true, name: true, companyId: true, qrCode: true },
  })
  if (!asset) return null

  const payload = buildAssetQrPayload(asset)
  const svg = await generateQrCodeSvg(payload)

  await enterpriseRepositoryPrisma.enterpriseAsset.update({
    where: { id: assetId },
    data: { qrCode: svg },
  })

  logger.info('enterprise.asset_qr_generated', { assetId })
  return svg
}

export async function generateBarcode(assetId: string): Promise<string | null> {
  const asset = await enterpriseRepositoryPrisma.enterpriseAsset.findFirst({
    where: { id: assetId, deletedAt: null },
    select: { id: true, assetTag: true, companyId: true, barcode: true },
  })
  if (!asset) return null

  const barcode = `${asset.companyId.slice(0, 8)}-${asset.assetTag}`

  await enterpriseRepositoryPrisma.enterpriseAsset.update({
    where: { id: assetId },
    data: { barcode },
  })

  return barcode
}

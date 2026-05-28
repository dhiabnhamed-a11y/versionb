export type EmsIntegrationType =
  | 'CAD_MOTOROLA' | 'CAD_HEXAGON' | 'CAD_TYLER' | 'CAD_CENTRAL_SQUARE'
  | 'CAD_ZOLL' | 'CAD_RAPID_SOS' | 'CAD_CUSTOM'
  | 'EHR_EPIC' | 'EHR_CERNER' | 'EHR_ALLSCRIPTS' | 'EHR_MEDITECH' | 'EHR_CUSTOM'
  | 'FHIR' | 'HL7' | 'AVL_GPS' | 'CUSTOM_API' | 'CUSTOM_WEBHOOK'

export type ConnectionStatus = 'CONNECTED' | 'DISCONNECTED' | 'ERROR' | 'PENDING' | 'CONFIGURING'

export interface ConnectorConfig {
  endpointUrl?: string
  authType?: 'oauth2' | 'api_key' | 'basic' | 'certificate' | 'none'
  apiKey?: string
  oauthConfig?: OAuth2Config
  basicAuth?: { username: string; password: string }
  webhookSecret?: string
  pollingEnabled?: boolean
  pollingInterval?: number
  retryCount?: number
  retryDelayMs?: number
  rateLimit?: number
  timeoutMs?: number
  headers?: Record<string, string>
  [key: string]: unknown
}

export interface OAuth2Config {
  clientId: string
  clientSecret: string
  tokenUrl: string
  authorizeUrl?: string
  scopes?: string[]
  redirectUri?: string
}

export interface FieldMappingRule {
  sourceField: string
  targetField: string
  transform?: 'uppercase' | 'lowercase' | 'enum_map' | 'custom' | 'date_format' | 'concat' | 'split'
  transformConfig?: Record<string, unknown>
  defaultValue?: string
  required?: boolean
  validate?: (value: unknown) => boolean
}

export interface EnumMapping {
  [fieldName: string]: Record<string, string>
}

export interface WebhookEventPayload {
  id: string
  eventType: string
  source: string
  receivedAt: string
  headers: Record<string, string>
  raw: unknown
  transformed?: unknown
}

export interface IntegrationEventRecord {
  id: string
  companyId: string
  integrationId: string
  webhookConfigId?: string
  eventType: string
  source: string
  direction: 'inbound' | 'outbound'
  rawPayload: unknown
  transformedPayload?: unknown
  headers?: Record<string, string>
  signature?: string
  status: 'received' | 'processing' | 'completed' | 'failed' | 'rejected'
  statusCode?: number
  errorMessage?: string
  processingTimeMs?: number
  idempotencyKey?: string
  isDuplicate: boolean
  retryCount: number
  receivedAt: string
  processedAt?: string
}

export interface AuditLogEntry {
  companyId: string
  integrationId?: string
  action: string
  actorId?: string
  actorType?: 'user' | 'system' | 'integration' | 'webhook'
  resourceType?: string
  resourceId?: string
  containsPhi: boolean
  phiFields?: string
  description: string
  metadata?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
  success: boolean
  errorMessage?: string
}

export interface ConnectorHealth {
  status: ConnectionStatus
  lastConnectedAt: string | null
  lastErrorAt: string | null
  lastErrorMessage: string | null
  latencyMs: number | null
  uptimePercentage: number | null
  eventsProcessed: number
  eventsFailed: number
}

export interface SyncResult {
  success: boolean
  entityType: string
  recordsProcessed: number
  recordsCreated: number
  recordsUpdated: number
  recordsFailed: number
  errors: string[]
  durationMs: number
}

export const INTEGRATION_TYPE_LABELS: Record<EmsIntegrationType, string> = {
  CAD_MOTOROLA: 'Motorola CAD',
  CAD_HEXAGON: 'Hexagon CAD',
  CAD_TYLER: 'Tyler CAD',
  CAD_CENTRAL_SQUARE: 'CentralSquare CAD',
  CAD_ZOLL: 'Zoll Dispatch',
  CAD_RAPID_SOS: 'RapidSOS',
  CAD_CUSTOM: 'Custom CAD',
  EHR_EPIC: 'Epic EHR',
  EHR_CERNER: 'Cerner EHR',
  EHR_ALLSCRIPTS: 'Allscripts EHR',
  EHR_MEDITECH: 'Meditech EHR',
  EHR_CUSTOM: 'Custom EHR',
  FHIR: 'FHIR R4',
  HL7: 'HL7 v2/v3',
  AVL_GPS: 'AVL/GPS Telemetry',
  CUSTOM_API: 'Custom REST API',
  CUSTOM_WEBHOOK: 'Custom Webhook',
}

export const INTEGRATION_TYPE_GROUPS: Record<string, EmsIntegrationType[]> = {
  CAD: ['CAD_MOTOROLA', 'CAD_HEXAGON', 'CAD_TYLER', 'CAD_CENTRAL_SQUARE', 'CAD_ZOLL', 'CAD_RAPID_SOS', 'CAD_CUSTOM'],
  EHR: ['EHR_EPIC', 'EHR_CERNER', 'EHR_ALLSCRIPTS', 'EHR_MEDITECH', 'EHR_CUSTOM'],
  STANDARDS: ['FHIR', 'HL7'],
  INFRASTRUCTURE: ['AVL_GPS', 'CUSTOM_API', 'CUSTOM_WEBHOOK'],
}

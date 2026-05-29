export const OFFLINE_SESSION_DURATION_MS = 5 * 60 * 60 * 1000
export const WARN_AMBER_MS = 60 * 60 * 1000
export const WARN_RED_MS = 15 * 60 * 1000

export const STORAGE_KEY_SESSION = 'taskit:offline:session_start'
export const STORAGE_KEY_QUEUE = 'taskit:offline:queue'
export const STORAGE_KEY_MANUAL_OFFLINE = 'taskit:offline:manual'

export const IDB_NAME = 'taskit-offline'
export const IDB_STORE = 'queue'
export const IDB_VERSION = 1

export const MAX_QUEUE_RETRIES = 5
export const SYNC_BATCH_SIZE = 10
export const SYNC_RETRY_DELAY_MS = 2000

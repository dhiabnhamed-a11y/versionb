import { IDB_NAME, IDB_STORE, IDB_VERSION, MAX_QUEUE_RETRIES, SYNC_BATCH_SIZE } from './config'
import type { OfflineQueueItem } from './types'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        const store = db.createObjectStore(IDB_STORE, { keyPath: 'id' })
        store.createIndex('timestamp', 'timestamp', { unique: false })
        store.createIndex('synced', 'synced', { unique: false })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

class OfflineQueue {
  private db: IDBDatabase | null = null

  private async ensureDB() {
    if (!this.db) this.db = await openDB()
    return this.db
  }

  async enqueue(type: string, payload: unknown): Promise<OfflineQueueItem> {
    const db = await this.ensureDB()
    const item: OfflineQueueItem = {
      id: crypto.randomUUID(),
      type,
      payload,
      timestamp: Date.now(),
      retryCount: 0,
    }
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite')
      tx.objectStore(IDB_STORE).add(item)
      tx.oncomplete = () => resolve(item)
      tx.onerror = () => reject(tx.error)
    })
  }

  async getAll(): Promise<OfflineQueueItem[]> {
    const db = await this.ensureDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly')
      const req = tx.objectStore(IDB_STORE).index('timestamp').getAll()
      req.onsuccess = () => resolve(req.result as OfflineQueueItem[])
      req.onerror = () => reject(req.error)
    })
  }

  async getBatch(size = SYNC_BATCH_SIZE): Promise<OfflineQueueItem[]> {
    const all = await this.getAll()
    return all.slice(0, size)
  }

  async remove(id: string): Promise<void> {
    const db = await this.ensureDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite')
      tx.objectStore(IDB_STORE).delete(id)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }

  async incrementRetry(id: string, error?: string): Promise<void> {
    const db = await this.ensureDB()
    const tx = db.transaction(IDB_STORE, 'readwrite')
    const store = tx.objectStore(IDB_STORE)
    const req = store.get(id)
    req.onsuccess = () => {
      const item = req.result as OfflineQueueItem | undefined
      if (item) {
        item.retryCount++
        item.lastError = error
        store.put(item)
      }
    }
  }

  async getFailed(): Promise<OfflineQueueItem[]> {
    const all = await this.getAll()
    return all.filter((i) => i.retryCount >= MAX_QUEUE_RETRIES)
  }

  async getPending(): Promise<OfflineQueueItem[]> {
    const all = await this.getAll()
    return all.filter((i) => i.retryCount < MAX_QUEUE_RETRIES)
  }

  async clear(): Promise<void> {
    const db = await this.ensureDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite')
      tx.objectStore(IDB_STORE).clear()
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }

  async count(): Promise<number> {
    const all = await this.getAll()
    return all.length
  }
}

export const offlineQueue = new OfflineQueue()

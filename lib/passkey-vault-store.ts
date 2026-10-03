import type { EncryptedVault } from '@/lib/vault-crypto'

const DB_NAME = 'mysocial-auth-passkey-vault'
const STORE = 'vaults'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function savePasskeyVault(record: EncryptedVault): Promise<void> {
  const credentialId = record.credentialId
  if (!credentialId) return
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(record, credentialId)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function listPasskeyVaults(): Promise<EncryptedVault[]> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, 'readonly').objectStore(STORE).getAll()
    request.onsuccess = () => resolve((request.result as EncryptedVault[] | undefined) ?? [])
    request.onerror = () => reject(request.error)
  })
}

export async function readPasskeyVault(credentialId: string): Promise<EncryptedVault | null> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(credentialId)
    request.onsuccess = () => resolve((request.result as EncryptedVault | undefined) ?? null)
    request.onerror = () => reject(request.error)
  })
}

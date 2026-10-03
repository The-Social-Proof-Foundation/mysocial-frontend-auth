/**
 * Root wallet vault. The server and localStorage only ever see ciphertext.
 * Mnemonic vaults store the phrase and derivation path. Imported vaults store
 * the private key. The signing seed is derived when the vault is unlocked.
 */

export const WEK_INFO = 'mysocial/wallet-wek/v1'
// The WEK is random. Do not derive it from zkLogin, the prover, or the OAuth subject.
export const MNEMONIC_RECOVERY_INFO = 'mysocial/wallet-recovery/mnemonic/v1'
export const IMPORTED_RECOVERY_INFO = 'mysocial/wallet-recovery/imported/v1'
export const VAULT_VERSION = 1

export type VaultPlaintext =
  | { kind: 'mnemonic'; mnemonic: string; derivationPath: string }
  | { kind: 'private-key'; privateKey: string }

export type EncryptedVault = {
  version: number
  address: string
  credentialId: string | null
  prfSalt: string | null
  prfWrappedWek: string | null
  recoveryWrappedWek: string
  recoveryKdfSalt: string
  vault: string
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

export function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return bytes
}

function asBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

async function aesKey(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', asBuffer(raw), 'AES-GCM', false, ['encrypt', 'decrypt'])
}

export async function aesGcmEncrypt(keyBytes: Uint8Array, plaintext: Uint8Array): Promise<Uint8Array> {
  const iv = randomBytes(12)
  const key = await aesKey(keyBytes)
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: asBuffer(iv) }, key, asBuffer(plaintext)),
  )
  const out = new Uint8Array(iv.length + cipher.length)
  out.set(iv, 0)
  out.set(cipher, iv.length)
  return out
}

export async function aesGcmDecrypt(keyBytes: Uint8Array, payload: Uint8Array): Promise<Uint8Array> {
  const iv = payload.slice(0, 12)
  const cipher = payload.slice(12)
  const key = await aesKey(keyBytes)
  return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: asBuffer(iv) }, key, asBuffer(cipher)))
}

export async function hkdfSha256(ikm: Uint8Array, info: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', asBuffer(ikm), 'HKDF', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: asBuffer(new Uint8Array(32)),
      info: asBuffer(encoder.encode(info)),
    },
    key,
    256,
  )
  return new Uint8Array(bits)
}

export function vaultPossessionMessage(
  subject: string,
  address: string,
  vaultHash: string,
  nonce: string,
): string {
  return `mysocial/wallet-vault/v1\n${subject.trim()}\n${address.trim().toLowerCase()}\n${vaultHash.trim()}\n${nonce.trim()}`
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function wrapWek(wek: Uint8Array, ikm: Uint8Array, info: string): Promise<{ salt: string; wrapped: string }> {
  const salt = randomBytes(16)
  const wrapKey = await hkdfSha256(concat(ikm, salt), info)
  const wrapped = await aesGcmEncrypt(wrapKey, wek)
  return { salt: bytesToBase64(salt), wrapped: bytesToBase64(wrapped) }
}

export async function unwrapWek(wrapped: string, salt: string, ikm: Uint8Array, info: string): Promise<Uint8Array> {
  const wrapKey = await hkdfSha256(concat(ikm, base64ToBytes(salt)), info)
  return aesGcmDecrypt(wrapKey, base64ToBytes(wrapped))
}

function concat(left: Uint8Array, right: Uint8Array): Uint8Array {
  const out = new Uint8Array(left.length + right.length)
  out.set(left, 0)
  out.set(right, left.length)
  return out
}

export async function sealVault(input: {
  plaintext: VaultPlaintext
  address: string
  recoveryIkm: Uint8Array
  recoveryInfo: string
  prfOutput?: Uint8Array | null
  credentialId?: string | null
}): Promise<{ record: EncryptedVault; wek: Uint8Array }> {
  const wek = randomBytes(32)
  const vaultBytes = await aesGcmEncrypt(wek, encoder.encode(JSON.stringify(input.plaintext)))
  const recovery = await wrapWek(wek, input.recoveryIkm, input.recoveryInfo)
  const prf = input.prfOutput
    ? await wrapWek(wek, input.prfOutput, WEK_INFO)
    : null
  return {
    wek,
    record: {
      version: VAULT_VERSION,
      address: input.address,
      credentialId: input.credentialId ?? null,
      prfSalt: prf?.salt ?? null,
      prfWrappedWek: prf?.wrapped ?? null,
      recoveryWrappedWek: recovery.wrapped,
      recoveryKdfSalt: recovery.salt,
      vault: bytesToBase64(vaultBytes),
    },
  }
}

export async function openVault(
  record: EncryptedVault,
  wek: Uint8Array,
): Promise<VaultPlaintext> {
  const json = decoder.decode(await aesGcmDecrypt(wek, base64ToBytes(record.vault)))
  const parsed = JSON.parse(json) as VaultPlaintext
  if (parsed.kind === 'mnemonic') {
    if (!parsed.mnemonic || !parsed.derivationPath) throw new Error('Mnemonic vault is incomplete')
    return { kind: 'mnemonic', mnemonic: parsed.mnemonic, derivationPath: parsed.derivationPath }
  }
  if (parsed.kind === 'private-key' && parsed.privateKey) {
    return { kind: 'private-key', privateKey: parsed.privateKey }
  }
  throw new Error('Unknown vault contents')
}

export function recoveryIkmForMnemonic(mnemonic: string): Uint8Array {
  return encoder.encode(mnemonic.trim())
}

export function recoveryIkmForPhrase(phrase: string): Uint8Array {
  return encoder.encode(phrase.trim())
}

import {
  IMPORTED_RECOVERY_INFO,
  MNEMONIC_RECOVERY_INFO,
  recoveryIkmForPhrase,
  sealVault,
  sha256Hex,
  vaultPossessionMessage,
  type EncryptedVault,
  type VaultPlaintext,
} from '@/lib/vault-crypto'
import { enrollPasskeyForVault } from '@/lib/passkey'

const VAULT_API = '/api/wallet-vault'

function sessionSubject(accessToken: string): string {
  const payload = accessToken.split('.')[1]
  if (!payload) throw new Error('Session token is not a JWT.')
  const padded = payload.replace(/-/g, '+').replace(/_/g, '/')
  const json = JSON.parse(atob(padded)) as { sub?: string }
  if (!json.sub) throw new Error('Session token is missing a subject.')
  return json.sub
}

export async function fetchExistingVault(accessToken: string): Promise<EncryptedVault | null> {
  const response = await fetch(VAULT_API, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (response.status === 404) return null
  if (!response.ok) throw new Error('Could not check the wallet vault.')
  const body = (await response.json()) as Record<string, unknown>
  const address = typeof body.address === 'string' ? body.address : ''
  const vault = typeof body.vault === 'string' ? body.vault : ''
  const recoveryWrappedWek = typeof body.recoveryWrappedWek === 'string' ? body.recoveryWrappedWek : ''
  const recoveryKdfSalt = typeof body.recoveryKdfSalt === 'string' ? body.recoveryKdfSalt : ''
  const version = typeof body.version === 'number' ? body.version : 0
  if (!address || !vault || !recoveryWrappedWek || !recoveryKdfSalt || version < 1) return null
  return {
    version,
    address,
    credentialId: typeof body.credentialId === 'string' ? body.credentialId : null,
    prfSalt: typeof body.prfSalt === 'string' ? body.prfSalt : null,
    prfWrappedWek: typeof body.prfWrappedWek === 'string' ? body.prfWrappedWek : null,
    recoveryWrappedWek,
    recoveryKdfSalt,
    vault,
  }
}

export async function fetchExistingVaultAddress(accessToken: string): Promise<string | null> {
  const record = await fetchExistingVault(accessToken)
  return record?.address ?? null
}

export async function publishRootVault(input: {
  accessToken: string
  address: string
  plaintext: VaultPlaintext
  recoveryPhrase: string
  recoveryInfo: string
  sign: (message: string) => Promise<string>
  usePasskey?: boolean
  passkey?: { credentialId: string; prfOutput: Uint8Array } | null
}): Promise<EncryptedVault> {
  const headers = {
    Authorization: `Bearer ${input.accessToken}`,
    'Content-Type': 'application/json',
  }
  const challengeRes = await fetch(`${VAULT_API}/challenge`, { method: 'POST', headers })
  if (!challengeRes.ok) throw new Error('Could not start a vault upload.')
  const challenge = (await challengeRes.json()) as { nonce?: string }
  if (!challenge.nonce) throw new Error('Vault challenge was empty.')

  const passkey = input.passkey !== undefined
    ? input.passkey
    : input.usePasskey === false
      ? null
      : await enrollPasskeyForVault(input.address)
  const { record } = await sealVault({
    address: input.address,
    plaintext: input.plaintext,
    recoveryIkm: recoveryIkmForPhrase(input.recoveryPhrase),
    recoveryInfo: input.recoveryInfo,
    prfOutput: passkey?.prfOutput ?? null,
    credentialId: passkey?.credentialId ?? null,
  })
  passkey?.prfOutput.fill(0)
  const vaultHash = await sha256Hex(record.vault)
  const signature = await input.sign(
    vaultPossessionMessage(sessionSubject(input.accessToken), input.address, vaultHash, challenge.nonce),
  )
  const put = await fetch(VAULT_API, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      address: input.address,
      version: record.version,
      credentialId: record.credentialId,
      prfSalt: record.prfSalt,
      prfWrappedWek: record.prfWrappedWek,
      recoveryWrappedWek: record.recoveryWrappedWek,
      recoveryKdfSalt: record.recoveryKdfSalt,
      vault: record.vault,
      nonce: challenge.nonce,
      signature,
    }),
  })
  if (!put.ok) throw new Error('Could not store the encrypted wallet vault.')
  return record
}

export { MNEMONIC_RECOVERY_INFO, IMPORTED_RECOVERY_INFO }

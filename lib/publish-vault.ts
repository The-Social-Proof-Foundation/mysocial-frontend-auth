import {
  IMPORTED_RECOVERY_INFO,
  MNEMONIC_RECOVERY_INFO,
  recoveryIkmForPhrase,
  sealVault,
  sha256Hex,
  vaultPossessionMessage,
  type VaultPlaintext,
} from '@/lib/vault-crypto'

const VAULT_API = '/api/wallet-vault'

function sessionSubject(accessToken: string): string {
  const payload = accessToken.split('.')[1]
  if (!payload) throw new Error('Session token is not a JWT.')
  const padded = payload.replace(/-/g, '+').replace(/_/g, '/')
  const json = JSON.parse(atob(padded)) as { sub?: string }
  if (!json.sub) throw new Error('Session token is missing a subject.')
  return json.sub
}

export async function fetchExistingVaultAddress(accessToken: string): Promise<string | null> {
  const response = await fetch(VAULT_API, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (response.status === 404) return null
  if (!response.ok) throw new Error('Could not check the wallet vault.')
  const body = (await response.json()) as { address?: string }
  return typeof body.address === 'string' && body.address ? body.address : null
}

export async function publishRootVault(input: {
  accessToken: string
  address: string
  plaintext: VaultPlaintext
  recoveryPhrase: string
  recoveryInfo: string
  sign: (message: string) => Promise<string>
}): Promise<void> {
  const headers = {
    Authorization: `Bearer ${input.accessToken}`,
    'Content-Type': 'application/json',
  }
  const challengeRes = await fetch(`${VAULT_API}/challenge`, { method: 'POST', headers })
  if (!challengeRes.ok) throw new Error('Could not start a vault upload.')
  const challenge = (await challengeRes.json()) as { nonce?: string }
  if (!challenge.nonce) throw new Error('Vault challenge was empty.')

  const { record } = await sealVault({
    address: input.address,
    plaintext: input.plaintext,
    recoveryIkm: recoveryIkmForPhrase(input.recoveryPhrase),
    recoveryInfo: input.recoveryInfo,
  })
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
}

export { MNEMONIC_RECOVERY_INFO, IMPORTED_RECOVERY_INFO }

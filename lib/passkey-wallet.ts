import {
  PasskeyKeypair,
  findCommonPublicKey,
  type PasskeyProvider,
} from '@socialproof/myso/keypairs/passkey'
import { isSafeOrigin } from '@/lib/wallet-complete'
import type { LoginParams } from '@/lib/params'

function passkeyRpId(): string {
  const host = window.location.hostname.toLowerCase()
  if (host === 'localhost' || host === '127.0.0.1') return 'localhost'
  if (host === 'mysocial.network' || host.endsWith('.mysocial.network')) return 'mysocial.network'
  return host
}

function asBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

export class MySocialPasskeyProvider implements PasskeyProvider {
  async create() {
    const userId = crypto.getRandomValues(new Uint8Array(10))
    const credential = await navigator.credentials.create({
      publicKey: {
        challenge: asBuffer(crypto.getRandomValues(new Uint8Array(32))),
        timeout: 60_000,
        rp: { name: 'MySocial', id: passkeyRpId() },
        user: { id: asBuffer(userId), name: 'MySocial', displayName: 'MySocial wallet' },
        pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          residentKey: 'required',
          requireResidentKey: true,
          userVerification: 'required',
        },
      },
    })
    if (!credential) throw new Error('Passkey was not created.')
    return credential as Awaited<ReturnType<PasskeyProvider['create']>>
  }

  async get(challenge: Uint8Array) {
    const credential = await navigator.credentials.get({
      publicKey: {
        challenge: asBuffer(challenge),
        timeout: 60_000,
        rpId: passkeyRpId(),
        userVerification: 'required',
      },
    })
    if (!credential) throw new Error('Passkey was not selected.')
    return credential as Awaited<ReturnType<PasskeyProvider['get']>>
  }
}

export async function createPasskeyAccount(): Promise<PasskeyKeypair> {
  return PasskeyKeypair.getPasskeyInstance(new MySocialPasskeyProvider())
}

export async function recoverPasskeyAccount(): Promise<PasskeyKeypair> {
  const provider = new MySocialPasskeyProvider()
  const first = await PasskeyKeypair.signAndRecover(provider, crypto.getRandomValues(new Uint8Array(32)))
  const second = await PasskeyKeypair.signAndRecover(provider, crypto.getRandomValues(new Uint8Array(32)))
  const publicKey = findCommonPublicKey(first, second)
  return new PasskeyKeypair(publicKey.toRawBytes(), provider)
}

export function handoffPasskeyAccount(keypair: PasskeyKeypair, params: LoginParams): void {
  if (!params.return_origin || !isSafeOrigin(params.return_origin)) {
    throw new Error('Please sign in from the app first.')
  }
  const raw = keypair.getPublicKey().toRawBytes()
  let binary = ''
  for (let i = 0; i < raw.length; i += 1) binary += String.fromCharCode(raw[i])
  window.opener?.postMessage(
    {
      type: 'MYSOCIAL_AUTH_RESULT',
      passkeyPublicKey: btoa(binary),
      user: { address: keypair.getPublicKey().toMySoAddress() },
      state: params.state,
      nonce: params.nonce,
      clientId: params.client_id,
    },
    params.return_origin,
  )
  window.close()
}

const PRF_EVAL_LABEL = 'mysocial/wallet-prf-eval/v1'

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function asBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

function passkeyRpId(): string {
  if (typeof window === 'undefined') return 'localhost'
  const host = window.location.hostname.toLowerCase()
  if (host === 'localhost' || host === '127.0.0.1') return 'localhost'
  if (host === 'mysocial.network' || host.endsWith('.mysocial.network')) return 'mysocial.network'
  return host
}

async function prfEvalInput(): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(PRF_EVAL_LABEL))
  return new Uint8Array(digest)
}

function prfOutputFrom(credential: PublicKeyCredential): Uint8Array | null {
  const results = credential.getClientExtensionResults() as {
    prf?: { results?: { first?: ArrayBuffer } }
  }
  const first = results.prf?.results?.first
  if (!first || first.byteLength === 0) return null
  return new Uint8Array(first)
}

async function evaluatePasskeyPrf(credentialId: string): Promise<Uint8Array | null> {
  const first = await prfEvalInput()
  try {
    const assertion = (await navigator.credentials.get({
      publicKey: {
        challenge: asBuffer(crypto.getRandomValues(new Uint8Array(32))),
        timeout: 60_000,
        rpId: passkeyRpId(),
        userVerification: 'required',
        allowCredentials: [{ type: 'public-key', id: asBuffer(base64ToBytes(credentialId)) }],
        extensions: { prf: { eval: { first: asBuffer(first) } } } as AuthenticationExtensionsClientInputs,
      },
    })) as PublicKeyCredential | null
    if (!assertion) return null
    return prfOutputFrom(assertion)
  } catch {
    return null
  }
}

/** Ask for a saved passkey enrolled with the same relying party id. */
export async function discoverPasskeyPrf(): Promise<{ credentialId: string; prfOutput: Uint8Array } | null> {
  if (typeof window === 'undefined' || typeof PublicKeyCredential === 'undefined') return null
  const first = await prfEvalInput()
  try {
    const assertion = (await navigator.credentials.get({
      publicKey: {
        challenge: asBuffer(crypto.getRandomValues(new Uint8Array(32))),
        timeout: 60_000,
        rpId: passkeyRpId(),
        userVerification: 'required',
        extensions: { prf: { eval: { first: asBuffer(first) } } } as AuthenticationExtensionsClientInputs,
      },
    })) as PublicKeyCredential | null
    if (!assertion) return null
    const prfOutput = prfOutputFrom(assertion)
    if (!prfOutput) return null
    return { credentialId: bytesToBase64(new Uint8Array(assertion.rawId)), prfOutput }
  } catch {
    return null
  }
}

/** Create a passkey whose PRF output wraps the vault key. Null when this browser cannot enroll PRF. */
export async function enrollPasskeyForVault(
  address: string,
): Promise<{ credentialId: string; prfOutput: Uint8Array } | null> {
  if (typeof window === 'undefined' || typeof PublicKeyCredential === 'undefined') return null
  try {
    const created = (await navigator.credentials.create({
      publicKey: {
        challenge: asBuffer(crypto.getRandomValues(new Uint8Array(32))),
        rp: { name: 'MySocial', id: passkeyRpId() },
        user: {
          id: asBuffer(crypto.getRandomValues(new Uint8Array(16))),
          name: address,
          displayName: 'MySocial wallet',
        },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
        authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
        extensions: { prf: {} } as AuthenticationExtensionsClientInputs,
      },
    })) as PublicKeyCredential | null
    if (!created) return null
    const credentialId = bytesToBase64(new Uint8Array(created.rawId))
    const prfOutput = await evaluatePasskeyPrf(credentialId)
    if (!prfOutput) return null
    return { credentialId, prfOutput }
  } catch {
    return null
  }
}

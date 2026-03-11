/**
 * Ed25519 address derivation from sub + salt.
 *
 * Formula (matches salt service):
 * - combinedSeed = sub + "_" + salt
 * - hash = SHA256(combinedSeed)
 * - seed = hash[0:32]
 * - keypair = Ed25519Keypair.fromSecretKey(seed)
 * - address = keypair.getPublicKey().toMySoAddress()
 *
 * Use when the client has a MySocial JWT (or id_token) sub and salt from POST /salt.
 */

import { Ed25519Keypair } from '@socialproof/myso/keypairs/ed25519';

async function sha256(message: string): Promise<Uint8Array> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  return new Uint8Array(hashBuffer);
}

/**
 * Derive Ed25519 address from sub and salt.
 * Works in both Node.js and browser (uses Web Crypto API).
 *
 * @param sub - Subject from JWT (e.g. OAuth user ID or user_identifier for MySocial)
 * @param salt - Salt string from salt service (BigInt decimal format)
 * @returns Address as hex: 0x + 64 hex characters
 */
export async function deriveEd25519AddressFromSubAndSalt(
  sub: string,
  salt: string
): Promise<string> {
  const combinedSeed = `${sub}_${salt}`;
  const hash = await sha256(combinedSeed);
  const seed = hash.subarray(0, 32);
  const keypair = Ed25519Keypair.fromSecretKey(seed);
  return keypair.getPublicKey().toMySoAddress();
}

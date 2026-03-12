'use client';

import { Ed25519Keypair } from '@socialproof/myso/keypairs/ed25519';
import * as bip39 from 'bip39';

const DERIVATION_PATH = "m/44'/6976'/0'/0'/0'";

export async function generateNewWallet(): Promise<{ address: string; mnemonic: string }> {
  const mnemonic = bip39.generateMnemonic(128);

  if (!bip39.validateMnemonic(mnemonic)) {
    throw new Error('Generated mnemonic is invalid');
  }

  const keypair = Ed25519Keypair.deriveKeypair(mnemonic, DERIVATION_PATH);
  const address = keypair.getPublicKey().toMySoAddress();

  const restoredKeypair = Ed25519Keypair.deriveKeypair(mnemonic, DERIVATION_PATH);
  const restoredAddress = restoredKeypair.getPublicKey().toMySoAddress();
  if (address !== restoredAddress) {
    throw new Error('Wallet generation validation failed: stored mnemonic cannot restore same address');
  }

  return { address, mnemonic };
}

export async function importWalletFromMnemonic(mnemonic: string): Promise<string> {
  const words = mnemonic.trim().split(/\s+/);
  if (words.length < 12 || words.length > 24) {
    throw new Error('Invalid mnemonic: must be 12-24 words');
  }

  const keypair = Ed25519Keypair.deriveKeypair(mnemonic, DERIVATION_PATH);
  const address = keypair.getPublicKey().toMySoAddress();

  const restoredKeypair = Ed25519Keypair.deriveKeypair(mnemonic, DERIVATION_PATH);
  const restoredAddress = restoredKeypair.getPublicKey().toMySoAddress();
  if (address !== restoredAddress) {
    throw new Error('Mnemonic import validation failed: stored mnemonic cannot restore same address');
  }

  return address;
}

export async function importWalletFromPrivateKey(privateKey: string): Promise<string> {
  let keyBytes: Uint8Array;

  if (privateKey.startsWith('0x')) {
    const hex = privateKey.slice(2);
    if (hex.length !== 64) {
      throw new Error('Invalid private key: hex key must be 64 characters (32 bytes)');
    }
    keyBytes = new Uint8Array(hex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)));
  } else {
    const keyArray = privateKey.split(',').map(Number);
    if (keyArray.length !== 32) {
      throw new Error('Invalid private key: must be 32 bytes');
    }
    keyBytes = new Uint8Array(keyArray);
  }

  const keypair = Ed25519Keypair.fromSecretKey(keyBytes);
  const address = keypair.getPublicKey().toMySoAddress();

  return address;
}

export function getAppRedirectUri(): string {
  const uri = process.env.NEXT_PUBLIC_APP_REDIRECT_URI?.trim();
  if (uri) return uri;
  if (typeof window !== 'undefined') return window.location.origin;
  return 'http://localhost:3000';
}

/**
 * Sign a message with Ed25519. Accepts mnemonic (12-24 words) or private key (hex or comma-separated).
 * Returns base64-encoded Ed25519 SimpleSignature (97 bytes: 0x00 + 64-byte sig + 32-byte pubkey)
 * to match myso-salt-service auth_wallet_callback expectations.
 */
export async function signMessage(
  mnemonicOrPrivateKey: string,
  message: string
): Promise<string> {
  const trimmed = mnemonicOrPrivateKey.trim();
  let keypair: Ed25519Keypair;

  if (trimmed.includes(' ')) {
    const words = trimmed.split(/\s+/);
    if (words.length < 12 || words.length > 24) {
      throw new Error('Invalid mnemonic: must be 12-24 words');
    }
    keypair = Ed25519Keypair.deriveKeypair(trimmed, DERIVATION_PATH);
  } else {
    keypair = await getKeypairFromPrivateKey(trimmed);
  }

  const messageBytes = new TextEncoder().encode(message);
  const sigBytes = await keypair.sign(messageBytes);
  const pubkeyBytes = keypair.getPublicKey().toRawBytes();

  const simpleSig = new Uint8Array(1 + sigBytes.length + pubkeyBytes.length);
  simpleSig[0] = 0x00;
  simpleSig.set(sigBytes, 1);
  simpleSig.set(pubkeyBytes, 1 + sigBytes.length);

  return uint8ArrayToBase64(simpleSig);
}

async function getKeypairFromPrivateKey(privateKey: string): Promise<Ed25519Keypair> {
  let keyBytes: Uint8Array;

  if (privateKey.startsWith('0x')) {
    const hex = privateKey.slice(2);
    if (hex.length !== 64) {
      throw new Error('Invalid private key: hex key must be 64 characters (32 bytes)');
    }
    keyBytes = new Uint8Array(hex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)));
  } else {
    const keyArray = privateKey.split(',').map(Number);
    if (keyArray.length !== 32) {
      throw new Error('Invalid private key: must be 32 bytes');
    }
    keyBytes = new Uint8Array(keyArray);
  }

  return Ed25519Keypair.fromSecretKey(keyBytes);
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

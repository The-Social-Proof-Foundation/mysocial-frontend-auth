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

  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('mysocial_mnemonic', mnemonic);
    localStorage.setItem('mysocial_derivation_path', DERIVATION_PATH);
    localStorage.setItem('mysocial_address', address);
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

  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('mysocial_mnemonic', mnemonic);
    localStorage.setItem('mysocial_derivation_path', DERIVATION_PATH);
    localStorage.setItem('mysocial_address', address);
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

  if (typeof localStorage !== 'undefined') {
    const keyBase64 = btoa(String.fromCharCode(...Array.from(keyBytes)));
    localStorage.setItem('mysocial_private_key', keyBase64);
    localStorage.setItem('mysocial_address', address);
  }

  return address;
}

export function getAppRedirectUri(): string {
  const uri = process.env.NEXT_PUBLIC_APP_REDIRECT_URI?.trim();
  if (uri) return uri;
  if (typeof window !== 'undefined') return window.location.origin;
  return 'http://localhost:3000';
}

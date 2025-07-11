// 类型声明修正
// @ts-ignore
import forge from 'node-forge';
import { t } from './i18n';

const KEY_STORAGE = 'discourse_user_api_keypair';

export interface UserApiKeyPair {
  publicKeyPem: string;
  privateKeyPem: string;
  nonce: string;
}

// 生成RSA密钥对和nonce
export function generateKeyPairAndNonce(): UserApiKeyPair {
  const keypair = forge.pki.rsa.generateKeyPair({ bits: 4096, e: 0x10001 });
  const publicKeyPem = forge.pki.publicKeyToPem(keypair.publicKey);
  const privateKeyPem = forge.pki.privateKeyToPem(keypair.privateKey);
  const nonce = forge.util.bytesToHex(forge.random.getBytesSync(16));
  return { publicKeyPem, privateKeyPem, nonce };
}

// 保存密钥对到localStorage
export function saveKeyPair(pair: UserApiKeyPair) {
  localStorage.setItem(KEY_STORAGE, JSON.stringify(pair));
}

// 读取密钥对
export function loadKeyPair(): UserApiKeyPair | null {
  const raw = localStorage.getItem(KEY_STORAGE);
  if (!raw) return null;
  return JSON.parse(raw);
}

// 清除密钥对
export function clearKeyPair() {
  localStorage.removeItem(KEY_STORAGE);
}

// 解密payload，校验nonce，返回user-api-key
export async function decryptUserApiKey(payload: string): Promise<string> {
  const pair = loadKeyPair();
  if (!pair) throw new Error(t('CRYPTO_NEED_GEN_KEYPAIR'));
  const privateKey = forge.pki.privateKeyFromPem(pair.privateKeyPem);
  const encryptedBytes = forge.util.decode64(payload.trim().replace(/\s/g, ''));
  const decrypted = privateKey.decrypt(encryptedBytes, 'RSAES-PKCS1-V1_5');
  const json = JSON.parse(decrypted);
  if (!json.key) throw new Error(t('CRYPTO_PAYLOAD_NO_KEY'));
  if (json.nonce !== pair.nonce) throw new Error(t('CRYPTO_NONCE_INVALID'));
  return json.key;
} 
import { safeStorage } from 'electron';

/**
 * 加密字符串 (用于敏感数据如 API Key)
 * 使用 Electron safeStorage API:
 * - macOS: Keychain
 * - Windows: DPAPI
 * - Linux: libsecret
 *
 * @param plaintext 明文字符串
 * @returns Base64 编码的加密字符串
 */
export function encryptString(plaintext: string): string {
  if (!plaintext) {
    return '';
  }

  // 检查加密是否可用
  if (!safeStorage.isEncryptionAvailable()) {
    console.warn('[Encryption] Encryption not available, storing in plaintext');
    return plaintext; // 降级为明文存储
  }

  try {
    const buffer = safeStorage.encryptString(plaintext);
    return buffer.toString('base64');
  } catch (error) {
    console.error('[Encryption] Failed to encrypt:', error);
    return plaintext; // 加密失败,降级为明文
  }
}

/**
 * 解密字符串
 *
 * @param encrypted Base64 编码的加密字符串
 * @returns 解密后的明文字符串
 */
export function decryptString(encrypted: string): string {
  if (!encrypted) {
    return '';
  }

  // 检查加密是否可用
  if (!safeStorage.isEncryptionAvailable()) {
    console.warn('[Encryption] Encryption not available, returning as-is');
    return encrypted; // 降级情况,直接返回
  }

  try {
    const buffer = Buffer.from(encrypted, 'base64');
    return safeStorage.decryptString(buffer);
  } catch (error) {
    console.error('[Encryption] Failed to decrypt:', error);
    // 可能是明文存储的数据,直接返回
    return encrypted;
  }
}

/**
 * 检查字符串是否已加密
 * 简单判断: Base64 字符串长度通常比原始字符串长,且包含特定字符
 */
export function isEncrypted(str: string): boolean {
  if (!str) {
    return false;
  }

  // Base64 正则
  const base64Regex = /^[A-Za-z0-9+/]+={0,2}$/;

  // 如果不是 Base64 格式,肯定是明文
  if (!base64Regex.test(str)) {
    return false;
  }

  // 如果是有效的 Base64 且长度 > 50 (API Key 通常很长),认为是加密的
  return str.length > 50;
}

/**
 * 智能加密: 如果已加密则跳过
 */
export function smartEncrypt(str: string): string {
  if (isEncrypted(str)) {
    return str; // 已加密,跳过
  }
  return encryptString(str);
}

import fs from 'node:fs';
import path from 'node:path';
import { app, safeStorage } from 'electron';

const KEY_FILENAME = 'gemini-api-key.enc';

function getKeyFilePath(): string {
  return path.join(app.getPath('userData'), KEY_FILENAME);
}

export interface SecretStatus {
  hasKey: boolean;
  encryptionAvailable: boolean;
  backend: string;
}

export function getSecretStatus(): SecretStatus {
  const encryptionAvailable = safeStorage.isEncryptionAvailable();
  const keyPath = getKeyFilePath();
  const hasKey = fs.existsSync(keyPath) && fs.statSync(keyPath).size > 0;
  const backend =
    process.platform === 'win32'
      ? 'Windows Credential Manager / DPAPI (Electron safeStorage)'
      : `OS Keyring (${process.platform} Electron safeStorage)`;

  return { hasKey, encryptionAvailable, backend };
}

export function saveGeminiApiKey(apiKey: string): { saved: boolean; backend: string } {
  const trimmed = apiKey.trim();
  if (trimmed.length < 10) {
    throw new Error('Ungültiger Gemini API-Key (zu kurz).');
  }
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error(
      'System-Verschlüsselung (safeStorage / Windows DPAPI) ist nicht verfügbar. Schlüssel wird nicht im Klartext gespeichert.',
    );
  }
  const encrypted = safeStorage.encryptString(trimmed);
  const keyPath = getKeyFilePath();
  fs.mkdirSync(path.dirname(keyPath), { recursive: true });
  fs.writeFileSync(keyPath, encrypted);
  return { saved: true, backend: getSecretStatus().backend };
}

export function loadGeminiApiKey(): string | null {
  const keyPath = getKeyFilePath();
  if (!fs.existsSync(keyPath)) return null;
  if (!safeStorage.isEncryptionAvailable()) return null;
  const encrypted = fs.readFileSync(keyPath);
  if (encrypted.length === 0) return null;
  return safeStorage.decryptString(encrypted);
}

export function deleteGeminiApiKey(): boolean {
  const keyPath = getKeyFilePath();
  if (fs.existsSync(keyPath)) {
    fs.unlinkSync(keyPath);
    return true;
  }
  return false;
}

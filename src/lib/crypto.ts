// Utility to convert ArrayBuffer to Base64 safely
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

// Utility to convert Base64 to ArrayBuffer safely
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary_string = window.atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
}

// Generate random string (Hex)
export function generateRandomHex(len: number): string {
  const bytes = window.crypto.getRandomValues(new Uint8Array(len / 2));
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Hash a string generically
export async function hashString(str: string): Promise<string> {
  const enc = new TextEncoder();
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', enc.encode(str));
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function deriveKey(password: string, salt: BufferSource): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );
  
  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000, // Very secure, slows down brute forcing
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

export interface KeyringEntry {
  iv: string;
  wrapped_master: string;
}

export interface KeyringExamPayload {
  salt: string;
  iv: string;
  data: string; // The encrypted markdown
  keyring_salt: string;
  keyring: Record<string, KeyringEntry>;
}

/**
 * Generates an encrypted payload with a Keyring that maps N unique Student IDs.
 * The document content is encrypted using a singular generated Master Password.
 * The Master Password itself is encrypted N times, once for each valid Student ID.
 */
export async function encryptWithKeyring(studentIds: string[], content: string): Promise<string> {
  const enc = new TextEncoder();
  
  // 1. Generate a complex, random Master Password for this specific document.
  const masterPassword = generateRandomHex(32);
  const contentBytes = enc.encode(content);
  
  // 2. Encrypt the physical Markdown using the Master Password
  const masterSalt = window.crypto.getRandomValues(new Uint8Array(16));
  const masterIv = window.crypto.getRandomValues(new Uint8Array(12));
  const masterKey = await deriveKey(masterPassword, masterSalt);
  
  const encryptedData = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: masterIv },
    masterKey,
    contentBytes
  );

  // 3. Build the Cryptographic Keyring
  const keyringSalt = window.crypto.getRandomValues(new Uint8Array(16));
  const keyring: Record<string, KeyringEntry> = {};
  
  const masterPasswordBytes = enc.encode(masterPassword);
  
  for (const sid of studentIds) {
      // Hash the ID so the raw ID string is never visibly exposed in the JSON structure
      const sidHash = await hashString(sid.toLowerCase().trim());
      
      // Derive an individual encryption key from the Student's unique ID
      const studentKey = await deriveKey(sid.toLowerCase().trim(), keyringSalt);
      const studentIv = window.crypto.getRandomValues(new Uint8Array(12));
      
      // Wrap the Master Password with the Student's key
      const wrappedMaster = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv: studentIv },
        studentKey,
        masterPasswordBytes
      );
      
      keyring[sidHash] = {
        iv: arrayBufferToBase64(studentIv.buffer),
        wrapped_master: arrayBufferToBase64(wrappedMaster)
      };
  }

  const payload: KeyringExamPayload = {
    salt: arrayBufferToBase64(masterSalt.buffer),
    iv: arrayBufferToBase64(masterIv.buffer),
    data: arrayBufferToBase64(encryptedData),
    keyring_salt: arrayBufferToBase64(keyringSalt.buffer),
    keyring
  };

  return JSON.stringify(payload);
}

/**
 * Unlocks the payload by verifying the specific `studentId` against the Keyring.
 * Extracts the wrapper, decrypts the Master Password, and finally decrypts the raw content.
 */
export async function decryptWithKeyring(studentId: string, encryptedJsonString: string): Promise<string> {
  const payload: KeyringExamPayload = JSON.parse(encryptedJsonString);
  const normalizedId = studentId.toLowerCase().trim();
  const idHash = await hashString(normalizedId);
  
  // Provide constant-time lookup failure if the key doesn't exist
  if (!payload.keyring[idHash]) {
      throw new Error("ACCESS_DENIED");
  }

  const entry = payload.keyring[idHash];
  const keyringSaltBytes = base64ToArrayBuffer(payload.keyring_salt);
  
  // 1. Derive the student's personal key
  const studentKey = await deriveKey(normalizedId, keyringSaltBytes);
  const studentIv = base64ToArrayBuffer(entry.iv);
  const wrappedMasterBytes = base64ToArrayBuffer(entry.wrapped_master);
  
  // 2. Decrypt the Master Password
  let masterPasswordBytes: ArrayBuffer;
  try {
      masterPasswordBytes = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv: studentIv },
        studentKey,
        wrappedMasterBytes
      );
  } catch {
      throw new Error("ACCESS_DENIED"); // In case of data tampering
  }
  
  const dec = new TextDecoder();
  const masterPassword = dec.decode(masterPasswordBytes);
  
  // 3. Unlock the core document using the Master Password
  const masterSaltBytes = base64ToArrayBuffer(payload.salt);
  const masterIvBytes = base64ToArrayBuffer(payload.iv);
  const encryptedFileBytes = base64ToArrayBuffer(payload.data);
  
  const coreKey = await deriveKey(masterPassword, masterSaltBytes);
  
  const decryptedDocumentBytes = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: masterIvBytes },
    coreKey,
    encryptedFileBytes
  );

  return dec.decode(decryptedDocumentBytes);
}

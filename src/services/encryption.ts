// utils/encryption.ts
import CryptoJS from "crypto-js";

const SECRET_KEY = process.env.NEXT_PUBLIC_ENCRYPTION_KEY || "your-strong-secret-key"; // Move to .env

export function encryptUrl(text: string): string {
  try {
    const ciphertext = CryptoJS.AES.encrypt(text, SECRET_KEY).toString();
    return encodeURIComponent(ciphertext); // URL safe
  } catch (error) {
    console.error("Encryption error:", error);
    throw new Error("Failed to encrypt data");
  }
}

export function decryptUrl(encrypted: string): string {
  try {
    const decoded = decodeURIComponent(encrypted);
    const bytes = CryptoJS.AES.decrypt(decoded, SECRET_KEY);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    if (!decrypted) {
      throw new Error("Decryption resulted in empty string");
    }
    return decrypted;
  } catch (error) {
    console.error("Decryption error:", error);
    throw new Error("Failed to decrypt data: Malformed or invalid input");
  }
}
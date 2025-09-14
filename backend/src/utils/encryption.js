import CryptoJS from 'crypto-js';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'ayurveda_default_key_2024';

// Encrypt phone number
export const encryptPhone = (phoneNumber) => {
  if (!phoneNumber) return null;
  return CryptoJS.AES.encrypt(phoneNumber, ENCRYPTION_KEY).toString();
};

// Decrypt phone number
export const decryptPhone = (encryptedPhone) => {
  if (!encryptedPhone) return null;
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedPhone, ENCRYPTION_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (error) {
    console.error('Phone decryption failed:', error);
    return null;
  }
};

// Hash phone number for searching (one-way)
export const hashPhone = (phoneNumber) => {
  if (!phoneNumber) return null;
  return CryptoJS.SHA256(phoneNumber + ENCRYPTION_KEY).toString();
};

import QRCode from 'qrcode';
import { config } from 'dotenv';

// Load environment variables
config();

/**
 * Generate a QR code for a batch with a URL to view batch details
 * @param {string} batchId - The ID of the batch
 * @param {Object} batchData - The batch data to encode
 * @returns {Promise<string>} - Base64 encoded QR code image
 */
export const generateBatchQR = async (batchId, batchData) => {
  try {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const qrData = {
      batchId,
      url: `${frontendUrl}/batches/${batchId}`,
      timestamp: new Date().toISOString(),
      ...batchData
    };

    // Convert the data to a JSON string
    const dataString = JSON.stringify(qrData);
    
    // Generate QR code as a data URL
    const qrCode = await QRCode.toDataURL(dataString, {
      errorCorrectionLevel: 'H', // High error correction
      type: 'image/png',
      margin: 1,
      scale: 8,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    });

    return qrCode;
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw new Error('Failed to generate QR code');
  }
};

/**
 * Generate a QR code for a batch with a URL to view batch details
 * @param {string} batchId - The ID of the batch
 * @returns {string} - URL to view batch details
 */
export const getBatchUrl = (batchId) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  return `${frontendUrl}/batches/${batchId}`;
};

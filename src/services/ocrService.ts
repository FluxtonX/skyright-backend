import dotenv from 'dotenv';

dotenv.config();

export interface OCRResult {
  extractedText: string;
  metadata: {
    documentNumber?: string;
    expiryDate?: string;
    fullName?: string;
    nationality?: string;
  };
}

export const processDocumentOCR = async (fileUrl: string, type: string): Promise<OCRResult> => {
  try {
    const API_KEY = process.env.GOOGLE_CLOUD_VISION_API_KEY;

    if (!API_KEY) {
      console.log('Mock Mode: No Google Cloud Vision API key found. Returning mock OCR data.');
      return getMockOCRData(type);
    }

    // Real Google Cloud Vision logic would go here
    // For now, returning mock data as a placeholder for production logic
    return getMockOCRData(type);
  } catch (error) {
    console.error('OCR Processing Error:', error);
    throw new Error('Failed to process document OCR');
  }
};

const getMockOCRData = (type: string): OCRResult => {
  if (type === 'Passport') {
    return {
      extractedText: 'REPUBLIC OF NIGERIA PASSPORT...',
      metadata: {
        documentNumber: 'A12345678',
        expiryDate: '2030-12-31',
        fullName: 'RAHMAT ULLAH',
        nationality: 'NIGERIAN',
      },
    };
  }
  
  return {
    extractedText: 'GENERIC DOCUMENT TEXT...',
    metadata: {},
  };
};

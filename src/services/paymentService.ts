import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;

export const initializePaystackPayment = async (email: string, amount: number) => {
  try {
    if (!PAYSTACK_SECRET) {
      console.log('Mock Mode: No Paystack Secret Key. Returning mock payment URL.');
      return { authorization_url: 'https://checkout.paystack.com/mock-url', reference: 'mock_ref_' + Date.now() };
    }

    const response = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        email,
        amount: amount * 100, // Paystack expects amount in kobo
        callback_url: `${process.env.FRONTEND_URL}/payment-success`,
      },
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data.data;
  } catch (error: any) {
    console.error('Paystack Initialization Error:', error.response?.data || error.message);
    throw new Error('Failed to initialize Paystack payment');
  }
};

export const verifyPaystackTransaction = async (reference: string) => {
  try {
    if (!PAYSTACK_SECRET) return true; // Mock success

    const response = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET}`,
      },
    });

    return response.data.data.status === 'success';
  } catch (error) {
    console.error('Paystack Verification Error:', error);
    return false;
  }
};

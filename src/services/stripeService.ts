import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config();

// Lazy getter — avoids crash when STRIPE_SECRET_KEY is empty at startup
const getStripe = (): any => {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-01-27-acacia' as any,
  });
};

export const createStripeCheckoutSession = async (email: string, amount: number) => {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      console.log('Mock Mode: No Stripe Secret Key. Returning mock session.');
      return { id: 'mock_session_id', url: 'https://checkout.stripe.com/mock' };
    }

    const session = await getStripe()!.checkout.sessions.create({
      payment_method_types: ['card'],
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'SkyRight Traveler Plus',
              description: 'Access to proactive monitoring and baggage tracking.',
            },
            unit_amount: amount * 100, // Amount in cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/payment-cancelled`,
    });

    return session;
  } catch (error: any) {
    console.error('Stripe Session Error:', error.message);
    throw new Error('Failed to create Stripe checkout session');
  }
};

export const verifyStripeWebhook = (rawBody: any, signature: string) => {
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
  const stripeClient = getStripe();
  if (!stripeClient) throw new Error('Stripe is not configured.');
  try {
    return stripeClient.webhooks.constructEvent(rawBody, signature, endpointSecret);
  } catch (err: any) {
    console.error(`Webhook Error: ${err.message}`);
    throw new Error(`Webhook Error: ${err.message}`);
  }
};

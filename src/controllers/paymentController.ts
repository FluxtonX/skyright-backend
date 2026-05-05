import { Response, Request } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import User from '../models/userModel';
import { initializePaystackPayment, verifyPaystackTransaction } from '../services/paymentService';
import { createStripeCheckoutSession, verifyStripeWebhook } from '../services/stripeService';

// @desc    Initialize a subscription payment
// @route   POST /api/payments/subscribe
// @access  Private
export const startSubscription = async (req: AuthRequest, res: Response) => {
  try {
    const amount = 5000; // Example: 5000 NGN for Plus plan
    const paymentData = await initializePaystackPayment(req.user.email, amount);
    
    res.json(paymentData);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Verify payment and upgrade user
// @route   POST /api/payments/verify
// @access  Private
export const verifySubscription = async (req: AuthRequest, res: Response) => {
  try {
    const { reference } = req.body;
    const isSuccessful = await verifyPaystackTransaction(reference);

    if (isSuccessful) {
      const user = await User.findById(req.user._id);
      if (user) {
        user.plan = 'Plus';
        await user.save();
        res.json({ message: 'Upgrade successful', plan: 'Plus' });
      } else {
        res.status(404).json({ message: 'User not found' });
      }
    } else {
      res.status(400).json({ message: 'Payment verification failed' });
    }
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Handle All Payment Webhooks (Stripe & Paystack)
// @route   POST /api/payments/webhook
// @access  Public
export const handleWebhook = async (req: Request, res: Response) => {
  const stripeSignature = req.headers['stripe-signature'] as string;

  // 1. Handle Stripe Webhook (Secure)
  if (stripeSignature) {
    try {
      const event = verifyStripeWebhook((req as any).rawBody, stripeSignature);
      
      if (event.type === 'checkout.session.completed') {
        const session = event.data.object as any;
        const email = session.customer_email;
        const user = await User.findOne({ email });
        if (user) {
          user.plan = 'Plus';
          await user.save();
          console.log(`User ${email} upgraded via Stripe Webhook`);
        }
      }
      return res.sendStatus(200);
    } catch (err: any) {
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
  }

  // 2. Handle Paystack Webhook
  const event = req.body;
  if (event.event === 'charge.success') {
    const email = event.data.customer.email;
    const user = await User.findOne({ email });
    if (user) {
      user.plan = 'Plus';
      await user.save();
      console.log(`User ${email} upgraded via Paystack Webhook`);
    }
  }

  res.sendStatus(200);
};

// @desc    Initialize Stripe Subscription
// @route   POST /api/payments/stripe/subscribe
export const startStripeSubscription = async (req: AuthRequest, res: Response) => {
  try {
    const amount = 30; // $30 for Plus plan
    const session = await createStripeCheckoutSession(req.user.email, amount);
    res.json(session);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};


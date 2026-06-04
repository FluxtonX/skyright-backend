import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import User from '../models/userModel';

const plans = [
  {
    key: 'Free',
    title: 'Basic',
    price: 0,
    currency: 'NGN',
    interval: 'month',
    features: ['Sentinel AI', 'TicketGuard', 'BorderReady', 'ResolveFlow', 'Document Vault'],
  },
  {
    key: 'Plus',
    title: 'Plus',
    price: 9999,
    currency: 'NGN',
    interval: 'month',
    features: ['Everything in Basic', 'BagTrack', 'Trip Visualizer', 'Expense Tracker', 'Claim Submission', 'Claim Intelligence'],
  },
  {
    key: 'Concierge Pass',
    title: 'Concierge Pass',
    price: 24999,
    currency: 'NGN',
    interval: 'month',
    features: ['Everything in Plus', '24/7 Concierge Support', 'Priority Resolution', 'Dedicated Account Manager'],
  },
];

export const getPlans = async (_req: AuthRequest, res: Response) => {
  res.json(plans);
};

export const getCurrentSubscription = async (req: AuthRequest, res: Response) => {
  const plan = plans.find((item) => item.key === req.user.plan) || plans[0];

  res.json({
    plan: req.user.plan || 'Free',
    status: req.user.plan === 'Free' ? 'free' : 'active',
    provider: req.user.subscriptionProvider || null,
    currentPeriodEnd: req.user.currentPeriodEnd || null,
    planDetails: plan,
  });
};

export const changeSubscriptionPlan = async (req: AuthRequest, res: Response) => {
  const { plan } = req.body;

  if (!plans.some((item) => item.key === plan)) {
    return res.status(400).json({ message: 'Invalid plan' });
  }

  const user = await User.findById(req.user._id);

  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  user.plan = plan;
  user.subscriptionStatus = plan === 'Free' ? 'free' : 'active';
  user.subscriptionProvider = req.body.provider || user.subscriptionProvider || 'manual';
  await user.save();

  res.json({ message: 'Plan updated', plan: user.plan, status: user.subscriptionStatus });
};

export const cancelSubscription = async (req: AuthRequest, res: Response) => {
  const user = await User.findById(req.user._id);

  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  user.plan = 'Free';
  user.subscriptionStatus = 'cancelled';
  user.cancelledAt = new Date().toISOString();
  await user.save();

  res.json({ message: 'Subscription cancelled', plan: user.plan, status: user.subscriptionStatus });
};

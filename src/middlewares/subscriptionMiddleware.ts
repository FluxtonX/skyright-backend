import { Response, NextFunction } from 'express';
import { AuthRequest } from './authMiddleware';

export const checkPlanAccess = (requiredPlan: 'Plus' | 'Concierge Pass') => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const userPlan = req.user.plan;

    if (requiredPlan === 'Plus') {
      if (userPlan === 'Plus' || userPlan === 'Concierge Pass' || req.user.role === 'Admin') {
        return next();
      }
    }

    if (requiredPlan === 'Concierge Pass') {
      if (userPlan === 'Concierge Pass' || req.user.role === 'Admin') {
        return next();
      }
    }

    return res.status(403).json({ 
      message: `Feature requires ${requiredPlan} plan. Your current plan is ${userPlan}.`,
      upgradeRequired: true
    });
  };
};

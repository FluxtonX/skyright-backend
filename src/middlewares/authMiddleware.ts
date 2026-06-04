import { Request, Response, NextFunction, RequestHandler } from 'express';
import admin from '../config/firebase';
import { upsertUserFromFirebaseToken } from '../services/userProfileService';

export interface AuthRequest extends Request {
  user?: any;
  file?: Express.Multer.File;
}

export const protect: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decodedToken = await admin.auth().verifyIdToken(token);

      (req as AuthRequest).user = await upsertUserFromFirebaseToken(decodedToken);
      return next();
    } catch (error) {
      console.error('Auth Middleware Error:', error);
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  return res.status(401).json({ message: 'Not authorized, no token' });
};

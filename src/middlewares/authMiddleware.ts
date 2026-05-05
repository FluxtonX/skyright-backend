import { Request, Response, NextFunction } from 'express';
import admin from '../config/firebase';
import User from '../models/userModel';

export interface AuthRequest extends Request {
  user?: any;
}

export const protect = async (req: AuthRequest, res: Response, next: NextFunction) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];

      // Verify token with Firebase
      const decodedToken = await admin.auth().verifyIdToken(token);

      // Check if user exists in MongoDB, if not create one
      let user = await User.findOne({ firebaseId: decodedToken.uid });

      if (!user) {
        user = await User.create({
          firebaseId: decodedToken.uid,
          email: decodedToken.email,
          displayName: decodedToken.name || '',
          photoURL: decodedToken.picture || '',
        });
      }

      req.user = user;
      next();
    } catch (error) {
      console.error('Auth Middleware Error:', error);
      res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    res.status(401).json({ message: 'Not authorized, no token' });
  }
};

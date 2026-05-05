import express from 'express';
import { submitClaim, getUserClaims, updateClaim } from '../controllers/claimController';
import { protect } from '../middlewares/authMiddleware';

const router = express.Router();

router.route('/')
  .post(protect, submitClaim)
  .get(protect, getUserClaims);

router.route('/:id')
  .patch(protect, updateClaim);

export default router;

import express from 'express';
import {
  getAcademyClasses,
  getAcademyProgress,
  updateAcademyProgress,
} from '../controllers/academyController';
import { protect } from '../middlewares/authMiddleware';

const router = express.Router();

router.get('/classes', protect, getAcademyClasses);
router.get('/progress', protect, getAcademyProgress);
router.put('/classes/:id/progress', protect, updateAcademyProgress);

export default router;

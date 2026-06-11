import express from 'express';
import { chatWithAssistant } from '../controllers/assistantController';
import { protect } from '../middlewares/authMiddleware';

const router = express.Router();

router.post('/chat', protect, chatWithAssistant);

export default router;

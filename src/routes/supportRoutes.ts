import express from 'express';
import {
  createConciergeRequest,
  createDemoRequest,
  createSalesContact,
  createSupportRequest,
  getConciergeStatus,
  getSupportRequests,
} from '../controllers/supportController';
import { protect } from '../middlewares/authMiddleware';

const router = express.Router();

router.get('/support/requests', protect, getSupportRequests);
router.post('/support/requests', protect, createSupportRequest);
router.get('/concierge/status', protect, getConciergeStatus);
router.post('/concierge/request', protect, createConciergeRequest);
router.post('/sales/demo-request', protect, createDemoRequest);
router.post('/sales/contact', protect, createSalesContact);

export default router;

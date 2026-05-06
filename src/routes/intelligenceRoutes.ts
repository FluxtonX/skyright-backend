import express from 'express';
import { 
  getGlobalIntelligence, 
  getAirlinePerformance, 
  getAIRecommendations 
} from '../controllers/claimIntelligenceController';
import { protect } from '../middlewares/authMiddleware';
import { checkPlanAccess } from '../middlewares/subscriptionMiddleware';

const router = express.Router();

router.get('/global', protect, checkPlanAccess('Plus'), getGlobalIntelligence);
router.get('/airlines', protect, checkPlanAccess('Plus'), getAirlinePerformance);
router.get('/recommendations', protect, checkPlanAccess('Plus'), getAIRecommendations);

export default router;

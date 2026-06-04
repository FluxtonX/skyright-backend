import express from 'express';
import {
  clearRecentSearches,
  getRecentSearches,
  getSearchSuggestions,
  globalSearch,
} from '../controllers/searchController';
import { protect } from '../middlewares/authMiddleware';

const router = express.Router();

router.get('/suggestions', protect, getSearchSuggestions);
router.get('/recent', protect, getRecentSearches);
router.delete('/recent', protect, clearRecentSearches);
router.get('/', protect, globalSearch);

export default router;

import express from 'express';
import { uploadDocument, getUserDocuments, deleteDocument } from '../controllers/vaultController';
import { protect } from '../middlewares/authMiddleware';

const router = express.Router();

router.route('/')
  .post(protect, uploadDocument)
  .get(protect, getUserDocuments);

router.route('/:id')
  .delete(protect, deleteDocument);

export default router;

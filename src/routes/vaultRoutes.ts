import express from 'express';
import {
  deleteDocument,
  getDocumentDetails,
  getUserDocuments,
  linkDocumentToClaim,
  updateDocument,
  uploadDocument,
} from '../controllers/vaultController';
import { protect } from '../middlewares/authMiddleware';
import { uploadSingleFile } from '../middlewares/uploadMiddleware';

const router = express.Router();

router.route('/')
  .post(protect, uploadSingleFile('file'), uploadDocument)
  .get(protect, getUserDocuments);

router.route('/:id')
  .get(protect, getDocumentDetails)
  .patch(protect, updateDocument)
  .delete(protect, deleteDocument);

router.post('/:id/link-claim', protect, linkDocumentToClaim);

export default router;

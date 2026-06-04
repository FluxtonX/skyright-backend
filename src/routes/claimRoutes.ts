import express from 'express';
import {
  addClaimNote,
  createClaimFromAlert,
  createClaimFromVault,
  deleteClaimDocument,
  deleteClaimNote,
  escalateClaim,
  estimateClaim,
  getClaimDetails,
  getClaimEvidencePacket,
  getClaimRequirements,
  getClaimNotes,
  getClaimTimeline,
  getUserClaims,
  submitClaim,
  submitClaimForReview,
  updateClaim,
  uploadClaimDocument,
} from '../controllers/claimController';
import { protect } from '../middlewares/authMiddleware';
import { uploadSingleFile } from '../middlewares/uploadMiddleware';

const router = express.Router();

router.route('/')
  .post(protect, submitClaim)
  .get(protect, getUserClaims);

router.get('/requirements', protect, getClaimRequirements);
router.post('/estimate', protect, estimateClaim);
router.post('/from-alert/:alertId', protect, createClaimFromAlert);
router.post('/from-vault/:documentId', protect, createClaimFromVault);

router.post('/:id/submit', protect, submitClaimForReview);
router.post('/:id/escalate', protect, escalateClaim);
router.get('/:id/evidence-packet', protect, getClaimEvidencePacket);
router.post('/:id/documents', protect, uploadSingleFile('file'), uploadClaimDocument);
router.delete('/:id/documents/:documentId', protect, deleteClaimDocument);
router.get('/:id/timeline', protect, getClaimTimeline);
router.get('/:id/notes', protect, getClaimNotes);
router.post('/:id/notes', protect, addClaimNote);
router.delete('/:id/notes/:noteId', protect, deleteClaimNote);

router.route('/:id')
  .get(protect, getClaimDetails)
  .patch(protect, updateClaim);

export default router;

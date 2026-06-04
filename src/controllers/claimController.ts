import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import Claim from '../models/claimModel';
import { deleteFirebaseStorageFile, uploadBufferToFirebaseStorage } from '../services/storageService';
import Alert from '../models/alertModel';
import Document from '../models/documentModel';

// @desc    Submit a new claim
// @route   POST /api/claims
// @access  Private
export const submitClaim = async (req: AuthRequest, res: Response) => {
  try {
    const {
      flightCode,
      airline,
      disruptionType,
      passenger,
      booking,
      vaultLinkId,
      sentinelAlertId,
    } = req.body;

    const claim = await Claim.create({
      user: req.user._id,
      userId: req.user.firebaseId,
      flightCode,
      airline,
      disruptionType,
      passenger,
      booking,
      vaultLinkId,
      sentinelAlertId,
      documents: [],
      status: 'PENDING',
      currentStep: 1,
      totalSteps: 6,
      progress: 0.16,
    });

    res.status(201).json(claim);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Upload a claim document to Firebase Storage
// @route   POST /api/claims/:id/documents
// @access  Private
export const uploadClaimDocument = async (req: AuthRequest, res: Response) => {
  try {
    const claim = await Claim.findById(req.params.id);

    if (!claim) {
      return res.status(404).json({ message: 'Claim not found' });
    }

    if (claim.user !== req.user._id) {
      return res.status(401).json({ message: 'User not authorized' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Document file is required. Use multipart field "file".' });
    }

    const storedFile = await uploadBufferToFirebaseStorage(
      req.file,
      `claim-documents/${claim._id}`,
      req.user.firebaseId
    );

    const document = {
      id: `${Date.now()}`,
      type: req.body.type || 'Document',
      name: req.body.name || req.file.originalname,
      fileUrl: storedFile.url,
      storagePath: storedFile.path,
      mimeType: req.file.mimetype,
      size: req.file.size,
      uploadedAt: new Date().toISOString(),
    };

    claim.documents = [...(claim.documents || []), document];
    await claim.save();

    res.status(201).json(document);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a claim document from Firebase Storage
// @route   DELETE /api/claims/:id/documents/:documentId
// @access  Private
export const deleteClaimDocument = async (req: AuthRequest, res: Response) => {
  try {
    const claim = await Claim.findById(req.params.id);

    if (!claim) {
      return res.status(404).json({ message: 'Claim not found' });
    }

    if (claim.user !== req.user._id) {
      return res.status(401).json({ message: 'User not authorized' });
    }

    const documents = claim.documents || [];
    const document = documents.find((item: any) => item.id === req.params.documentId);

    if (!document) {
      return res.status(404).json({ message: 'Claim document not found' });
    }

    await deleteFirebaseStorageFile(document.storagePath);
    claim.documents = documents.filter((item: any) => item.id !== req.params.documentId);
    await claim.save();

    res.json({ message: 'Claim document removed' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get user claims
// @route   GET /api/claims
// @access  Private
export const getUserClaims = async (req: AuthRequest, res: Response) => {
  try {
    const claims = await Claim.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json(claims);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single claim detail
// @route   GET /api/claims/:id
// @access  Private
export const getClaimDetails = async (req: AuthRequest, res: Response) => {
  try {
    const claim = await Claim.findById(req.params.id);

    if (!claim) {
      return res.status(404).json({ message: 'Claim not found' });
    }

    if (claim.user !== req.user._id) {
      return res.status(401).json({ message: 'User not authorized' });
    }

    res.json(claim);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update claim status/step
// @route   PATCH /api/claims/:id
// @access  Private
export const updateClaim = async (req: AuthRequest, res: Response) => {
  try {
    const claim = await Claim.findById(req.params.id);

    if (claim) {
      if (claim.user.toString() !== req.user._id.toString()) {
        return res.status(401).json({ message: 'User not authorized' });
      }

      // State Machine Logic: Prevent downgrading from COMPLETED or REJECTED
      if (claim.status === 'COMPLETED' || claim.status === 'REJECTED') {
        return res.status(400).json({ message: `Cannot update a ${claim.status.toLowerCase()} claim` });
      }

      claim.currentStep = req.body.currentStep || claim.currentStep;
      claim.status = req.body.status || claim.status;
      claim.compensationAmount = req.body.compensationAmount || claim.compensationAmount;
      claim.resolutionType = req.body.resolutionType || claim.resolutionType;
      
      // Update progress automatically
      claim.progress = claim.currentStep / claim.totalSteps;

      const updatedClaim = await claim.save();
      res.json(updatedClaim);
    } else {
      res.status(404).json({ message: 'Claim not found' });
    }
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getClaimRequirements = async (_req: AuthRequest, res: Response) => {
  res.json([
    { key: 'ticket', title: 'Flight ticket or boarding pass', required: true },
    { key: 'disruptionProof', title: 'Disruption notice or delay/cancellation proof', required: true },
    { key: 'identity', title: 'Valid ID or passport', required: true },
    { key: 'expenses', title: 'Additional expense receipts', required: false },
  ]);
};

// @desc    Estimate claim eligibility/compensation before final submission
// @route   POST /api/claims/estimate
export const estimateClaim = async (req: AuthRequest, res: Response) => {
  const disruptionType = String(req.body.disruptionType || '').toLowerCase();
  const delayMinutes = Number(req.body.delayMinutes || 0);
  const isEligible = disruptionType.includes('cancel') || delayMinutes >= 120;

  res.json({
    eligible: isEligible,
    estimatedAmount: isEligible ? (delayMinutes >= 240 || disruptionType.includes('cancel') ? 45000 : 30000) : 0,
    currency: 'NGN',
    confidence: isEligible ? 0.78 : 0.42,
    requiredDocuments: ['ticket', 'disruptionProof', 'identity'],
    note: 'Estimate is based on currently provided claim facts and can change after airline review.',
  });
};

// @desc    Create claim from Sentinel alert
// @route   POST /api/claims/from-alert/:alertId
export const createClaimFromAlert = async (req: AuthRequest, res: Response) => {
  try {
    const alert = await Alert.findById(req.params.alertId);

    if (!alert) {
      return res.status(404).json({ message: 'Alert not found' });
    }

    if (alert.user !== req.user._id) {
      return res.status(401).json({ message: 'User not authorized' });
    }

    const claim = await Claim.create({
      user: req.user._id,
      userId: req.user.firebaseId,
      sentinelAlertId: alert._id,
      flightCode: alert.flightCode,
      airline: alert.airline,
      disruptionType: alert.eventType,
      status: 'PENDING',
      currentStep: 1,
      totalSteps: 6,
      progress: 0.16,
      documents: [],
    });

    res.status(201).json(claim);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create claim from Vault document
// @route   POST /api/claims/from-vault/:documentId
export const createClaimFromVault = async (req: AuthRequest, res: Response) => {
  try {
    const document = await Document.findById(req.params.documentId);

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    if (document.user !== req.user._id) {
      return res.status(401).json({ message: 'User not authorized' });
    }

    const claim = await Claim.create({
      user: req.user._id,
      userId: req.user.firebaseId,
      vaultLinkId: document._id,
      flightCode: req.body.flightCode || '',
      airline: req.body.airline || '',
      disruptionType: req.body.disruptionType || '',
      status: 'PENDING',
      currentStep: 1,
      totalSteps: 6,
      progress: 0.16,
      documents: [
        {
          id: document._id,
          type: document.type,
          name: document.name,
          fileUrl: document.fileUrl,
          storagePath: document.storagePath,
          linkedFromVault: true,
        },
      ],
    });

    res.status(201).json(claim);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Final submit action for claim workflow
// @route   POST /api/claims/:id/submit
export const submitClaimForReview = async (req: AuthRequest, res: Response) => {
  try {
    const claim = await Claim.findById(req.params.id);

    if (!claim) {
      return res.status(404).json({ message: 'Claim not found' });
    }

    if (claim.user !== req.user._id) {
      return res.status(401).json({ message: 'User not authorized' });
    }

    if (claim.status === 'COMPLETED' || claim.status === 'REJECTED') {
      return res.status(400).json({ message: `Cannot submit a ${claim.status.toLowerCase()} claim` });
    }

    claim.status = 'SUBMITTED';
    claim.currentStep = claim.totalSteps || 6;
    claim.progress = 1;
    claim.submittedAt = new Date().toISOString();
    await claim.save();

    res.json(claim);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Move claim to escalation/review workflow
// @route   POST /api/claims/:id/escalate
export const escalateClaim = async (req: AuthRequest, res: Response) => {
  try {
    const claim = await Claim.findById(req.params.id);

    if (!claim) {
      return res.status(404).json({ message: 'Claim not found' });
    }

    if (claim.user !== req.user._id) {
      return res.status(401).json({ message: 'User not authorized' });
    }

    claim.status = 'ESCALATED';
    claim.escalatedAt = new Date().toISOString();
    claim.escalationReason = req.body.reason || 'User requested escalation';
    claim.timeline = [
      ...(claim.timeline || []),
      {
        title: 'Claim Escalated',
        status: 'completed',
        at: claim.escalatedAt,
        note: claim.escalationReason,
      },
    ];
    await claim.save();

    res.json(claim);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Return evidence packet metadata for claim success/download action
// @route   GET /api/claims/:id/evidence-packet
export const getClaimEvidencePacket = async (req: AuthRequest, res: Response) => {
  try {
    const claim = await Claim.findById(req.params.id);

    if (!claim) {
      return res.status(404).json({ message: 'Claim not found' });
    }

    if (claim.user !== req.user._id) {
      return res.status(401).json({ message: 'User not authorized' });
    }

    res.json({
      claimId: claim._id,
      status: claim.status,
      documents: claim.documents || [],
      notesCount: (claim.notes || []).length,
      generatedAt: new Date().toISOString(),
      downloadStatus: 'metadata-ready',
      providerStatus: 'pdf-generation-not-configured',
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get claim timeline/progress events
// @route   GET /api/claims/:id/timeline
export const getClaimTimeline = async (req: AuthRequest, res: Response) => {
  try {
    const claim = await Claim.findById(req.params.id);

    if (!claim) {
      return res.status(404).json({ message: 'Claim not found' });
    }

    if (claim.user !== req.user._id) {
      return res.status(401).json({ message: 'User not authorized' });
    }

    const timeline = claim.timeline || [
      { title: 'Claim Created', status: 'completed', at: claim.createdAt },
      { title: 'Documents Uploaded', status: (claim.documents || []).length ? 'completed' : 'pending' },
      { title: 'Submitted for Review', status: claim.submittedAt ? 'completed' : 'pending', at: claim.submittedAt },
      { title: 'Airline Response', status: ['COMPLETED', 'REJECTED'].includes(claim.status) ? 'completed' : 'pending' },
    ];

    res.json(timeline);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    List claim notes
// @route   GET /api/claims/:id/notes
export const getClaimNotes = async (req: AuthRequest, res: Response) => {
  try {
    const claim = await Claim.findById(req.params.id);

    if (!claim) {
      return res.status(404).json({ message: 'Claim not found' });
    }

    if (claim.user !== req.user._id) {
      return res.status(401).json({ message: 'User not authorized' });
    }

    res.json(claim.notes || []);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Add claim note
// @route   POST /api/claims/:id/notes
export const addClaimNote = async (req: AuthRequest, res: Response) => {
  try {
    const claim = await Claim.findById(req.params.id);

    if (!claim) {
      return res.status(404).json({ message: 'Claim not found' });
    }

    if (claim.user !== req.user._id) {
      return res.status(401).json({ message: 'User not authorized' });
    }

    if (!req.body.text) {
      return res.status(400).json({ message: 'Note text is required' });
    }

    const note = {
      id: `${Date.now()}`,
      text: req.body.text,
      authorId: req.user.firebaseId,
      authorName: req.user.displayName || req.user.email,
      createdAt: new Date().toISOString(),
    };

    claim.notes = [...(claim.notes || []), note];
    await claim.save();

    res.status(201).json(note);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete claim note
// @route   DELETE /api/claims/:id/notes/:noteId
export const deleteClaimNote = async (req: AuthRequest, res: Response) => {
  try {
    const claim = await Claim.findById(req.params.id);

    if (!claim) {
      return res.status(404).json({ message: 'Claim not found' });
    }

    if (claim.user !== req.user._id) {
      return res.status(401).json({ message: 'User not authorized' });
    }

    claim.notes = (claim.notes || []).filter((note: any) => note.id !== req.params.noteId);
    await claim.save();

    res.json({ message: 'Claim note removed' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

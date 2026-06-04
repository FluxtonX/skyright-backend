import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import Document from '../models/documentModel';
import Claim from '../models/claimModel';
import { processDocumentOCR } from '../services/ocrService';
import { deleteFirebaseStorageFile, uploadBufferToFirebaseStorage } from '../services/storageService';

// @desc    Upload/save document and process OCR
// @route   POST /api/vault
// @access  Private
export const uploadDocument = async (req: AuthRequest, res: Response) => {
  try {
    const { name, type, fileUrl } = req.body;
    let resolvedFileUrl = fileUrl;
    let storagePath = '';

    if (req.file) {
      const storedFile = await uploadBufferToFirebaseStorage(req.file, 'vault-documents', req.user.firebaseId);
      resolvedFileUrl = storedFile.url;
      storagePath = storedFile.path;
    }

    if (!resolvedFileUrl) {
      return res.status(400).json({ message: 'File is required. Send multipart field "file" or JSON fileUrl.' });
    }

    const documentType = type || 'Document';
    const ocrData = await processDocumentOCR(resolvedFileUrl, documentType);

    const document = await Document.create({
      user: req.user._id,
      userId: req.user.firebaseId,
      name: name || req.file?.originalname || 'Document',
      type: documentType,
      fileUrl: resolvedFileUrl,
      storagePath,
      mimeType: req.file?.mimetype || '',
      size: req.file?.size || 0,
      ocrData,
    });

    res.status(201).json(document);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get user documents
// @route   GET /api/vault
// @access  Private
export const getUserDocuments = async (req: AuthRequest, res: Response) => {
  try {
    const documents = await Document.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json(documents);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get one vault document
// @route   GET /api/vault/:id
// @access  Private
export const getDocumentDetails = async (req: AuthRequest, res: Response) => {
  try {
    const document = await Document.findById(req.params.id);

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    if (document.user !== req.user._id) {
      return res.status(401).json({ message: 'User not authorized' });
    }

    res.json(document);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update vault document metadata
// @route   PATCH /api/vault/:id
// @access  Private
export const updateDocument = async (req: AuthRequest, res: Response) => {
  try {
    const document = await Document.findById(req.params.id);

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    if (document.user !== req.user._id) {
      return res.status(401).json({ message: 'User not authorized' });
    }

    ['name', 'type', 'tags', 'notes'].forEach((field) => {
      if (req.body[field] !== undefined) {
        document[field] = req.body[field];
      }
    });

    await document.save();
    res.json(document);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Link vault document to an existing claim
// @route   POST /api/vault/:id/link-claim
// @access  Private
export const linkDocumentToClaim = async (req: AuthRequest, res: Response) => {
  try {
    const { claimId } = req.body;
    const [document, claim] = await Promise.all([
      Document.findById(req.params.id),
      Claim.findById(claimId),
    ]);

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    if (!claim) {
      return res.status(404).json({ message: 'Claim not found' });
    }

    if (document.user !== req.user._id || claim.user !== req.user._id) {
      return res.status(401).json({ message: 'User not authorized' });
    }

    const linkedDocument = {
      id: document._id,
      type: document.type,
      name: document.name,
      fileUrl: document.fileUrl,
      storagePath: document.storagePath,
      linkedFromVault: true,
    };

    claim.documents = [
      ...((claim.documents || []).filter((item: any) => item.id !== document._id)),
      linkedDocument,
    ];
    document.linkedClaimIds = Array.from(new Set([...(document.linkedClaimIds || []), claim._id]));

    await Promise.all([claim.save(), document.save()]);

    res.json({ document, claim });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete document
// @route   DELETE /api/vault/:id
// @access  Private
export const deleteDocument = async (req: AuthRequest, res: Response) => {
  try {
    const document = await Document.findById(req.params.id);

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    if (document.user !== req.user._id) {
      return res.status(401).json({ message: 'User not authorized' });
    }

    await deleteFirebaseStorageFile(document.storagePath);
    await document.deleteOne();

    res.json({ message: 'Document removed' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

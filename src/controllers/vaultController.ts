import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import Document from '../models/documentModel';
import { processDocumentOCR } from '../services/ocrService';

// @desc    Upload document and process OCR
// @route   POST /api/vault/upload
// @access  Private
export const uploadDocument = async (req: AuthRequest, res: Response) => {
  try {
    const { name, type, fileUrl } = req.body;

    if (!fileUrl) {
      return res.status(400).json({ message: 'File URL is required' });
    }

    // Process OCR
    const ocrData = await processDocumentOCR(fileUrl, type);

    const document = await Document.create({
      user: req.user._id,
      name,
      type,
      fileUrl,
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

// @desc    Delete document
// @route   DELETE /api/vault/:id
// @access  Private
export const deleteDocument = async (req: AuthRequest, res: Response) => {
  try {
    const document = await Document.findById(req.params.id);

    if (document) {
      if (document.user.toString() !== req.user._id.toString()) {
        return res.status(401).json({ message: 'User not authorized' });
      }

      await document.deleteOne();
      res.json({ message: 'Document removed' });
    } else {
      res.status(404).json({ message: 'Document not found' });
    }
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

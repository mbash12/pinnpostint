import express from 'express';
import {
    getLegalDocuments,
    getLegalDocumentBySlug,
    getLegalDocumentById,
    createLegalDocument,
    updateLegalDocument,
    deleteLegalDocument,
} from '../controllers/legalDocumentsController';
import { adminAuth } from '../middleware/auth';

const router = express.Router();

// Public routes
router.get('/', getLegalDocuments);
router.get('/slug/:slug', getLegalDocumentBySlug);

// Admin routes (Protected)
router.get('/:id', adminAuth, getLegalDocumentById);
router.post('/', adminAuth, createLegalDocument);
router.put('/:id', adminAuth, updateLegalDocument);
router.delete('/:id', adminAuth, deleteLegalDocument);

export default router;

import { Router } from 'express';
import {
  createFaq,
  getAllFaqs,
  getFaqById,
  updateFaq,
  reorderFaqs,
  deleteFaq,
  getPublicFaqs
} from '../controllers/faqController';
import { getPublicFaqCategories } from '../controllers/faqCategoryController';
import { adminAuth } from '../middleware/auth';

const router = Router();

// Admin FAQ routes (require admin authentication)
router.post('/admin/faqs', adminAuth, createFaq);
router.get('/admin/faqs', adminAuth, getAllFaqs);
router.put('/admin/faqs/reorder', adminAuth, reorderFaqs); // Move this before the :faqId routes
router.get('/admin/faqs/:faqId', adminAuth, getFaqById);
router.put('/admin/faqs/:faqId', adminAuth, updateFaq);
router.delete('/admin/faqs/:faqId', adminAuth, deleteFaq);

// Public FAQ routes (no authentication required)
router.get('/public/faqs', getPublicFaqs);
router.get('/public/faq-categories', getPublicFaqCategories);

export default router;
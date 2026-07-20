import { Router } from 'express';
import {
  createFaqCategory,
  getAllFaqCategories,
  getFaqCategoryById,
  updateFaqCategory,
  deleteFaqCategory
} from '../controllers/faqCategoryController';
import { authenticate, requireAdmin } from '../middleware/auth';

const router = Router();

// All FAQ category routes require authentication and admin role
router.use(authenticate);
router.use(requireAdmin);

// FAQ category CRUD routes
router.post('/', createFaqCategory);
router.get('/', getAllFaqCategories);
router.get('/:categoryId', getFaqCategoryById);
router.put('/:categoryId', updateFaqCategory);
router.delete('/:categoryId', deleteFaqCategory);

export default router;
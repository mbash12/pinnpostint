import { Router } from 'express';
import {
  createBlogCategory,
  getAllBlogCategories,
  getBlogCategoryById,
  updateBlogCategory,
  deleteBlogCategory,
  getPublicBlogCategories
} from '../controllers/blogCategoryController';
import { adminAuth } from '../middleware/auth';

const router = Router();

// Admin routes (require admin authentication)
router.post('/admin/blog-categories', adminAuth, createBlogCategory);
router.get('/admin/blog-categories', adminAuth, getAllBlogCategories);
router.get('/admin/blog-categories/:categoryId', adminAuth, getBlogCategoryById);
router.put('/admin/blog-categories/:categoryId', adminAuth, updateBlogCategory);
router.delete('/admin/blog-categories/:categoryId', adminAuth, deleteBlogCategory);

// Public routes (no authentication required)
router.get('/public/blog-categories', getPublicBlogCategories);

export default router;
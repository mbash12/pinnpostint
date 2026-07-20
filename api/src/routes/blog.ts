import { Router } from 'express';
import {
  createBlog,
  getAllBlog,
  getBlogById,
  updateBlog,
  deleteBlog,
  getPublicBlog,
  getPublicBlogByIdOrSlug
} from '../controllers/blogController';
import { adminAuth } from '../middleware/auth';

const router = Router();

// Admin routes (require admin authentication)
router.post('/admin/blogs', adminAuth, createBlog);
router.get('/admin/blogs', adminAuth, getAllBlog);
router.get('/admin/blogs/:blogId', adminAuth, getBlogById);
router.put('/admin/blogs/:blogId', adminAuth, updateBlog);
router.delete('/admin/blogs/:blogId', adminAuth, deleteBlog);

// Public routes (no authentication required)
router.get('/public/blogs', getPublicBlog);
router.get('/public/blogs/:idOrSlug', getPublicBlogByIdOrSlug);

export default router;
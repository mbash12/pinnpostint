import { Router } from 'express';
import {
  createCategory,
  getAllCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
  createSubcategory,
  getSubcategoriesByCategory,
  getSubcategoryById,
  updateSubcategory,
  deleteSubcategory,
  getCategoriesForAdCreation
} from '../controllers/adminCategoriesController';

const router = Router();

// Category Routes
router.post('/', createCategory);
router.get('/', getAllCategories);
router.get('/for-ad-creation', getCategoriesForAdCreation);
router.get('/:categoryId', getCategoryById);
router.put('/:categoryId', updateCategory);
router.delete('/:categoryId', deleteCategory);

// Subcategory Routes
router.post('/:categoryId/subcategories', createSubcategory);
router.get('/:categoryId/subcategories', getSubcategoriesByCategory);

// Standalone subcategory routes (with /subcategories prefix to avoid conflicts)
router.get('/subcategories/:subcategoryId', getSubcategoryById);
router.put('/subcategories/:subcategoryId', updateSubcategory);
router.delete('/subcategories/:subcategoryId', deleteSubcategory);

export default router;
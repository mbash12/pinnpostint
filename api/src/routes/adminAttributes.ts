import { Router } from 'express';
import {
  createAttribute,
  getAttributesBySubcategory,
  getAttributeById,
  updateAttribute,
  deleteAttribute
} from '../controllers/adminCategoriesController';

const router = Router();

// Attribute Routes under subcategories
router.post('/subcategories/:subcategoryId/attributes', createAttribute);
router.get('/subcategories/:subcategoryId/attributes', getAttributesBySubcategory);

// Standalone attribute routes
router.get('/attributes/:attributeId', getAttributeById);
router.put('/attributes/:attributeId', updateAttribute);
router.delete('/attributes/:attributeId', deleteAttribute);

export default router;

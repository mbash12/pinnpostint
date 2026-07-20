import { Router } from 'express';
import {
  uploadSingleImage,
  uploadMultipleImages,
  uploadDocument,
  uploadFile,
  deleteFile,
  getUploadLimits
} from '../controllers/uploadController';
import {
  uploadImage,
  uploadMultipleImages as uploadMultipleImagesMiddleware,
  uploadDocument as uploadDocumentMiddleware,
  uploadAny
} from '../middleware/upload';
import { authenticate } from '../middleware/auth';

const router = Router();

// All upload routes require authentication
router.use(authenticate);

// Single image upload
router.post('/image', uploadImage.single('image'), uploadSingleImage);

// Multiple images upload
router.post('/images', uploadMultipleImagesMiddleware.array('images', 10), uploadMultipleImages);

// Document upload
router.post('/document', uploadDocumentMiddleware.single('document'), uploadDocument);

// Any file upload
router.post('/file', uploadAny.single('file'), uploadFile);

// Delete file
router.delete('/delete', deleteFile);

// Get upload limits configuration
router.get('/limits', getUploadLimits);

export default router;

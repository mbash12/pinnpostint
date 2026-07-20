import { Request, Response, NextFunction } from 'express';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { 
  FileUploadResponse, 
  MultipleFileUploadResponse, 
  transformFileUpload,
  FileUploadLimits 
} from '../types/standardized-models';
import { ResponseHelper } from '../utils/response-helpers';
import { ErrorCode } from '../types/api-responses';
import config from '../config/environment';

/**
 * @swagger
 * components:
 *   schemas:
 *     FileUploadResponse:
 *       type: object
 *       properties:
 *         filename:
 *           type: string
 *           description: Generated filename on server
 *         originalName:
 *           type: string
 *           description: Original filename from client
 *         path:
 *           type: string
 *           description: Relative path to file
 *         url:
 *           type: string
 *           description: Full URL to access the file
 *         size:
 *           type: number
 *           description: File size in bytes
 *         mimetype:
 *           type: string
 *           description: MIME type of the file
 *         uploadedAt:
 *           type: string
 *           format: date-time
 *           description: Upload timestamp
 *     MultipleFileUploadResponse:
 *       type: object
 *       properties:
 *         files:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/FileUploadResponse'
 *         totalFiles:
 *           type: number
 *           description: Total number of files uploaded
 *         totalSize:
 *           type: number
 *           description: Total size of all files in bytes
 * 
 * /upload/image:
 *   post:
 *     tags:
 *       - Upload
 *     summary: Upload a single image
 *     description: Upload and optimize a single image file with standardized response format
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Image file to upload (JPEG, PNG, GIF, WebP, SVG, max 5MB)
 *     responses:
 *       200:
 *         description: Image uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Image uploaded successfully
 *                 data:
 *                   $ref: '#/components/schemas/FileUploadResponse'
 *       400:
 *         description: No file uploaded or invalid file
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
// File upload limits configuration
const UPLOAD_LIMITS: FileUploadLimits = {
  image: {
    maxSize: 10 * 1024 * 1024, // 10MB
    allowedTypes: [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml'
    ],
    maxFiles: 10
  },
  document: {
    maxSize: 10 * 1024 * 1024, // 10MB
    allowedTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/csv'
    ],
    maxFiles: 5
  },
  any: {
    maxSize: 10 * 1024 * 1024, // 10MB
    allowedTypes: [
      // Images
      'image/jpeg',
      'image/jpg',
      'image/png', 
      'image/gif',
      'image/webp',
      'image/svg+xml',
      // Documents
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/csv'
    ],
    maxFiles: 10
  }
};

/**
 * Optimize image file if it's not SVG
 */
const optimizeImage = async (filePath: string, mimetype: string): Promise<void> => {
  if (mimetype === 'image/svg+xml') {
    return; // Skip SVG optimization
  }

  try {
    // Limit sharp to 1 thread to prevent CPU starvation on 2GB VPS
    sharp.concurrency(1);

    await sharp(filePath)
      .resize(1600, 1600, { // Reduced from 1920 for faster processing
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ 
        quality: 80, // Reduced from 85 for smaller file size
        mozjpeg: true // Better compression
      })
      .toFile(filePath + '.optimized');

    // Replace original with optimized
    if (fs.existsSync(filePath + '.optimized')) {
      fs.unlinkSync(filePath);
      fs.renameSync(filePath + '.optimized', filePath);
    }
  } catch (error) {
    console.error('Image optimization error:', error);
    // Continue even if optimization fails to prevent request hang
  }
};

export const uploadSingleImage = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.file) {
      ResponseHelper.error(res, 400, ErrorCode.VALIDATION_ERROR, 'No file uploaded');
      return;
    }

    const file = req.file;
    // Use the configured API base URL instead of the request host
    // Priority: API_BASE_URL env var > request protocol/host (fallback for dev)
    const baseUrl = config.apiBaseUrl || `${req.protocol}://${req.get('host')}`;

    // Optimize image
    await optimizeImage(file.path, file.mimetype);

    // Transform to standardized response
    const fileData: FileUploadResponse = transformFileUpload(file, baseUrl);

    ResponseHelper.success(res, fileData, 'Image uploaded successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /upload/images:
 *   post:
 *     tags:
 *       - Upload
 *     summary: Upload multiple images
 *     description: Upload and optimize multiple image files with standardized response format
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Image files to upload (max 10 files, 5MB each)
 *     responses:
 *       200:
 *         description: Images uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: 3 image(s) uploaded successfully
 *                 data:
 *                   $ref: '#/components/schemas/MultipleFileUploadResponse'
 *       400:
 *         description: No files uploaded
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
export const uploadMultipleImages = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      ResponseHelper.error(res, 400, ErrorCode.VALIDATION_ERROR, 'No files uploaded');
      return;
    }

    const files = req.files;
    // Use the configured API base URL instead of the request host
    const baseUrl = config.apiBaseUrl || `${req.protocol}://${req.get('host')}`;
    const uploadedFiles: FileUploadResponse[] = [];
    let totalSize = 0;

    // Process each file
    for (const file of files) {
      // Optimize image
      await optimizeImage(file.path, file.mimetype);

      // Transform to standardized response
      const fileData = transformFileUpload(file, baseUrl);
      uploadedFiles.push(fileData);
      totalSize += file.size;
    }

    const response: MultipleFileUploadResponse = {
      files: uploadedFiles,
      totalFiles: uploadedFiles.length,
      totalSize
    };

    ResponseHelper.success(res, response, `${uploadedFiles.length} image(s) uploaded successfully`);
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /upload/document:
 *   post:
 *     tags:
 *       - Upload
 *     summary: Upload a document
 *     description: Upload a document file with standardized response format
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               document:
 *                 type: string
 *                 format: binary
 *                 description: Document file to upload (PDF, DOC, DOCX, XLS, XLSX, TXT, CSV, max 10MB)
 *     responses:
 *       200:
 *         description: Document uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Document uploaded successfully
 *                 data:
 *                   $ref: '#/components/schemas/FileUploadResponse'
 *       400:
 *         description: No file uploaded
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
export const uploadDocument = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.file) {
      ResponseHelper.error(res, 400, ErrorCode.VALIDATION_ERROR, 'No file uploaded');
      return;
    }

    const file = req.file;
    // Use the configured API base URL instead of the request host
    const baseUrl = config.apiBaseUrl || `${req.protocol}://${req.get('host')}`;

    // Transform to standardized response
    const fileData: FileUploadResponse = transformFileUpload(file, baseUrl);

    ResponseHelper.success(res, fileData, 'Document uploaded successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /upload/file:
 *   post:
 *     tags:
 *       - Upload
 *     summary: Upload any supported file
 *     description: Upload any supported file type with automatic optimization for images
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: File to upload (images or documents, max 10MB)
 *     responses:
 *       200:
 *         description: File uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: File uploaded successfully
 *                 data:
 *                   $ref: '#/components/schemas/FileUploadResponse'
 *       400:
 *         description: No file uploaded
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
export const uploadFile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.file) {
      ResponseHelper.error(res, 400, ErrorCode.VALIDATION_ERROR, 'No file uploaded');
      return;
    }

    const file = req.file;
    // Use the configured API base URL instead of the request host
    const baseUrl = config.apiBaseUrl || `${req.protocol}://${req.get('host')}`;

    // Optimize if it's an image
    if (file.mimetype.startsWith('image/')) {
      await optimizeImage(file.path, file.mimetype);
    }

    // Transform to standardized response
    const fileData: FileUploadResponse = transformFileUpload(file, baseUrl);

    ResponseHelper.success(res, fileData, 'File uploaded successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /upload/delete:
 *   delete:
 *     tags:
 *       - Upload
 *     summary: Delete an uploaded file
 *     description: Delete a previously uploaded file with standardized response format
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - path
 *             properties:
 *               path:
 *                 type: string
 *                 description: Relative path of the file to delete
 *     responses:
 *       200:
 *         description: File deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: File deleted successfully
 *       400:
 *         description: Invalid path
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: File not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 * 
 * /upload/limits:
 *   get:
 *     tags:
 *       - Upload
 *     summary: Get upload configuration limits
 *     description: Retrieve the current upload limits and allowed file types
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Upload limits retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Upload limits retrieved successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     image:
 *                       type: object
 *                       properties:
 *                         maxSize:
 *                           type: number
 *                           example: 5242880
 *                         allowedTypes:
 *                           type: array
 *                           items:
 *                             type: string
 *                         maxFiles:
 *                           type: number
 *                           example: 10
 *                     document:
 *                       type: object
 *                       properties:
 *                         maxSize:
 *                           type: number
 *                           example: 10485760
 *                         allowedTypes:
 *                           type: array
 *                           items:
 *                             type: string
 *                         maxFiles:
 *                           type: number
 *                           example: 5
 *                     any:
 *                       type: object
 *                       properties:
 *                         maxSize:
 *                           type: number
 *                           example: 10485760
 *                         allowedTypes:
 *                           type: array
 *                           items:
 *                             type: string
 *                         maxFiles:
 *                           type: number
 *                           example: 10
 */
export const deleteFile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { path: filePath } = req.body;

    if (!filePath) {
      ResponseHelper.error(res, 400, ErrorCode.VALIDATION_ERROR, 'File path is required');
      return;
    }

    // Security: Ensure path is within uploads directory
    const fullPath = path.join(process.cwd(), filePath);
    const uploadsDir = path.join(process.cwd(), 'uploads');

    if (!fullPath.startsWith(uploadsDir)) {
      ResponseHelper.error(res, 400, ErrorCode.VALIDATION_ERROR, 'Invalid file path');
      return;
    }

    // Check if file exists
    if (!fs.existsSync(fullPath)) {
      ResponseHelper.error(res, 404, ErrorCode.NOT_FOUND, 'File not found');
      return;
    }

    // Delete the file
    fs.unlinkSync(fullPath);

    ResponseHelper.success(res, null, 'File deleted successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Get upload configuration limits
 */
export const getUploadLimits = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    ResponseHelper.success(res, UPLOAD_LIMITS, 'Upload limits retrieved successfully');
  } catch (error) {
    next(error);
  }
};

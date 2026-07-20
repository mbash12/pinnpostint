import { Request, Response } from 'express';
import { prisma } from '../utils/database';
import { Prisma } from '@prisma/client';
import Joi from 'joi';

interface AuthRequest extends Request {
  user?: {
    id: string;
    role: string;
    email?: string;
    phone: string;
  };
}

// Validation schemas
const createFaqSchema = Joi.object({
  question: Joi.string().required().min(1).max(500),
  answer: Joi.string().required().min(1).max(2000),
  categoryId: Joi.string().uuid().optional(),
  order: Joi.number().integer().min(0).default(0),
  isActive: Joi.boolean().default(true)
});

const updateFaqSchema = Joi.object({
  question: Joi.string().min(1).max(500),
  answer: Joi.string().min(1).max(2000),
  categoryId: Joi.string().uuid().optional(),
  order: Joi.number().integer().min(0),
  isActive: Joi.boolean()
});

const reorderFaqsSchema = Joi.object({
  faqs: Joi.array().items(
    Joi.object({
      id: Joi.string().uuid().required(),
      order: Joi.number().integer().min(0).required()
    })
  ).required().min(1)
});

interface FaqOrderItem {
  id: string;
  order: number;
}

/**
 * @swagger
 * /api/v1/admin/faqs:
 *   post:
 *     summary: Create a new FAQ
 *     tags: [Admin - FAQs]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - question
 *               - answer
 *             properties:
 *               question:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 500
 *                 example: "How do I create an account?"
 *               answer:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 2000
 *                 example: "To create an account, click on the Sign Up button..."
 *               order:
 *                 type: integer
 *                 minimum: 0
 *                 default: 0
 *                 example: 1
 *               isActive:
 *                 type: boolean
 *                 default: true
 *                 example: true
 *     responses:
 *       201:
 *         description: FAQ created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     question:
 *                       type: string
 *                     answer:
 *                       type: string
 *                     order:
 *                       type: integer
 *                     isActive:
 *                       type: boolean
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
export const createFaq = async (req: AuthRequest, res: Response) => {
  try {
    const { error, value } = createFaqSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input data',
          details: error.details.map(detail => detail.message)
        }
      });
    }

    const faq = await prisma.faq.create({
      data: value,
      include: {
        category: true
      }
    });

    return res.status(201).json({
      success: true,
      data: faq
    });
  } catch (error) {
    console.error('Error creating FAQ:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to create FAQ'
      }
    });
  }
};

/**
 * @swagger
 * /api/v1/admin/faqs:
 *   get:
 *     summary: Get all FAQs (admin view)
 *     tags: [Admin - FAQs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Number of FAQs per page
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search in question and answer
 *     responses:
 *       200:
 *         description: FAQs retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       question:
 *                         type: string
 *                       answer:
 *                         type: string
 *                       order:
 *                         type: integer
 *                       isActive:
 *                         type: boolean
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
export const getAllFaqs = async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
    const isActive = req.query.isActive ? req.query.isActive === 'true' : undefined;
    const search = req.query.search as string;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.FaqWhereInput = {};
    if (isActive !== undefined) {
      where.isActive = isActive;
    }
    if (search) {
      where.OR = [
        { question: { contains: search, mode: 'insensitive' } },
        { answer: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [faqs, total] = await Promise.all([
      prisma.faq.findMany({
        where,
        include: {
          category: true
        },
        orderBy: [
          { order: 'asc' },
          { createdAt: 'desc' }
        ],
        skip,
        take: limit
      }),
      prisma.faq.count({ where })
    ]);

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: faqs,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: total,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching FAQs:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch FAQs'
      }
    });
  }
};

/**
 * @swagger
 * /api/v1/admin/faqs/{faqId}:
 *   get:
 *     summary: Get a specific FAQ
 *     tags: [Admin - FAQs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: faqId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: FAQ ID
 *     responses:
 *       200:
 *         description: FAQ retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     question:
 *                       type: string
 *                     answer:
 *                       type: string
 *                     order:
 *                       type: integer
 *                     isActive:
 *                       type: boolean
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
export const getFaqById = async (req: AuthRequest, res: Response) => {
  try {
    const { faqId } = req.params;

    if (!faqId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(faqId)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_FAQ_ID',
          message: 'Invalid FAQ ID format'
        }
      });
    }

    const faq = await prisma.faq.findUnique({
      where: { id: faqId },
      include: {
        category: true
      }
    });

    if (!faq) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'FAQ_NOT_FOUND',
          message: 'FAQ not found'
        }
      });
    }

    return res.json({
      success: true,
      data: faq
    });
  } catch (error) {
    console.error('Error fetching FAQ:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch FAQ'
      }
    });
  }
};

/**
 * @swagger
 * /api/v1/admin/faqs/{faqId}:
 *   put:
 *     summary: Update an FAQ
 *     tags: [Admin - FAQs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: faqId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: FAQ ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               question:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 500
 *                 example: "How do I reset my password?"
 *               answer:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 2000
 *                 example: "To reset your password, click on 'Forgot Password'..."
 *               order:
 *                 type: integer
 *                 minimum: 0
 *                 example: 2
 *               isActive:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: FAQ updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     question:
 *                       type: string
 *                     answer:
 *                       type: string
 *                     order:
 *                       type: integer
 *                     isActive:
 *                       type: boolean
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
export const updateFaq = async (req: AuthRequest, res: Response) => {
  try {
    const { faqId } = req.params;

    if (!faqId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(faqId)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_FAQ_ID',
          message: 'Invalid FAQ ID format'
        }
      });
    }

    const { error, value } = updateFaqSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input data',
          details: error.details.map(detail => detail.message)
        }
      });
    }

    // Check if FAQ exists
    const existingFaq = await prisma.faq.findUnique({
      where: { id: faqId }
    });

    if (!existingFaq) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'FAQ_NOT_FOUND',
          message: 'FAQ not found'
        }
      });
    }

    const updatedFaq = await prisma.faq.update({
      where: { id: faqId },
      data: value
    });

    return res.json({
      success: true,
      data: updatedFaq
    });
  } catch (error) {
    console.error('Error updating FAQ:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to update FAQ'
      }
    });
  }
};

/**
 * @swagger
 * /api/v1/admin/faqs/reorder:
 *   put:
 *     summary: Reorder FAQ entries
 *     tags: [Admin - FAQs]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - faqs
 *             properties:
 *               faqs:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - id
 *                     - order
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                       example: "123e4567-e89b-12d3-a456-426614174000"
 *                     order:
 *                       type: integer
 *                       minimum: 0
 *                       example: 1
 *     responses:
 *       200:
 *         description: FAQs reordered successfully
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
 *                   example: "FAQs reordered successfully"
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
export const reorderFaqs = async (req: AuthRequest, res: Response) => {
  try {
    // First validate the basic structure
    if (!req.body.faqs || !Array.isArray(req.body.faqs) || req.body.faqs.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input data',
          details: ['faqs array is required and must not be empty']
        }
      });
    }

    // First validate with Joi for structure and format validation
    const { error, value } = reorderFaqsSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input data',
          details: error.details.map(detail => detail.message)
        }
      });
    }

    const { faqs } = value;

    // Verify all FAQs exist after Joi validation passes
    const faqIds = faqs.map((faq: FaqOrderItem) => faq.id);
    const existingFaqs = await prisma.faq.findMany({
      where: { id: { in: faqIds } },
      select: { id: true }
    });

    if (existingFaqs.length !== faqIds.length) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_FAQ_IDS',
          message: 'One or more FAQ IDs are invalid'
        }
      });
    }

    // Update orders in a transaction
    await prisma.$transaction(
      faqs.map((faq: FaqOrderItem) =>
        prisma.faq.update({
          where: { id: faq.id },
          data: { order: faq.order }
        })
      )
    );

    return res.json({
      success: true,
      message: 'FAQs reordered successfully'
    });
  } catch (error) {
    console.error('Error reordering FAQs:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to reorder FAQs'
      }
    });
  }
};

/**
 * @swagger
 * /api/v1/admin/faqs/{faqId}:
 *   delete:
 *     summary: Delete an FAQ
 *     tags: [Admin - FAQs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: faqId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: FAQ ID
 *     responses:
 *       204:
 *         description: FAQ deleted successfully
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
export const deleteFaq = async (req: AuthRequest, res: Response) => {
  try {
    const { faqId } = req.params;

    if (!faqId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(faqId)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_FAQ_ID',
          message: 'Invalid FAQ ID format'
        }
      });
    }

    // Check if FAQ exists
    const existingFaq = await prisma.faq.findUnique({
      where: { id: faqId }
    });

    if (!existingFaq) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'FAQ_NOT_FOUND',
          message: 'FAQ not found'
        }
      });
    }

    await prisma.faq.delete({
      where: { id: faqId }
    });

    return res.status(204).send();
  } catch (error) {
    console.error('Error deleting FAQ:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to delete FAQ'
      }
    });
  }
};

/**
 * @swagger
 * /api/v1/public/faqs:
 *   get:
 *     summary: Get frequently asked questions (public)
 *     tags: [Public - Content]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *         description: Number of FAQs to return
 *     responses:
 *       200:
 *         description: FAQs retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       question:
 *                         type: string
 *                       answer:
 *                         type: string
 *                       order:
 *                         type: integer
 */
export const getPublicFaqs = async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

    const faqs = await prisma.faq.findMany({
      where: { isActive: true },
      select: {
        id: true,
        question: true,
        answer: true,
        order: true,
        category: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: [
        { order: 'asc' },
        { createdAt: 'desc' }
      ],
      take: limit
    });

    res.json({
      success: true,
      data: faqs
    });
  } catch (error) {
    console.error('Error fetching public FAQs:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch FAQs'
      }
    });
  }
};
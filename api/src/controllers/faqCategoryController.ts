import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/database';
import Joi from 'joi';

// Validation schemas
const createFaqCategorySchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  slug: Joi.string().min(1).max(100).optional(),
  description: Joi.string().max(500).optional(),
  order: Joi.number().integer().min(0).optional(),
  isActive: Joi.boolean().optional().default(true)
});

const updateFaqCategorySchema = Joi.object({
  name: Joi.string().min(1).max(100).optional(),
  slug: Joi.string().min(1).max(100).optional(),
  description: Joi.string().max(500).optional(),
  order: Joi.number().integer().min(0).optional(),
  isActive: Joi.boolean().optional()
});

const categoryIdSchema = Joi.object({
  categoryId: Joi.string().uuid().required()
});

// Utility function to generate slug from name
const generateSlug = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
};

/**
 * @swagger
 * /api/v1/admin/faq-categories:
 *   post:
 *     summary: Create a FAQ category
 *     tags: [Admin - FAQ Categories]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 100
 *               slug:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 100
 *               description:
 *                 type: string
 *                 maxLength: 500
 *               order:
 *                 type: integer
 *                 minimum: 0
 *               isActive:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: FAQ category created successfully
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
export const createFaqCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { error, value } = createFaqCategorySchema.validate(req.body);
    if (error) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message
        }
      });
      return;
    }

    const { name, slug, description, order, isActive } = value;
    const finalSlug = slug || generateSlug(name);

    const category = await prisma.faqCategory.create({
      data: {
        name,
        slug: finalSlug,
        description,
        order,
        isActive
      }
    });

    res.status(201).json({
      success: true,
      data: category
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/admin/faq-categories:
 *   get:
 *     summary: Get all FAQ categories
 *     tags: [Admin - FAQ Categories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: FAQ categories retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
export const getAllFaqCategories = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
    const isActive = req.query.isActive ? req.query.isActive === 'true' : undefined;
    const search = req.query.search as string;

    const skip = (page - 1) * limit;

    const where: any = {};
    if (isActive !== undefined) {
      where.isActive = isActive;
    }
    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    const [categories, total] = await Promise.all([
      prisma.faqCategory.findMany({
        where,
        orderBy: {
          order: 'asc'
        },
        skip,
        take: limit,
        include: {
          _count: {
            select: {
              faqs: {
                where: { isActive: true }
              }
            }
          }
        }
      }),
      prisma.faqCategory.count({ where })
    ]);

    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      success: true,
      data: categories,
      pagination: {
        // Wait, standard PaginatedResponse might use `page` and `totalPages` etc
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
        // let's put aliases just in case
        currentPage: page,
        totalItems: total,
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all active FAQ categories (public endpoint)
 */
export const getPublicFaqCategories = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const categories = await prisma.faqCategory.findMany({
      where: {
        isActive: true
      },
      orderBy: {
        order: 'asc'
      },
      include: {
        _count: {
          select: {
            faqs: {
              where: { isActive: true }
            }
          }
        }
      }
    });

    res.status(200).json({
      success: true,
      data: categories
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/admin/faq-categories/{categoryId}:
 *   get:
 *     summary: Get a specific FAQ category
 *     tags: [Admin - FAQ Categories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: FAQ category retrieved successfully
 *       404:
 *         description: FAQ category not found
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
export const getFaqCategoryById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { error } = categoryIdSchema.validate(req.params);
    if (error) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message
        }
      });
      return;
    }

    const { categoryId } = req.params;

    const category = await prisma.faqCategory.findUnique({
      where: { id: categoryId },
      include: {
        faqs: {
          where: { isActive: true },
          orderBy: {
            order: 'asc'
          }
        }
      }
    });

    if (!category) {
      res.status(404).json({
        success: false,
        error: {
          code: 'FAQ_CATEGORY_NOT_FOUND',
          message: 'FAQ category not found'
        }
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: category
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/admin/faq-categories/{categoryId}:
 *   put:
 *     summary: Update a FAQ category
 *     tags: [Admin - FAQ Categories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 100
 *               slug:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 100
 *               description:
 *                 type: string
 *                 maxLength: 500
 *               order:
 *                 type: integer
 *                 minimum: 0
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: FAQ category updated successfully
 *       404:
 *         description: FAQ category not found
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
export const updateFaqCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { error: paramsError } = categoryIdSchema.validate(req.params);
    const { error: bodyError, value } = updateFaqCategorySchema.validate(req.body);

    if (paramsError || bodyError) {
      const error = paramsError || bodyError;
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error?.details?.[0]?.message || 'Validation failed'
        }
      });
      return;
    }

    const { categoryId } = req.params;
    const { name, slug, description, order, isActive } = value;

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (slug !== undefined) updateData.slug = slug;
    if (description !== undefined) updateData.description = description;
    if (order !== undefined) updateData.order = order;
    if (isActive !== undefined) updateData.isActive = isActive;

    const category = await prisma.faqCategory.update({
      where: { id: categoryId },
      data: updateData
    });

    res.status(200).json({
      success: true,
      data: category
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/admin/faq-categories/{categoryId}:
 *   delete:
 *     summary: Delete a FAQ category
 *     tags: [Admin - FAQ Categories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: FAQ category deleted successfully
 *       404:
 *         description: FAQ category not found
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
export const deleteFaqCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { error } = categoryIdSchema.validate(req.params);
    if (error) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message
        }
      });
      return;
    }

    const { categoryId } = req.params;

    // Check if category has FAQs
    const faqCount = await prisma.faq.count({
      where: { categoryId }
    });

    if (faqCount > 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'CATEGORY_HAS_FAQS',
          message: 'Cannot delete category with existing FAQs'
        }
      });
      return;
    }

    await prisma.faqCategory.delete({
      where: { id: categoryId }
    });

    res.status(200).json({
      success: true,
      message: 'FAQ category deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};
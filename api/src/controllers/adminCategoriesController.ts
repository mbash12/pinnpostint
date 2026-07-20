import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/database';
import Joi from 'joi';
import {
  transformCategory,
  transformSubcategory,
  transformAttribute
} from '../types/standardized-models';

// Helper function to generate slug from name
const generateSlug = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
};

// Validation schemas
const createCategorySchema = Joi.object({
  name: Joi.string().required().min(1).max(255),
  slug: Joi.string().max(255).pattern(/^[a-z0-9-]+$/),
  description: Joi.string().max(1000),
  image: Joi.string().uri().allow('').optional(),
  adPlaceholder: Joi.string().uri().allow('').optional(),
  isActive: Joi.boolean().default(true),
  isFeatured: Joi.boolean().default(false),
  order: Joi.number().integer().min(0).default(0)
});

const updateCategorySchema = Joi.object({
  name: Joi.string().min(1).max(255),
  slug: Joi.string().max(255).pattern(/^[a-z0-9-]+$/),
  description: Joi.string().max(1000).allow(null),
  image: Joi.string().uri().allow('').allow(null).optional(),
  adPlaceholder: Joi.string().uri().allow('').allow(null).optional(),
  isActive: Joi.boolean(),
  isFeatured: Joi.boolean(),
  order: Joi.number().integer().min(0)
}).min(1);

const createSubcategorySchema = Joi.object({
  name: Joi.string().required().min(1).max(255),
  slug: Joi.string().max(255).pattern(/^[a-z0-9-]+$/),
  description: Joi.string().max(1000),
  image: Joi.string().uri().allow('').optional(),
  supportsBooking: Joi.boolean().default(false),
  isActive: Joi.boolean().default(true),
  order: Joi.number().integer().min(0).default(0)
});

const updateSubcategorySchema = Joi.object({
  name: Joi.string().min(1).max(255),
  slug: Joi.string().max(255).pattern(/^[a-z0-9-]+$/),
  description: Joi.string().max(1000).allow(null),
  image: Joi.string().uri().allow('').allow(null).optional(),
  supportsBooking: Joi.boolean(),
  isActive: Joi.boolean(),
  order: Joi.number().integer().min(0)
}).min(1);

const createAttributeSchema = Joi.object({
  name: Joi.string().required().min(1).max(255),
  type: Joi.string().required().valid('text', 'number', 'boolean', 'select', 'textarea', 'date'),
  options: Joi.when('type', {
    is: 'select',
    then: Joi.array().items(Joi.string()).min(1).required(),
    otherwise: Joi.array().items(Joi.string()).optional()
  }),
  image: Joi.string().uri().allow('').optional(),
  isRequired: Joi.boolean().default(false),
  order: Joi.number().integer().min(0).default(0)
});

const updateAttributeSchema = Joi.object({
  name: Joi.string().min(1).max(255),
  type: Joi.string().valid('text', 'number', 'boolean', 'select', 'textarea', 'date').allow(null),
  options: Joi.when('type', {
    is: 'select',
    then: Joi.array().items(Joi.string()).min(1),
    otherwise: Joi.array().items(Joi.string()).optional()
  }).allow(null),
  image: Joi.string().uri().allow('').allow(null).optional(),
  isRequired: Joi.boolean(),
  order: Joi.number().integer().min(0)
}).min(1);

/**
 * @swagger
 * components:
 *   schemas:
 *     Category:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         name:
 *           type: string
 *         slug:
 *           type: string
 *         description:
 *           type: string
 *         image:
 *           type: string
 *           format: uri
 *         isActive:
 *           type: boolean
 *         isFeatured:
 *           type: boolean
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *         subcategories:
 *           items:
 *             $ref: '#/components/schemas/Subcategory'
 *       required:
 *         - name
 *     Subcategory:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         name:
 *           type: string
 *         slug:
 *           type: string
 *         description:
 *           type: string
 *         image:
 *           type: string
 *           format: uri
 *         categoryId:
 *           type: string
 *           format: uuid
 *         isActive:
 *           type: boolean
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *         attributes:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Attribute'
 *       required:
 *         - categoryId
 *     Attribute:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         name:
 *           type: string
 *         type:
 *           type: string
 *           enum:
 *             - text
 *             - number
 *             - boolean
 *             - select
 *             - textarea
 *             - date
 *         options:
 *           type: array
 *           items:
 *             type: string
 *         image:
 *           type: string
 *           format: uri
 *         subcategoryId:
 *           type: string
 *           format: uuid
 *         isRequired:
 *           type: boolean
 *         order:
 *           type: integer
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *       required:
 *         - name
 *         - type
 *         - subcategoryId
 */

/**
 * @swagger
 * /api/v1/admin/categories:
 *   post:
 *     summary: Create a new category
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Electronics"
 *               slug:
 *                 type: string
 *                 example: "electronics"
 *               description:
 *                 type: string
 *                 example: "Electronic devices and gadgets"
 *               isActive:
 *                 type: boolean
 *                 example: true
 *               isFeatured:
 *                 type: boolean
 *                 example: false
 *             required:
 *               - name
 *     responses:
 *       201:
 *         description: Category created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
export const createCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { error, value } = createCategorySchema.validate(req.body);

    if (error) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
          }))
        }
      });
      return;
    }

    // Convert empty strings to null for optional fields
    if (value.image === '') {
      value.image = null;
    }

    // Generate slug if not provided
    if (!value.slug) {
      value.slug = generateSlug(value.name);
    }

    // Check if slug already exists
    const existingCategory = await prisma.category.findUnique({
      where: { slug: value.slug }
    });

    if (existingCategory) {
      res.status(400).json({
        success: false,
        error: {
          code: 'DUPLICATE_SLUG',
          message: 'Category with this slug already exists'
        }
      });
      return;
    }

    const category = await prisma.category.create({
      data: value
    });

    res.status(201).json({
      success: true,
      data: transformCategory(category),
      message: 'Category created successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/admin/categories:
 *   get:
 *     summary: Get all categories with subcategories and attributes
 *     tags: [Admin]
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
 *         description: Number of items per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by category name
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *       - in: query
 *         name: isFeatured
 *         schema:
 *           type: boolean
 *         description: Filter by featured status
 *     responses:
 *       200:
 *         description: Categories retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
export const getAllCategories = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
    const search = req.query.search as string;
    const isActive = req.query.isActive as string;
    const isFeatured = req.query.isFeatured as string;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.name = {
        contains: search,
        mode: 'insensitive' as const
      };
    }

    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    if (isFeatured !== undefined) {
      where.isFeatured = isFeatured === 'true';
    }

    const [categories, total] = await Promise.all([
      prisma.category.findMany({
        where,
        skip,
        take: limit,
        orderBy: { order: 'asc' },
        include: {
          subcategories: {
            orderBy: { order: 'asc' },
            include: {
              attributes: {
                orderBy: { order: 'asc' }
              }
            }
          },
          _count: {
            select: {
              ads: true
            }
          }
        }
      }),
      prisma.category.count({ where })
    ]);

    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      success: true,
      data: categories.map(transformCategory),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/admin/categories/for-ad-creation:
 *   get:
 *     summary: Get active categories for ad creation (admin)
 *     description: Returns only active categories with their subcategories for use in ad creation forms
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Active categories retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Category'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
export const getCategoriesForAdCreation = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const categories = await prisma.category.findMany({
      where: {
        isActive: true
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        image: true,
        isActive: true,
        isFeatured: true,
        supportsBooking: true,
        order: true,
        createdAt: true,
        updatedAt: true,
        subcategories: {
          where: {
            isActive: true
          },
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            image: true,
            categoryId: true,
            supportsBooking: true,
            isActive: true,
            order: true,
            createdAt: true,
            updatedAt: true
          },
          orderBy: {
            order: 'asc'
          }
        }
      },
      orderBy: {
        order: 'asc'
      }
    });

    res.status(200).json({
      success: true,
      data: categories.map(transformCategory)
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/admin/categories/{categoryId}:
 *   get:
 *     summary: Get a specific category with full details
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Category ID
 *     responses:
 *       200:
 *         description: Category retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
export const getCategoryById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { categoryId } = req.params;

    const category = await prisma.category.findUnique({
      where: { id: categoryId },
      include: {
        subcategories: {
          orderBy: { order: 'asc' },
          include: {
            attributes: {
              orderBy: { order: 'asc' }
            }
          }
        },
        _count: {
          select: {
            ads: true
          }
        }
      }
    });

    if (!category) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Category not found'
        }
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: transformCategory(category)
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/admin/categories/{categoryId}:
 *   put:
 *     summary: Update a category
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Category ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Updated Electronics"
 *               slug:
 *                 type: string
 *                 example: "updated-electronics"
 *               description:
 *                 type: string
 *                 example: "Updated description"
 *               isActive:
 *                 type: boolean
 *                 example: false
 *               isFeatured:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: Category updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
export const updateCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { categoryId } = req.params;
    const { error, value } = updateCategorySchema.validate(req.body);

    if (error) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
          }))
        }
      });
      return;
    }

    // Convert empty strings to null for optional fields
    if (value.image === '') {
      value.image = null;
    }

    // Check if category exists
    const existingCategory = await prisma.category.findUnique({
      where: { id: categoryId }
    });

    if (!existingCategory) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Category not found'
        }
      });
      return;
    }

    // If slug is being updated, check for duplicates
    if (value.slug && value.slug !== existingCategory.slug) {
      const duplicateCategory = await prisma.category.findUnique({
        where: { slug: value.slug }
      });

      if (duplicateCategory) {
        res.status(400).json({
          success: false,
          error: {
            code: 'DUPLICATE_SLUG',
            message: 'Category with this slug already exists'
          }
        });
        return;
      }
    }

    const updatedCategory = await prisma.category.update({
      where: { id: categoryId },
      data: value
    });

    res.status(200).json({
      success: true,
      data: transformCategory(updatedCategory),
      message: 'Category updated successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/admin/categories/{categoryId}:
 *   delete:
 *     summary: Delete a category
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Category ID
 *     responses:
 *       200:
 *         description: Category deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Category cannot be deleted (has associated data)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
export const deleteCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { categoryId } = req.params;

    const category = await prisma.category.findUnique({
      where: { id: categoryId },
      include: {
        _count: {
          select: {
            ads: true,
            subcategories: true
          }
        }
      }
    });

    if (!category) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Category not found'
        }
      });
      return;
    }

    // Check if category has associated ads
    if (category._count.ads > 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'CATEGORY_IN_USE',
          message: 'Cannot delete category that has associated ads'
        }
      });
      return;
    }

    // Delete associated subcategories (which will cascade delete attributes) first
    await prisma.$transaction([
      // First delete all attributes from subcategories of this category
      prisma.attribute.deleteMany({
        where: {
          subcategory: {
            categoryId: categoryId
          }
        }
      }),
      // Then delete subcategories
      prisma.subcategory.deleteMany({
        where: { categoryId }
      }),
      // Finally delete the category
      prisma.category.delete({
        where: { id: categoryId }
      })
    ]);

    res.status(200).json({
      success: true,
      message: 'Category deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/admin/categories/{categoryId}/subcategories:
 *   post:
 *     summary: Create a new subcategory
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Category ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Smartphones"
 *               slug:
 *                 type: string
 *                 example: "smartphones"
 *               description:
 *                 type: string
 *                 example: "Mobile phones and smartphones"
 *               isActive:
 *                 type: boolean
 *                 example: true
 *             required:
 *               - name
 *     responses:
 *       201:
 *         description: Subcategory created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
export const createSubcategory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { categoryId } = req.params;
    const { error, value } = createSubcategorySchema.validate(req.body);

    if (error) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
          }))
        }
      });
      return;
    }

    // Convert empty strings to null for optional fields
    if (value.image === '') {
      value.image = null;
    }

    // Check if category exists
    const category = await prisma.category.findUnique({
      where: { id: categoryId }
    });

    if (!category) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Category not found'
        }
      });
      return;
    }

    // Generate slug if not provided
    if (!value.slug) {
      value.slug = generateSlug(value.name);
    }

    // Check if slug already exists
    const existingSubcategory = await prisma.subcategory.findUnique({
      where: { slug: value.slug }
    });

    if (existingSubcategory) {
      res.status(400).json({
        success: false,
        error: {
          code: 'DUPLICATE_SLUG',
          message: 'Subcategory with this slug already exists'
        }
      });
      return;
    }

    const subcategory = await prisma.subcategory.create({
      data: {
        ...value,
        categoryId
      }
    });

    res.status(201).json({
      success: true,
      data: transformSubcategory(subcategory),
      message: 'Subcategory created successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/admin/categories/{categoryId}/subcategories:
 *   get:
 *     summary: Get subcategories for a category
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Category ID
 *     responses:
 *       200:
 *         description: Subcategories retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
export const getSubcategoriesByCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { categoryId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
    const search = req.query.search as string;
    const isActive = req.query.isActive as string;
    const skip = (page - 1) * limit;

    // Check if category exists
    const category = await prisma.category.findUnique({
      where: { id: categoryId }
    });

    if (!category) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Category not found'
        }
      });
      return;
    }

    const where: any = { categoryId };

    if (search) {
      where.name = {
        contains: search,
        mode: 'insensitive' as const
      };
    }

    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    const [subcategories, total] = await Promise.all([
      prisma.subcategory.findMany({
        where,
        orderBy: { order: 'asc' },
        skip,
        take: limit,
        include: {
          _count: {
            select: {
              ads: true
            }
          }
        }
      }),
      prisma.subcategory.count({ where })
    ]);

    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      success: true,
      data: subcategories.map(transformSubcategory),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getSubcategoryById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { subcategoryId } = req.params;

    const subcategory = await prisma.subcategory.findUnique({
      where: { id: subcategoryId },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        },
        attributes: {
          orderBy: { order: 'asc' }
        },
        _count: {
          select: {
            ads: true
          }
        }
      }
    });

    if (!subcategory) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Subcategory not found'
        }
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: transformSubcategory(subcategory)
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/admin/subcategories/{subcategoryId}:
 *   put:
 *     summary: Update a subcategory
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: subcategoryId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Subcategory ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Updated Smartphones"
 *               slug:
 *                 type: string
 *                 example: "updated-smartphones"
 *               description:
 *                 type: string
 *                 example: "Updated description"
 *               isActive:
 *                 type: boolean
 *                 example: false
 *     responses:
 *       200:
 *         description: Subcategory updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
export const updateSubcategory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { subcategoryId } = req.params;
    const { error, value } = updateSubcategorySchema.validate(req.body);

    if (error) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
          }))
        }
      });
      return;
    }

    // Convert empty strings to null for optional fields
    if (value.image === '') {
      value.image = null;
    }

    // Check if subcategory exists
    const existingSubcategory = await prisma.subcategory.findUnique({
      where: { id: subcategoryId }
    });

    if (!existingSubcategory) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Subcategory not found'
        }
      });
      return;
    }

    // If slug is being updated, check for duplicates
    if (value.slug && value.slug !== existingSubcategory.slug) {
      const duplicateSubcategory = await prisma.subcategory.findUnique({
        where: { slug: value.slug }
      });

      if (duplicateSubcategory) {
        res.status(400).json({
          success: false,
          error: {
            code: 'DUPLICATE_SLUG',
            message: 'Subcategory with this slug already exists'
          }
        });
        return;
      }
    }

    const updatedSubcategory = await prisma.subcategory.update({
      where: { id: subcategoryId },
      data: value
    });

    res.status(200).json({
      success: true,
      data: transformSubcategory(updatedSubcategory),
      message: 'Subcategory updated successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/admin/subcategories/{subcategoryId}:
 *   delete:
 *     summary: Delete a subcategory
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: subcategoryId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Subcategory ID
 *     responses:
 *       200:
 *         description: Subcategory deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Subcategory cannot be deleted (has associated data)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
export const deleteSubcategory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { subcategoryId } = req.params;

    const subcategory = await prisma.subcategory.findUnique({
      where: { id: subcategoryId },
      include: {
        _count: {
          select: {
            ads: true
          }
        }
      }
    });

    if (!subcategory) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Subcategory not found'
        }
      });
      return;
    }

    // Check if subcategory has associated ads
    if (subcategory._count.ads > 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'SUBCATEGORY_IN_USE',
          message: 'Cannot delete subcategory that has associated ads'
        }
      });
      return;
    }

    await prisma.subcategory.delete({
      where: { id: subcategoryId }
    });

    res.status(200).json({
      success: true,
      message: 'Subcategory deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/admin/subcategories/{subcategoryId}/attributes:
 *   post:
 *     summary: Add an attribute to a subcategory
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: subcategoryId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Subcategory ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Brand"
 *               type:
 *                 type: string
 *                 enum: [text, number, boolean, select, textarea, date]
 *                 example: "select"
 *               options:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["Apple", "Samsung", "Google"]
 *               isRequired:
 *                 type: boolean
 *                 example: true
 *               order:
 *                 type: integer
 *                 example: 1
 *             required:
 *               - name
 *               - type
 *     responses:
 *       201:
 *         description: Attribute created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
export const createAttribute = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { subcategoryId } = req.params;
    const { error, value } = createAttributeSchema.validate(req.body);

    if (error) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
          }))
        }
      });
      return;
    }

    // Convert empty strings to null for optional fields
    if (value.image === '') {
      value.image = null;
    }

    // Check if subcategory exists
    const subcategory = await prisma.subcategory.findUnique({
      where: { id: subcategoryId }
    });

    if (!subcategory) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Subcategory not found'
        }
      });
      return;
    }

    const attribute = await prisma.attribute.create({
      data: {
        ...value,
        subcategoryId
      }
    });

    res.status(201).json({
      success: true,
      data: transformAttribute(attribute),
      message: 'Attribute created successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/admin/subcategories/{subcategoryId}/attributes:
 *   get:
 *     summary: Get attributes for a subcategory
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: subcategoryId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Subcategory ID
 *     responses:
 *       200:
 *         description: Attributes retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
export const getAttributesBySubcategory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { subcategoryId } = req.params;

    // Check if subcategory exists
    const subcategory = await prisma.subcategory.findUnique({
      where: { id: subcategoryId }
    });

    if (!subcategory) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Subcategory not found'
        }
      });
      return;
    }

    const attributes = await prisma.attribute.findMany({
      where: { subcategoryId },
      orderBy: { order: 'asc' }
    });

    res.status(200).json({
      success: true,
      data: attributes.map(transformAttribute)
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/admin/attributes/{attributeId}:
 *   get:
 *     summary: Get a specific attribute with full details
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: attributeId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Attribute ID
 *     responses:
 *       200:
 *         description: Attribute retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
export const getAttributeById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { attributeId } = req.params;

    const attribute = await prisma.attribute.findUnique({
      where: { id: attributeId },
      include: {
        subcategory: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        }
      }
    });

    if (!attribute) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Attribute not found'
        }
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: transformAttribute(attribute)
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/admin/attributes/{attributeId}:
 *   put:
 *     summary: Update an attribute
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: attributeId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Attribute ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Updated Brand"
 *               type:
 *                 type: string
 *                 enum: [text, number, boolean, select, textarea, date]
 *                 example: "text"
 *               options:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["Apple", "Samsung", "Google", "OnePlus"]
 *               isRequired:
 *                 type: boolean
 *                 example: false
 *               order:
 *                 type: integer
 *                 example: 2
 *     responses:
 *       200:
 *         description: Attribute updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
export const updateAttribute = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { attributeId } = req.params;
    const { error, value } = updateAttributeSchema.validate(req.body);

    if (error) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
          }))
        }
      });
      return;
    }

    // Convert empty strings to null for optional fields
    if (value.image === '') {
      value.image = null;
    }

    // Check if attribute exists
    const existingAttribute = await prisma.attribute.findUnique({
      where: { id: attributeId }
    });

    if (!existingAttribute) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Attribute not found'
        }
      });
      return;
    }

    const updatedAttribute = await prisma.attribute.update({
      where: { id: attributeId },
      data: value
    });

    res.status(200).json({
      success: true,
      data: transformAttribute(updatedAttribute),
      message: 'Attribute updated successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/admin/attributes/{attributeId}:
 *   delete:
 *     summary: Delete an attribute
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: attributeId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Attribute ID
 *     responses:
 *       200:
 *         description: Attribute deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Attribute cannot be deleted (has associated data)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
export const deleteAttribute = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { attributeId } = req.params;

    const attribute = await prisma.attribute.findUnique({
      where: { id: attributeId },
      include: {
        _count: {
          select: {
            adValues: true
          }
        }
      }
    });

    if (!attribute) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Attribute not found'
        }
      });
      return;
    }

    // Check if attribute has associated ad values
    if (attribute._count.adValues > 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'ATTRIBUTE_IN_USE',
          message: 'Cannot delete attribute that has associated ad values'
        }
      });
      return;
    }

    await prisma.attribute.delete({
      where: { id: attributeId }
    });

    res.status(200).json({
      success: true,
      message: 'Attribute deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};
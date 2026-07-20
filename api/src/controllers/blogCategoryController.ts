import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/database';
import Joi from 'joi';

// Helper function to generate slug from name
const generateSlug = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
};

// Validation schemas
const createBlogCategorySchema = Joi.object({
  name: Joi.string().required().min(1).max(255),
  slug: Joi.string().max(255).pattern(/^[a-z0-9-]+$/),
  description: Joi.string().max(1000),
  isActive: Joi.boolean().default(true),
  order: Joi.number().integer().min(0).default(0)
});

const updateBlogCategorySchema = Joi.object({
  name: Joi.string().min(1).max(255),
  slug: Joi.string().max(255).pattern(/^[a-z0-9-]+$/),
  description: Joi.string().max(1000).allow(null),
  isActive: Joi.boolean(),
  order: Joi.number().integer().min(0)
}).min(1);

/**
 * @swagger
 * /api/v1/admin/blog-categories:
 *   post:
 *     summary: Create a blog category
 *     tags: [Admin Content Management]
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
 *                 example: "Platform Updates"
 *               slug:
 *                 type: string
 *                 example: "platform-updates"
 *               description:
 *                 type: string
 *                 example: "Blog about platform updates and features"
 *               isActive:
 *                 type: boolean
 *                 example: true
 *               order:
 *                 type: integer
 *                 example: 1
 *             required:
 *               - name
 *     responses:
 *       201:
 *         description: Blog category created successfully
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
 *                   example: "Blog category created successfully"
 *                 data:
 *                   $ref: '#/components/schemas/BlogCategory'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
export const createBlogCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { error, value } = createBlogCategorySchema.validate(req.body);

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

    // Generate slug if not provided
    if (!value.slug) {
      value.slug = generateSlug(value.name);
    }

    // Check if slug already exists
    const existingCategory = await prisma.blogCategory.findUnique({
      where: { slug: value.slug }
    });

    if (existingCategory) {
      res.status(400).json({
        success: false,
        error: {
          code: 'DUPLICATE_SLUG',
          message: 'Blog category with this slug already exists'
        }
      });
      return;
    }

    const category = await prisma.blogCategory.create({
      data: value,
      include: {
        _count: {
          select: {
            blogs: true
          }
        }
      }
    });

    res.status(201).json({
      success: true,
      data: category,
      message: 'Blog category created successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/admin/blog-categories:
 *   get:
 *     summary: Get all blog categories
 *     tags: [Admin Content Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by category name
 *     responses:
 *       200:
 *         description: Blog categories retrieved successfully
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
 *                     $ref: '#/components/schemas/BlogCategory'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
export const getAllBlogCategories = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const skip = (page - 1) * limit;
    const isActive = req.query.isActive ? req.query.isActive === 'true' : undefined;
    const search = req.query.search as string;

    const where: any = {};

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (search) {
      where.name = {
        contains: search,
        mode: 'insensitive' as const
      };
    }

    const [categories, total] = await Promise.all([
      prisma.blogCategory.findMany({
        where,
        skip,
        take: limit,
        orderBy: { order: 'asc' },
        include: {
          _count: {
            select: {
              blogs: true
            }
          }
        }
      }),
      prisma.blogCategory.count({ where })
    ]);

    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      success: true,
      data: categories,
      pagination: {
        page,
        limit,
        total,
        totalPages
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/admin/blog-categories/{categoryId}:
 *   get:
 *     summary: Get blog category by ID
 *     tags: [Admin Content Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Blog Category ID
 *     responses:
 *       200:
 *         description: Blog category retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/BlogCategory'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
export const getBlogCategoryById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { categoryId } = req.params;

    const category = await prisma.blogCategory.findUnique({
      where: { id: categoryId },
      include: {
        _count: {
          select: {
            blogs: true
          }
        }
      }
    });

    if (!category) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Blog category not found'
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
 * /api/v1/admin/blog-categories/{categoryId}:
 *   put:
 *     summary: Update blog category
 *     tags: [Admin Content Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Blog Category ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Updated Category Name"
 *               slug:
 *                 type: string
 *                 example: "updated-category-name"
 *               description:
 *                 type: string
 *                 example: "Updated description"
 *               isActive:
 *                 type: boolean
 *                 example: false
 *               order:
 *                 type: integer
 *                 example: 2
 *     responses:
 *       200:
 *         description: Blog category updated successfully
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
 *                   example: "Blog category updated successfully"
 *                 data:
 *                   $ref: '#/components/schemas/BlogCategory'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
export const updateBlogCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { categoryId } = req.params;
    const { error, value } = updateBlogCategorySchema.validate(req.body);

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

    // Check if category exists
    const existingCategory = await prisma.blogCategory.findUnique({
      where: { id: categoryId }
    });

    if (!existingCategory) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Blog category not found'
        }
      });
      return;
    }

    // If slug is being updated, check for duplicates
    if (value.slug && value.slug !== existingCategory.slug) {
      const duplicateCategory = await prisma.blogCategory.findUnique({
        where: { slug: value.slug }
      });

      if (duplicateCategory) {
        res.status(400).json({
          success: false,
          error: {
            code: 'DUPLICATE_SLUG',
            message: 'Blog category with this slug already exists'
          }
        });
        return;
      }
    }

    const updatedCategory = await prisma.blogCategory.update({
      where: { id: categoryId },
      data: value,
      include: {
        _count: {
          select: {
            blogs: true
          }
        }
      }
    });

    res.status(200).json({
      success: true,
      data: updatedCategory,
      message: 'Blog category updated successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/admin/blog-categories/{categoryId}:
 *   delete:
 *     summary: Delete blog category
 *     tags: [Admin Content Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Blog Category ID
 *     responses:
 *       200:
 *         description: Blog category deleted successfully
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
 *                   example: "Blog category deleted successfully"
 *       400:
 *         description: Blog category cannot be deleted (has associated blog articles)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
export const deleteBlogCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { categoryId } = req.params;

    const category = await prisma.blogCategory.findUnique({
      where: { id: categoryId },
      include: {
        _count: {
          select: {
            blogs: true
          }
        }
      }
    });

    if (!category) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Blog category not found'
        }
      });
      return;
    }

    // Check if category has associated blog articles
    if (category._count.blogs > 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'CATEGORY_IN_USE',
          message: 'Cannot delete blog category that has associated blog articles'
        }
      });
      return;
    }

    await prisma.blogCategory.delete({
      where: { id: categoryId }
    });

    res.status(200).json({
      success: true,
      message: 'Blog category deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/public/blog-categories:
 *   get:
 *     summary: Get all active blog categories
 *     tags: [Public - Blog]
 *     responses:
 *       200:
 *         description: Blog categories retrieved successfully
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
 *                       name:
 *                         type: string
 *                       slug:
 *                         type: string
 *                       description:
 *                         type: string
 */
export const getPublicBlogCategories = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const categories = await prisma.blogCategory.findMany({
      where: {
        isActive: true
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        order: true
      },
      orderBy: { order: 'asc' }
    });

    res.status(200).json({
      success: true,
      data: categories
    });
  } catch (error) {
    next(error);
  }
};
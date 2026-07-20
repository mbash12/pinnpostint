import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/database';
import Joi from 'joi';

// Utility function to generate slug from title
const generateSlug = (title: string): string => {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
};

// Validation schemas
const createBlogSchema = Joi.object({
  title: Joi.string().min(1).max(200).required(),
  slug: Joi.string().min(1).max(200).optional(),
  content: Joi.string().min(1).required(),
  excerpt: Joi.string().optional(),
  imageUrl: Joi.string().uri().optional(),
  isActive: Joi.boolean().optional().default(true),
  isFeatured: Joi.boolean().optional().default(false),
  categoryId: Joi.string().uuid().optional()
});

const updateBlogSchema = Joi.object({
  title: Joi.string().min(1).max(200).optional(),
  slug: Joi.string().min(1).max(200).optional(),
  content: Joi.string().min(1).optional(),
  excerpt: Joi.string().optional(),
  imageUrl: Joi.string().uri().optional(),
  isActive: Joi.boolean().optional(),
  isFeatured: Joi.boolean().optional(),
  categoryId: Joi.string().uuid().optional()
});

const blogIdSchema = Joi.object({
  blogId: Joi.string().uuid().required()
});

/**
 * @swagger
 * /api/v1/admin/blogs:
 *   post:
 *     summary: Create a blog article
 *     tags: [Admin - Blog]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - content
 *             properties:
 *               title:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 200
 *               content:
 *                 type: string
 *                 minLength: 1
 *               imageUrl:
 *                 type: string
 *                 format: uri
 *               isActive:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       201:
 *         description: Blog article created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Blog'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
export const createBlog = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { error, value } = createBlogSchema.validate(req.body);
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

    const { title, slug, content, excerpt, imageUrl, isActive } = value;
    const authorId = (req as any).user.id;

    // Generate slug if not provided
    const finalSlug = slug || generateSlug(title);

    const blog = await prisma.blog.create({
      data: {
        title,
        slug: finalSlug,
        content,
        excerpt,
        imageUrl,
        isActive,
        categoryId: value.categoryId,
        authorId,
        publishedAt: new Date()
      },
      select: {
        id: true,
        title: true,
        slug: true,
        content: true,
        excerpt: true,
        imageUrl: true,
        isActive: true,
        isFeatured: true,
        publishedAt: true,
        createdAt: true,
        updatedAt: true,
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        category: true
      }
    });

    res.status(201).json({
      success: true,
      data: blog
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/admin/blogs:
 *   get:
 *     summary: Get all blog articles
 *     tags: [Admin - Blog]
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
 *           default: 10
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Blog articles retrieved successfully
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
 *                     $ref: '#/components/schemas/Blog'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     pages:
 *                       type: integer
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
export const getAllBlog = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
    const skip = (page - 1) * limit;
    const isActive = req.query.isActive ? req.query.isActive === 'true' : undefined;
    const search = req.query.search as string;

    const where: any = {};

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [blogs, total] = await Promise.all([
      prisma.blog.findMany({
        where,
        select: {
          id: true,
          title: true,
          slug: true,
          content: true,
          excerpt: true,
          imageUrl: true,
          isActive: true,
          isFeatured: true,
          publishedAt: true,
          createdAt: true,
          updatedAt: true,
          authorId: true,
          categoryId: true,
          author: {
            select: {
              id: true,
              firstName: true,
              lastName: true
            }
          },
          category: true
        },
        orderBy: {
          publishedAt: 'desc'
        },
        skip,
        take: limit
      }),
      prisma.blog.count({ where })
    ]);

    const pages = Math.ceil(total / limit);

    res.status(200).json({
      success: true,
      data: blogs,
      pagination: {
        page,
        limit,
        total,
        pages
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/admin/blogs/{blogId}:
 *   get:
 *     summary: Get a specific blog article
 *     tags: [Admin - Blog]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: blogId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Blog article retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Blog'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
export const getBlogById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { error } = blogIdSchema.validate(req.params);
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

    const { blogId } = req.params;

    const blog = await prisma.blog.findUnique({
      where: { id: blogId },
      select: {
        id: true,
        title: true,
        slug: true,
        content: true,
        excerpt: true,
        imageUrl: true,
        isActive: true,
        isFeatured: true,
        publishedAt: true,
        createdAt: true,
        updatedAt: true,
        authorId: true,
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        category: true
      }
    });

    if (!blog) {
      res.status(404).json({
        success: false,
        error: {
          code: 'BLOG_NOT_FOUND',
          message: 'Blog article not found'
        }
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: blog
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/admin/blogs/{blogId}:
 *   put:
 *     summary: Update a blog article
 *     tags: [Admin - Blog]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: blogId
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
 *               title:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 200
 *               content:
 *                 type: string
 *                 minLength: 1
 *               imageUrl:
 *                 type: string
 *                 format: uri
 *               isActive:
 *                 type: boolean
 *               isFeatured:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Blog article updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Blog'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
export const updateBlog = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { error: paramsError } = blogIdSchema.validate(req.params);
    if (paramsError) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: paramsError.details[0].message
        }
      });
      return;
    }

    const { error: bodyError, value } = updateBlogSchema.validate(req.body);
    if (bodyError) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: bodyError.details[0].message
        }
      });
      return;
    }

    const { blogId } = req.params;

    // Check if blog exists
    const existingBlog = await prisma.blog.findUnique({
      where: { id: blogId }
    });

    if (!existingBlog) {
      res.status(404).json({
        success: false,
        error: {
          code: 'BLOG_NOT_FOUND',
          message: 'Blog article not found'
        }
      });
      return;
    }

    const updatedBlog = await prisma.blog.update({
      where: { id: blogId },
      data: value,
      select: {
        id: true,
        title: true,
        slug: true,
        content: true,
        excerpt: true,
        imageUrl: true,
        isActive: true,
        isFeatured: true,
        publishedAt: true,
        createdAt: true,
        updatedAt: true,
        authorId: true,
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        category: true
      }
    });

    res.status(200).json({
      success: true,
      data: updatedBlog
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/admin/blogs/{blogId}:
 *   delete:
 *     summary: Delete a blog article
 *     tags: [Admin - Blog]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: blogId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       204:
 *         description: Blog article deleted successfully
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
export const deleteBlog = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { error } = blogIdSchema.validate(req.params);
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

    const { blogId } = req.params;

    // Check if blog exists
    const existingBlog = await prisma.blog.findUnique({
      where: { id: blogId }
    });

    if (!existingBlog) {
      res.status(404).json({
        success: false,
        error: {
          code: 'BLOG_NOT_FOUND',
          message: 'Blog article not found'
        }
      });
      return;
    }

    await prisma.blog.delete({
      where: { id: blogId }
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

// Public endpoints

/**
 * @swagger
 * /api/v1/public/blogs:
 *   get:
 *     summary: Get published blog articles
 *     tags: [Public - Blog]
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
 *           maximum: 50
 *           default: 10
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Published blog articles retrieved successfully
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
 *                     $ref: '#/components/schemas/Blog'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     pages:
 *                       type: integer
 */
export const getPublicBlog = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    const skip = (page - 1) * limit;
    const search = req.query.search as string;
    const categoryId = req.query.categoryId as string;

    const where: any = {
      isActive: true
    };

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
        { category: { name: { contains: search, mode: 'insensitive' } } }
      ];
    }

    const [blogs, total] = await Promise.all([
      prisma.blog.findMany({
        where,
        select: {
          id: true,
          title: true,
          slug: true,
          content: true,
          excerpt: true,
          imageUrl: true,
          isFeatured: true,
          publishedAt: true,
          author: {
            select: {
              firstName: true,
              lastName: true
            }
          },
          category: true
        },
        orderBy: {
          publishedAt: 'desc'
        },
        skip,
        take: limit
      }),
      prisma.blog.count({ where })
    ]);

    const pages = Math.ceil(total / limit);

    res.status(200).json({
      success: true,
      data: blogs,
      pagination: {
        page,
        limit,
        total,
        pages
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/public/blogs/{idOrSlug}:
 *   get:
 *     summary: Get blog article details by ID or Slug
 *     tags: [Public - Blog]
 *     parameters:
 *       - in: path
 *         name: idOrSlug
 *         required: true
 *         schema:
 *           type: string
 *           description: UUID or Slug of the blog article
 *     responses:
 *       200:
 *         description: Blog article retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Blog'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
export const getPublicBlogByIdOrSlug = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { idOrSlug } = req.params;

    if (!idOrSlug) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'ID or Slug is required'
        }
      });
      return;
    }

    // Check if it's a valid UUID
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);

    const where: any = {
      isActive: true
    };

    if (isUuid) {
      where.id = idOrSlug;
    } else {
      where.slug = idOrSlug;
    }

    const blog = await prisma.blog.findFirst({
      where,
      select: {
        id: true,
        title: true,
        slug: true,
        content: true,
        excerpt: true,
        imageUrl: true,
        isFeatured: true,
        publishedAt: true,
        author: {
          select: {
            firstName: true,
            lastName: true
          }
        },
        category: true
      }
    });

    if (!blog) {
      res.status(404).json({
        success: false,
        error: {
          code: 'BLOG_NOT_FOUND',
          message: 'Blog article not found'
        }
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: blog
    });
  } catch (error) {
    next(error);
  }
};
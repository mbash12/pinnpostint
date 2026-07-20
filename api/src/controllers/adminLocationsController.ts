import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/database';
import Joi from 'joi';
import {
  transformLocation
} from '../types/standardized-models';

// Validation schemas
const createLocationSchema = Joi.object({
  name: Joi.string().required().min(1).max(255),
  address: Joi.string().max(500).allow(null),
  latitude: Joi.number().required().min(-90).max(90),
  longitude: Joi.number().required().min(-180).max(180),
  cityId: Joi.string().uuid().allow(null),
  stateId: Joi.string().uuid().allow(null),
  postalCodeId: Joi.string().uuid().allow(null),
  country: Joi.string().max(100).default('India').allow(null),
  isActive: Joi.boolean().default(true)
});

const updateLocationSchema = Joi.object({
  name: Joi.string().min(1).max(255),
  address: Joi.string().max(500).allow(null),
  latitude: Joi.number().min(-90).max(90).allow(null),
  longitude: Joi.number().min(-180).max(180).allow(null),
  cityId: Joi.string().uuid().allow(null),
  stateId: Joi.string().uuid().allow(null),
  postalCodeId: Joi.string().uuid().allow(null),
  country: Joi.string().max(100).allow(null),
  isActive: Joi.boolean()
}).min(1);

/**
 * @swagger
 * components:
 *   schemas:
 *     Location:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         name:
 *           type: string
 *         address:
 *           type: string
 *         latitude:
 *           type: number
 *           format: float
 *         longitude:
 *           type: number
 *           format: float
 *         cityId:
 *           type: string
 *           format: uuid
 *         stateId:
 *           type: string
 *           format: uuid
 *         districtId:
 *           type: string
 *           format: uuid
 *         postalCodeId:
 *           type: string
 *           format: uuid
 *         country:
 *           type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *       required:
 *         - name
 *         - latitude
 *         - longitude
 */

/**
 * @swagger
 * /api/v1/admin/locations:
 *   post:
 *     summary: Create a new core location
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
 *                 example: "New York City"
 *               address:
 *                 type: string
 *                 example: "Manhattan, NY, USA"
 *               latitude:
 *                 type: number
 *                 format: float
 *                 example: 40.7128
 *               longitude:
 *                 type: number
 *                 format: float
 *                 example: -74.0060
 *               city:
 *                 type: string
 *                 example: "New York"
 *               state:
 *                 type: string
 *                 example: "New York"
 *               country:
 *                 type: string
 *                 example: "USA"
 *               postalCode:
 *                 type: string
 *                 example: "10001"
 *             required:
 *               - name
 *               - latitude
 *               - longitude
 *     responses:
 *       201:
 *         description: Location created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
export const createLocation = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { error, value } = createLocationSchema.validate(req.body);

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

    const location = await prisma.location.create({
      data: value,
      include: {
        state: true,
        city: true,
        postalCode: true
      }
    });

    res.status(201).json({
      success: true,
      data: transformLocation(location),
      message: 'Location created successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/admin/locations:
 *   get:
 *     summary: Get all locations
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
 *         description: Search by location name or city
 *       - in: query
 *         name: country
 *         schema:
 *           type: string
 *         description: Filter by country
 *       - in: query
 *         name: state
 *         schema:
 *           type: string
 *         description: Filter by state
 *     responses:
 *       200:
 *         description: Locations retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
export const getAllLocations = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
    const search = req.query.search as string;
    const country = req.query.country as string;
    const state = req.query.state as string;
    const stateId = req.query.stateId as string;
    const districtId = req.query.districtId as string;
    const cityId = req.query.cityId as string;
    const postalCodeId = req.query.postalCodeId as string;
    const isActive = req.query.isActive as string | undefined;
    const skip = (page - 1) * limit;

    const where: any = {};

    // Filter by isActive if provided (defaults to true for ad creation)
    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    if (search) {
      where.OR = [
        {
          name: {
            contains: search,
            mode: 'insensitive' as const
          }
        },
        {
          address: {
            contains: search,
            mode: 'insensitive' as const
          }
        }
      ];
    }

    if (country) {
      where.country = {
        contains: country,
        mode: 'insensitive' as const
      };
    }

    if (stateId) {
      where.stateId = stateId;
    } else if (state) {
      where.state = {
        name: {
          contains: state,
          mode: 'insensitive' as const
        }
      };
    }

    if (districtId) {
      where.districtId = districtId;
    }

    if (cityId) {
      where.cityId = cityId;
    }

    if (postalCodeId) {
      where.postalCodeId = postalCodeId;
    }

    const [locations, total] = await Promise.all([
      prisma.location.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: {
          state: true,
          city: true,
          postalCode: true,
          _count: {
            select: {
              userLocations: true
            }
          }
        }
      }),
      prisma.location.count({ where })
    ]);

    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      success: true,
      data: locations.map(transformLocation),
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
 * /api/v1/admin/locations/{locationId}:
 *   get:
 *     summary: Get location details
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: locationId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Location ID
 *     responses:
 *       200:
 *         description: Location retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
export const getLocationById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { locationId } = req.params;

    const location = await prisma.location.findUnique({
      where: { id: locationId },
      include: {
        state: true,
        city: true,
        postalCode: true,
        _count: {
          select: {
            userLocations: true
          }
        }
      }
    });

    if (!location) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Location not found'
        }
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: transformLocation(location)
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/admin/locations/{locationId}:
 *   put:
 *     summary: Update a location
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: locationId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Location ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Updated City Name"
 *               address:
 *                 type: string
 *                 example: "Updated Address"
 *               latitude:
 *                 type: number
 *                 format: float
 *                 example: 41.8781
 *               longitude:
 *                 type: number
 *                 format: float
 *                 example: -87.6298
 *               city:
 *                 type: string
 *                 example: "Chicago"
 *               state:
 *                 type: string
 *                 example: "Illinois"
 *               country:
 *                 type: string
 *                 example: "USA"
 *               postalCode:
 *                 type: string
 *                 example: "60601"
 *     responses:
 *       200:
 *         description: Location updated successfully
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
export const updateLocation = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { locationId } = req.params;
    const { error, value } = updateLocationSchema.validate(req.body);

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

    // Check if location exists
    const existingLocation = await prisma.location.findUnique({
      where: { id: locationId }
    });

    if (!existingLocation) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Location not found'
        }
      });
      return;
    }

    const updatedLocation = await prisma.location.update({
      where: { id: locationId },
      data: value,
      include: {
        state: true,
        city: true,
        postalCode: true
      }
    });

    res.status(200).json({
      success: true,
      data: transformLocation(updatedLocation),
      message: 'Location updated successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/v1/admin/locations/{locationId}:
 *   delete:
 *     summary: Delete a location
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: locationId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Location ID
 *     responses:
 *       200:
 *         description: Location deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Location cannot be deleted (has associated data)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
export const deleteLocation = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { locationId } = req.params;

    const location = await prisma.location.findUnique({
      where: { id: locationId },
      include: {
        _count: {
          select: {
            userLocations: true
          }
        }
      }
    });

    if (!location) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Location not found'
        }
      });
      return;
    }

    // Check if location has associated user locations
    if (location._count.userLocations > 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'LOCATION_IN_USE',
          message: 'Cannot delete location that has associated user locations'
        }
      });
      return;
    }

    await prisma.location.delete({
      where: { id: locationId }
    });

    res.status(200).json({
      success: true,
      message: 'Location deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};
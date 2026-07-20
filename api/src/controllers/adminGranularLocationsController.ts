import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/database';
import { asyncHandler } from '../utils/errors';
import Joi from 'joi';
import { transformState, transformCity, transformPostalCode } from '../types/standardized-models';

// ========== STATE VALIDATION SCHEMAS ==========
const createStateSchema = Joi.object({
  name: Joi.string().required().min(1).max(100),
  code: Joi.string().max(10),
  country: Joi.string().max(100).default('India'),
  isActive: Joi.boolean().default(true)
});

const updateStateSchema = Joi.object({
  name: Joi.string().min(1).max(100),
  code: Joi.string().max(10).allow(null),
  country: Joi.string().max(100).allow(null),
  isActive: Joi.boolean()
}).min(1);

// ========== CITY VALIDATION SCHEMAS ==========
const createCitySchema = Joi.object({
  name: Joi.string().required().min(1).max(100),
  code: Joi.string().max(10),
  stateId: Joi.string().uuid().required(),
  isActive: Joi.boolean().default(true)
});

const updateCitySchema = Joi.object({
  name: Joi.string().min(1).max(100),
  code: Joi.string().max(10).allow(null),
  stateId: Joi.string().uuid().allow(null),
  isActive: Joi.boolean()
}).min(1);

// ========== POSTAL CODE VALIDATION SCHEMAS ==========
const createPostalCodeSchema = Joi.object({
  code: Joi.string().required().min(1).max(20),
  cityId: Joi.string().uuid().required(),
  isActive: Joi.boolean().default(true)
});

const updatePostalCodeSchema = Joi.object({
  code: Joi.string().min(1).max(20),
  cityId: Joi.string().uuid().allow(null),
  isActive: Joi.boolean()
}).min(1);

// ========== STATE CONTROLLERS ==========

export const createState = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { error, value } = createStateSchema.validate(req.body);

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

    const state = await prisma.state.create({
      data: value
    });

    res.status(201).json({
      success: true,
      data: transformState(state),
      message: 'State created successfully'
    });
  } catch (error) {
    next(error);
  }
};

export const getAllStates = asyncHandler(async (
  req: Request,
  res: Response
): Promise<void> => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
    const country = req.query.country as string;
    const search = req.query.search as string;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (country) {
      where.country = {
        contains: country,
        mode: 'insensitive' as const
      };
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' as const } },
        { code: { contains: search, mode: 'insensitive' as const } }
      ];
    }

    const [states, total] = await Promise.all([
      prisma.state.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: {
          _count: {
            select: {
              cities: true,
              locations: true
            }
          }
        }
      }),
      prisma.state.count({ where })
    ]);

    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      success: true,
      data: states.map(transformState),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      }
    });
});

export const getStateById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { stateId } = req.params;

    const state = await prisma.state.findUnique({
      where: { id: stateId },
      include: {
        cities: {
          orderBy: { name: 'asc' }
        },
        locations: {
          take: 10,
          orderBy: { name: 'asc' }
        }
      }
    });

    if (!state) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'State not found'
        }
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: transformState(state)
    });
  } catch (error) {
    next(error);
  }
};

export const updateState = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { stateId } = req.params;
    const { error, value } = updateStateSchema.validate(req.body);

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

    const state = await prisma.state.update({
      where: { id: stateId },
      data: value
    });

    res.status(200).json({
      success: true,
      data: transformState(state),
      message: 'State updated successfully'
    });
  } catch (error) {
    next(error);
  }
};

export const deleteState = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { stateId } = req.params;

    const state = await prisma.state.findUnique({
      where: { id: stateId },
      include: {
        _count: {
          select: {
            cities: true,
            locations: true,
            profileStates: true,
            recentLocationStates: true
          }
        }
      }
    });

    if (!state) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'State not found'
        }
      });
      return;
    }

    const totalCount =
      state._count.cities +
      state._count.locations +
      state._count.profileStates +
      state._count.recentLocationStates;

    if (totalCount > 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'STATE_IN_USE',
          message: 'Cannot delete state that has associated districts, cities, locations, or profiles'
        }
      });
      return;
    }

    await prisma.state.delete({
      where: { id: stateId }
    });

    res.status(200).json({
      success: true,
      message: 'State deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// ========== DISTRICT CONTROLLERS ==========

// ========== CITY CONTROLLERS ==========

export const createCity = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { error, value } = createCitySchema.validate(req.body);

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

    const city = await prisma.city.create({
      data: value,
      include: {
        state: true
      }
    });

    res.status(201).json({
      success: true,
      data: transformCity(city),
      message: 'City created successfully'
    });
  } catch (error) {
    next(error);
  }
};

export const getAllCities = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
    const stateId = req.query.stateId as string;
    const districtId = req.query.districtId as string;
    const search = req.query.search as string;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (stateId) {
      where.stateId = stateId;
    }

    if (districtId) {
      where.districtId = districtId;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' as const } },
        { code: { contains: search, mode: 'insensitive' as const } }
      ];
    }

    const [cities, total] = await Promise.all([
      prisma.city.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: {
          state: true,
          _count: {
            select: {
              postalCodes: true,
              locations: true
            }
          }
        }
      }),
      prisma.city.count({ where })
    ]);

    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      success: true,
      data: cities.map(transformCity),
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

export const getCityById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { cityId } = req.params;

    const city = await prisma.city.findUnique({
      where: { id: cityId },
      include: {
        state: true,
        postalCodes: {
          orderBy: { code: 'asc' }
        },
        locations: {
          take: 10,
          orderBy: { name: 'asc' }
        }
      }
    });

    if (!city) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'City not found'
        }
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: transformCity(city)
    });
  } catch (error) {
    next(error);
  }
};

export const updateCity = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { cityId } = req.params;
    const { error, value } = updateCitySchema.validate(req.body);

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

    const city = await prisma.city.update({
      where: { id: cityId },
      data: value,
      include: {
        state: true
      }
    });

    res.status(200).json({
      success: true,
      data: transformCity(city),
      message: 'City updated successfully'
    });
  } catch (error) {
    next(error);
  }
};

export const deleteCity = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { cityId } = req.params;

    const city = await prisma.city.findUnique({
      where: { id: cityId },
      include: {
        _count: {
          select: {
            postalCodes: true,
            locations: true,
            profileCities: true,
            recentLocationCities: true
          }
        }
      }
    });

    if (!city) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'City not found'
        }
      });
      return;
    }

    const totalCount =
      city._count.postalCodes +
      city._count.locations +
      city._count.profileCities +
      city._count.recentLocationCities;

    if (totalCount > 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'CITY_IN_USE',
          message: 'Cannot delete city that has associated postal codes, locations, or profiles'
        }
      });
      return;
    }

    await prisma.city.delete({
      where: { id: cityId }
    });

    res.status(200).json({
      success: true,
      message: 'City deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// ========== POSTAL CODE CONTROLLERS ==========

export const createPostalCode = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { error, value } = createPostalCodeSchema.validate(req.body);

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

    const postalCode = await prisma.postalCode.create({
      data: value,
      include: {
        city: {
          include: {
            state: true
          }
        }
      }
    });

    res.status(201).json({
      success: true,
      data: transformPostalCode(postalCode),
      message: 'Postal code created successfully'
    });
  } catch (error) {
    next(error);
  }
};

export const getAllPostalCodes = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
    const cityId = req.query.cityId as string;
    const code = req.query.code as string;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (cityId) {
      where.cityId = cityId;
    }

    if (code) {
      where.code = {
        contains: code,
        mode: 'insensitive' as const
      };
    }

    const [postalCodes, total] = await Promise.all([
      prisma.postalCode.findMany({
        where,
        skip,
        take: limit,
        orderBy: { code: 'asc' },
        include: {
          city: {
            include: {
              state: true
            }
          },
          _count: {
            select: {
              locations: true
            }
          }
        }
      }),
      prisma.postalCode.count({ where })
    ]);

    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      success: true,
      data: postalCodes.map(transformPostalCode),
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

export const getPostalCodeById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { postalCodeId } = req.params;

    const postalCode = await prisma.postalCode.findUnique({
      where: { id: postalCodeId },
      include: {
        city: {
          include: {
            state: true
          }
        },
        locations: {
          take: 10,
          orderBy: { name: 'asc' }
        }
      }
    });

    if (!postalCode) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Postal code not found'
        }
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: transformPostalCode(postalCode)
    });
  } catch (error) {
    next(error);
  }
};

export const updatePostalCode = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { postalCodeId } = req.params;
    const { error, value } = updatePostalCodeSchema.validate(req.body);

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

    const postalCode = await prisma.postalCode.update({
      where: { id: postalCodeId },
      data: value,
      include: {
        city: {
          include: {
            state: true
          }
        }
      }
    });

    res.status(200).json({
      success: true,
      data: transformPostalCode(postalCode),
      message: 'Postal code updated successfully'
    });
  } catch (error) {
    next(error);
  }
};

export const deletePostalCode = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { postalCodeId } = req.params;

    const postalCode = await prisma.postalCode.findUnique({
      where: { id: postalCodeId },
      include: {
        _count: {
          select: {
            locations: true,
            profilePostalCodes: true,
            recentLocationPostalCodes: true
          }
        }
      }
    });

    if (!postalCode) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Postal code not found'
        }
      });
      return;
    }

    const totalCount =
      postalCode._count.locations +
      postalCode._count.profilePostalCodes +
      postalCode._count.recentLocationPostalCodes;

    if (totalCount > 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'POSTAL_CODE_IN_USE',
          message: 'Cannot delete postal code that has associated locations or profiles'
        }
      });
      return;
    }

    await prisma.postalCode.delete({
      where: { id: postalCodeId }
    });

    res.status(200).json({
      success: true,
      message: 'Postal code deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

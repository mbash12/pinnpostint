import { Request, Response } from 'express';
import { prisma } from '../utils/database';
import { AuthRequest } from '../middleware/auth';

// Admin endpoints
export const getAllLandingPages = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page = 1, limit = 10, isActive } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    // Build where clause
    const where: any = {};
    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    const [landingPages, total] = await Promise.all([
      prisma.landingPage.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { sectionKey: 'asc' }
      }),
      prisma.landingPage.count({ where })
    ]);

    res.json({
      success: true,
      data: landingPages,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching landing pages:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch landing pages'
      }
    });
  }
};

export const getLandingPageBySection = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sectionKey } = req.params;

    const landingPage = await prisma.landingPage.findUnique({
      where: { sectionKey }
    });

    if (!landingPage) {
      res.status(404).json({
        success: false,
        error: {
          code: 'SECTION_NOT_FOUND',
          message: 'Landing page section not found'
        }
      });
      return;
    }

    res.json({
      success: true,
      data: landingPage
    });
  } catch (error) {
    console.error('Error fetching landing page:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch landing page'
      }
    });
  }
};

export const updateLandingPage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sectionKey } = req.params;
    const { config, isActive } = req.body;

    // Validate required fields
    if (!config) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Config is required'
        }
      });
      return;
    }

    const landingPage = await prisma.landingPage.upsert({
      where: { sectionKey },
      update: {
        config,
        isActive: isActive !== undefined ? isActive : true,
        updatedAt: new Date()
      },
      create: {
        sectionKey,
        config,
        isActive: isActive !== undefined ? isActive : true
      }
    });

    res.json({
      success: true,
      data: landingPage
    });
  } catch (error) {
    console.error('Error updating landing page:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update landing page'
      }
    });
  }
};

export const deleteLandingPage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sectionKey } = req.params;

    const landingPage = await prisma.landingPage.findUnique({
      where: { sectionKey }
    });

    if (!landingPage) {
      res.status(404).json({
        success: false,
        error: {
          code: 'SECTION_NOT_FOUND',
          message: 'Landing page section not found'
        }
      });
      return;
    }

    await prisma.landingPage.delete({
      where: { sectionKey }
    });

    res.json({
      success: true,
      message: 'Landing page section deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting landing page:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to delete landing page'
      }
    });
  }
};

// Public endpoint
export const getPublicLandingPage = async (req: Request, res: Response): Promise<void> => {
  try {
    const { sectionKey } = req.params;

    const landingPage = await prisma.landingPage.findFirst({
      where: {
        sectionKey,
        isActive: true
      },
      select: {
        sectionKey: true,
        config: true
      }
    });

    if (!landingPage) {
      res.status(404).json({
        success: false,
        error: {
          code: 'SECTION_NOT_FOUND',
          message: 'Landing page section not found or inactive'
        }
      });
      return;
    }

    res.json({
      success: true,
      data: landingPage
    });
  } catch (error) {
    console.error('Error fetching public landing page:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch landing page'
      }
    });
  }
};
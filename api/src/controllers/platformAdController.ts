import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { ResponseHelper } from '../utils/response-helpers';
import { ErrorCode } from '../types/api-responses';

const prisma = new PrismaClient();

/**
 * Public: Get active platform ads for display
 */
export const getActivePlatformAds = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { position } = req.query;

    const ads = await prisma.platformAd.findMany({
      where: {
        isActive: true,
        ...(position ? { position: position as any } : {}),
      },
      orderBy: {
        order: 'asc',
      },
    });

    ResponseHelper.success(res, ads, 'Platform ads retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Get all platform ads
 */
export const getAllPlatformAds = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const ads = await prisma.platformAd.findMany({
      orderBy: [
        { position: 'asc' },
        { order: 'asc' },
      ],
    });

    ResponseHelper.success(res, ads, 'All platform ads retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Get a single platform ad by ID
 */
export const getPlatformAdById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const ad = await prisma.platformAd.findUnique({
      where: { id },
    });

    if (!ad) {
      ResponseHelper.error(res, 404, ErrorCode.NOT_FOUND, 'Platform ad not found');
      return;
    }

    ResponseHelper.success(res, ad, 'Platform ad retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Create a platform ad
 */
export const createPlatformAd = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { title, description, imageUrl, linkUrl, position, type, isActive, order } = req.body;

    if (!imageUrl) {
      ResponseHelper.error(res, 400, ErrorCode.VALIDATION_ERROR, 'Image URL is required');
      return;
    }

    const ad = await prisma.platformAd.create({
      data: {
        title,
        description,
        imageUrl,
        linkUrl,
        position: position || 'LEFT',
        type: type || 'IMAGE',
        isActive: isActive !== undefined ? isActive : true,
        order: order || 0,
      },
    });

    ResponseHelper.success(res, ad, 'Platform ad created successfully', 201);
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Update a platform ad
 */
export const updatePlatformAd = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { title, description, imageUrl, linkUrl, position, type, isActive, order } = req.body;

    const existingAd = await prisma.platformAd.findUnique({
      where: { id },
    });

    if (!existingAd) {
      ResponseHelper.error(res, 404, ErrorCode.NOT_FOUND, 'Platform ad not found');
      return;
    }

    const updatedAd = await prisma.platformAd.update({
      where: { id },
      data: {
        title,
        description,
        imageUrl,
        linkUrl,
        position,
        type,
        isActive,
        order,
      },
    });

    ResponseHelper.success(res, updatedAd, 'Platform ad updated successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Delete a platform ad
 */
export const deletePlatformAd = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const existingAd = await prisma.platformAd.findUnique({
      where: { id },
    });

    if (!existingAd) {
      ResponseHelper.error(res, 404, ErrorCode.NOT_FOUND, 'Platform ad not found');
      return;
    }

    await prisma.platformAd.delete({
      where: { id },
    });

    ResponseHelper.success(res, null, 'Platform ad deleted successfully');
  } catch (error) {
    next(error);
  }
};

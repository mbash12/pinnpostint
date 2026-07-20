/**
 * Recent Locations Controller
 * Handles CRUD operations for user's recent locations
 */

import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import { ApiResponse } from '../types/api-responses';

const prisma = new PrismaClient();

interface CreateRecentLocationRequest {
  name: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  city?: string;
  state?: string;
  country: string;
  postalCode?: string;
  isCurrentLocation?: boolean;
}

export class RecentLocationController {
  /**
   * Get all recent locations for the authenticated user
   */
  static async getRecentLocations(this: void, req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { limit = 10 } = req.query;

      const recentLocations = await prisma.recentLocation.findMany({
        where: { userId },
        orderBy: [
          { lastUsed: 'desc' },
          { usageCount: 'desc' }
        ],
        take: Number(limit),
      });

      const response: ApiResponse<typeof recentLocations> = {
        success: true,
        data: recentLocations,
        message: 'Recent locations retrieved successfully',
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Error getting recent locations:', error);
      const response: ApiResponse<null> = {
        success: false,
        data: null,
        message: 'Failed to retrieve recent locations',
      };
      res.status(500).json(response);
    }
  }

  /**
   * Create or update a recent location
   */
  static async createRecentLocation(this: void, req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const locationData: CreateRecentLocationRequest = req.body;

      // Validate required fields
      if (!locationData.name || !locationData.country) {
        const response: ApiResponse<null> = {
          success: false,
          data: null,
          message: 'Name and country are required',
        };
        res.status(400).json(response);
        return;
      }

      // Check if location already exists for this user
      const existingLocation = await prisma.recentLocation.findFirst({
        where: {
          userId,
          name: locationData.name,
          latitude: locationData.latitude,
          longitude: locationData.longitude,
        },
      });

      let recentLocation;

      if (existingLocation) {
        // Update existing location
        recentLocation = await prisma.recentLocation.update({
          where: { id: existingLocation.id },
          data: {
            usageCount: existingLocation.usageCount + 1,
            lastUsed: new Date(),
            address: locationData.address || existingLocation.address,
            cityId: locationData.city || existingLocation.cityId,
            stateId: locationData.state || existingLocation.stateId,
            postalCodeId: locationData.postalCode || existingLocation.postalCodeId,
            isCurrentLocation: locationData.isCurrentLocation ?? existingLocation.isCurrentLocation,
          },
        });
      } else {
        // Create new location
        recentLocation = await prisma.recentLocation.create({
          data: {
            userId,
            name: locationData.name,
            address: locationData.address,
            latitude: locationData.latitude,
            longitude: locationData.longitude,
            cityId: locationData.city,
            stateId: locationData.state,
            country: locationData.country,
            postalCodeId: locationData.postalCode,
            isCurrentLocation: locationData.isCurrentLocation ?? false,
            usageCount: 1,
            lastUsed: new Date(),
          },
        });
      }

      const response: ApiResponse<typeof recentLocation> = {
        success: true,
        data: recentLocation,
        message: 'Recent location saved successfully',
      };

      res.status(201).json(response);
    } catch (error) {
      console.error('Error creating recent location:', error);
      const response: ApiResponse<null> = {
        success: false,
        data: null,
        message: 'Failed to save recent location',
      };
      res.status(500).json(response);
    }
  }

  /**
   * Update location usage count and timestamp
   */
  static async updateLocationUsage(this: void, req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      // Verify the location belongs to the user
      const existingLocation = await prisma.recentLocation.findFirst({
        where: { id, userId },
      });

      if (!existingLocation) {
        const response: ApiResponse<null> = {
          success: false,
          data: null,
          message: 'Location not found',
        };
        res.status(404).json(response);
        return;
      }

      const updatedLocation = await prisma.recentLocation.update({
        where: { id },
        data: {
          usageCount: existingLocation.usageCount + 1,
          lastUsed: new Date(),
        },
      });

      const response: ApiResponse<typeof updatedLocation> = {
        success: true,
        data: updatedLocation,
        message: 'Location usage updated successfully',
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Error updating location usage:', error);
      const response: ApiResponse<null> = {
        success: false,
        data: null,
        message: 'Failed to update location usage',
      };
      res.status(500).json(response);
    }
  }

  /**
   * Delete a recent location
   */
  static async deleteRecentLocation(this: void, req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      // Verify the location belongs to the user
      const existingLocation = await prisma.recentLocation.findFirst({
        where: { id, userId },
      });

      if (!existingLocation) {
        const response: ApiResponse<null> = {
          success: false,
          data: null,
          message: 'Location not found',
        };
        res.status(404).json(response);
        return;
      }

      await prisma.recentLocation.delete({
        where: { id },
      });

      const response: ApiResponse<null> = {
        success: true,
        data: null,
        message: 'Recent location deleted successfully',
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Error deleting recent location:', error);
      const response: ApiResponse<null> = {
        success: false,
        data: null,
        message: 'Failed to delete recent location',
      };
      res.status(500).json(response);
    }
  }

  /**
   * Clear all recent locations for the user
   */
  static async clearRecentLocations(this: void, req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;

      await prisma.recentLocation.deleteMany({
        where: { userId },
      });

      const response: ApiResponse<null> = {
        success: true,
        data: null,
        message: 'All recent locations cleared successfully',
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Error clearing recent locations:', error);
      const response: ApiResponse<null> = {
        success: false,
        data: null,
        message: 'Failed to clear recent locations',
      };
      res.status(500).json(response);
    }
  }

  /**
   * Get a specific recent location by ID
   */
  static async getRecentLocationById(this: void, req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      const location = await prisma.recentLocation.findFirst({
        where: { id, userId },
      });

      if (!location) {
        const response: ApiResponse<null> = {
          success: false,
          data: null,
          message: 'Location not found',
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse<typeof location> = {
        success: true,
        data: location,
        message: 'Location retrieved successfully',
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Error getting recent location:', error);
      const response: ApiResponse<null> = {
        success: false,
        data: null,
        message: 'Failed to retrieve location',
      };
      res.status(500).json(response);
    }
  }
}
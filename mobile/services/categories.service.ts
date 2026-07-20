/**
 * Categories Service
 * Handles all category-related API calls
 */

import { apiService, ApiResponse } from './api.service';
import { API_ENDPOINTS } from '@/config/api.config';

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  adPlaceholder?: string;
  isActive: boolean;
  isFeatured: boolean;
  supportsBooking: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
  subcategories?: Subcategory[];
}

export interface Subcategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  categoryId: string;
  supportsBooking: boolean;
  isActive: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
  attributes?: Attribute[];
}

export interface Attribute {
  id: string;
  name: string;
  type: 'text' | 'number' | 'boolean' | 'select' | 'textarea' | 'date' | 'file' | 'tel' | 'phone' | 'url' | 'website' | 'email';
  options?: string[];
  image?: string;
  subcategoryId: string;
  isRequired: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

class CategoriesService {
  /**
   * Get all categories
   */
  async getCategories(): Promise<ApiResponse<Category[]>> {
    return apiService.get<Category[]>(API_ENDPOINTS.PUBLIC.CATEGORIES);
  }

  /**
   * Get single category with subcategories
   */
  async getCategory(categoryId: string): Promise<ApiResponse<Category>> {
    return apiService.get<Category>(
      API_ENDPOINTS.PUBLIC.CATEGORY_DETAIL(categoryId)
    );
  }

  /**
   * Get subcategories for a specific category
   */
  async getCategorySubcategories(categoryId: string): Promise<ApiResponse<Subcategory[]>> {
    return apiService.get<Subcategory[]>(
      API_ENDPOINTS.PUBLIC.CATEGORY_SUBCATEGORIES(categoryId)
    );
  }

  /**
   * Get attributes for a specific subcategory
   */
  async getSubcategoryAttributes(subcategoryId: string): Promise<ApiResponse<Attribute[]>> {
    return apiService.get<Attribute[]>(
      API_ENDPOINTS.PUBLIC.SUBCATEGORY_ATTRIBUTES(subcategoryId)
    );
  }

  /**
   * Get attributes for a specific category
   */
  async getCategoryAttributes(categoryId: string): Promise<ApiResponse<Attribute[]>> {
    return apiService.get<Attribute[]>(
      API_ENDPOINTS.PUBLIC.CATEGORY_ATTRIBUTES(categoryId)
    );
  }

  /**
   * Find category ID by name
   */
  async findCategoryIdByName(categoryName: string): Promise<string | null> {
    try {
      const response = await this.getCategories();
      if (response.success && response.data) {
        const category = response.data.find(cat => 
          cat.name.toLowerCase() === categoryName.toLowerCase() ||
          cat.slug.toLowerCase() === categoryName.toLowerCase()
        );
        return category?.id || null;
      }
    } catch (error) {
    }
    return null;
  }

  /**
   * Find subcategory ID by name and category
   */
  async findSubcategoryIdByName(subcategoryName: string, categoryId: string): Promise<string | null> {
    try {
      const response = await this.getCategorySubcategories(categoryId);
      if (response.success && response.data) {
        const subcategory = response.data.find(sub =>
          sub.name.toLowerCase() === subcategoryName.toLowerCase() ||
          sub.slug.toLowerCase() === subcategoryName.toLowerCase()
        );
        return subcategory?.id || null;
      }
    } catch (error) {
    }
    return null;
  }

}

// Export singleton instance
export const categoriesService = new CategoriesService();
export default categoriesService;

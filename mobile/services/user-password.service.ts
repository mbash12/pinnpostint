/**
 * User Service
 * Service for user-related operations including password management
 */

import { apiService, ApiResponse } from './api.service';
import { API_ENDPOINTS } from '@/config/api.config';

export interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

class UserPasswordService {
  /**
   * Change user password
   */
  async changePassword(data: ChangePasswordData): Promise<ApiResponse<{ message: string }>> {
    return apiService.put<{ message: string }>(API_ENDPOINTS.USER.CHANGE_PASSWORD, data);
  }
}

// Export singleton instance
export const userPasswordService = new UserPasswordService();
export default userPasswordService;
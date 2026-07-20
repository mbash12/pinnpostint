import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiResponse } from '@/lib/api-types';
import { apiClient } from '@/lib/api-client';

// Types
export interface AppSettings {
    system: {
        bookingPrice: number;
        reminderExpirationDays: number[];
        smsNotificationsEnabled?: boolean;
        autoCompleteBookingDays: number;
        autoCancelBookingDays: number;
        subscriptionPrice: number;
        subscriptionDuration: number;
        freeAdDuration: number;
        serviceFeeFixed: number;
        heroTitle?: string;
        heroSubtitle?: string;
        heroImage?: string;
        customerCareEmail?: string;
    };
}

// API keys
const SETTINGS_QUERY_KEY = ['settings'];

// API functions
const fetchSettings = async (): Promise<ApiResponse<AppSettings>> => {
    const response = await apiClient.get<AppSettings>('/admin/settings');
    return response;
};

const updateSettings = async (settings: AppSettings): Promise<ApiResponse<AppSettings>> => {
    const response = await apiClient.put('/admin/settings', settings);
    return response.data as ApiResponse<AppSettings>;
};

const exportSettings = async (): Promise<ApiResponse<any>> => {
    const response = await apiClient.get('/admin/settings/export');
    return response.data as ApiResponse<any>;
};

const importSettings = async (settingsData: any): Promise<ApiResponse<AppSettings>> => {
    const response = await apiClient.post('/admin/settings/import', settingsData);
    return response.data as ApiResponse<any>;
};

const resetSettings = async (): Promise<ApiResponse<AppSettings>> => {
    const response = await apiClient.post('/admin/settings/reset');
    return response.data as ApiResponse<any>;
};


// Hooks
export const useSettings = () => {
    return useQuery({
        queryKey: SETTINGS_QUERY_KEY,
        queryFn: fetchSettings,
    });
};

export const useUpdateSettings = () => {
    const queryClient = useQueryClient();
    
    return useMutation({
        mutationFn: updateSettings,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEY });
        },
    });
};

export const useExportSettings = () => {
    return useMutation({
        mutationFn: exportSettings,
    });
};

export const useImportSettings = () => {
    const queryClient = useQueryClient();
    
    return useMutation({
        mutationFn: importSettings,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEY });
        },
    });
};

export const useResetSettings = () => {
    const queryClient = useQueryClient();
    
    return useMutation({
        mutationFn: resetSettings,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEY });
        },
    });
};


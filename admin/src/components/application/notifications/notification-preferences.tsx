/**
 * Notification Preferences Component
 * Manages user notification preferences in the admin panel
 */

import React, { useState, useEffect } from 'react';
import { useNotificationPreferences, type NotificationPreferences } from '@/hooks/use-notifications';

interface NotificationPreferencesProps {
  userId: string;
  className?: string;
  onClose?: () => void;
}

export const NotificationPreferencesComponent: React.FC<NotificationPreferencesProps> = ({ 
  userId,
  className = '',
  onClose 
}) => {
  const {
    preferences,
    isLoading,
    error,
    updatePreferences,
    refreshPreferences,
  } = useNotificationPreferences();

  const [localPreferences, setLocalPreferences] = useState<NotificationPreferences | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (userId) {
      refreshPreferences(userId);
    }
  }, [userId, refreshPreferences]);

  useEffect(() => {
    if (preferences) {
      setLocalPreferences(preferences);
    }
  }, [preferences]);

  const handlePreferenceChange = (key: keyof NotificationPreferences, value: boolean) => {
    if (localPreferences) {
      setLocalPreferences({
        ...localPreferences,
        [key]: value,
      });
    }
  };

  const handleSave = async () => {
    if (!localPreferences) return;

    try {
      setIsSaving(true);
      setSaveError(null);
      setSaveSuccess(null);

      const result = await updatePreferences(userId, localPreferences);

      if (result.success) {
        setSaveSuccess('Notification preferences updated successfully!');
        setTimeout(() => setSaveSuccess(null), 3000);
      } else {
        setSaveError(result.error || 'Failed to update preferences');
      }
    } catch (err) {
      setSaveError('Failed to update preferences');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (preferences) {
      setLocalPreferences(preferences);
      setSaveError(null);
      setSaveSuccess(null);
    }
  };

  const preferenceItems = [
    {
      key: 'emailNotifications' as keyof NotificationPreferences,
      title: 'Email Notifications',
      description: 'Receive notifications via email',
      icon: '📧',
    },
    {
      key: 'pushNotifications' as keyof NotificationPreferences,
      title: 'Push Notifications',
      description: 'Receive push notifications on mobile devices',
      icon: '📱',
    },
  ];

  if (isLoading) {
    return (
      <div className={`bg-white border border-gray-200 rounded-lg p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-4">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gray-200 rounded"></div>
                  <div>
                    <div className="h-4 bg-gray-200 rounded w-32 mb-1"></div>
                    <div className="h-3 bg-gray-200 rounded w-48"></div>
                  </div>
                </div>
                <div className="w-12 h-6 bg-gray-200 rounded-full"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-white border border-gray-200 rounded-lg p-6 ${className}`}>
        <div className="text-center">
          <div className="text-red-600 mb-2">⚠️</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Preferences</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => refreshPreferences(userId)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!localPreferences) {
    return (
      <div className={`bg-white border border-gray-200 rounded-lg p-6 ${className}`}>
        <div className="text-center text-gray-500">
          No notification preferences found
        </div>
      </div>
    );
  }

  const hasChanges = preferences && JSON.stringify(localPreferences) !== JSON.stringify(preferences);

  return (
    <div className={`bg-white border border-gray-200 rounded-lg ${className}`}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-medium text-gray-900">Notification Preferences</h3>
            <p className="text-sm text-gray-600 mt-1">
              Manage notification settings for this user
            </p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Success/Error Messages */}
      <div className="px-6 py-4">
        {saveSuccess && (
          <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg mb-4">
            {saveSuccess}
          </div>
        )}

        {saveError && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-4">
            {saveError}
          </div>
        )}
      </div>

      {/* Preferences List */}
      <div className="px-6 pb-6">
        <div className="space-y-4">
          {preferenceItems.map((item) => (
            <div key={item.key} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
              <div className="flex items-center space-x-3">
                <div className="text-2xl">{item.icon}</div>
                <div>
                  <h4 className="text-sm font-medium text-gray-900">{item.title}</h4>
                  <p className="text-xs text-gray-600">{item.description}</p>
                </div>
              </div>
              
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={localPreferences[item.key]}
                  onChange={(e) => handlePreferenceChange(item.key, e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        {hasChanges && (
          <div className="flex justify-end space-x-3 mt-6 pt-6 border-t border-gray-200">
            <button
              onClick={handleReset}
              disabled={isSaving}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Reset
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationPreferencesComponent;
import { StyleSheet, View, ScrollView, TouchableOpacity, Switch, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { userService } from '@/services';
import type { NotificationPreferences } from '@/types/api.types';
import { useAlert } from '@/components/ui/custom-alert';
import { useAuth } from '@/contexts/auth-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AuthProtection } from '@/components/auth-protection';
import { Footer } from '@/components/footer';
import { Colors, WebShadows } from '@/constants/theme';
import { DesktopProfileLayout } from '@/components/desktop-profile-layout';
import { useResponsive } from '@/hooks/use-responsive';
import { HEADER_HEIGHT } from '@/constants/layout';

interface SettingItem {
  id: string;
  title: string;
  subtitle?: string;
  type: 'toggle' | 'navigation' | 'info' | 'danger';
  icon?: string;
  value?: boolean;
  onPress?: () => void;
  onToggle?: (value: boolean) => void;
}

export default function SettingsScreen() {
  const router = useRouter();
  const { isDesktop } = useResponsive();
  const { logout } = useAuth();
  const { showAlert } = useAlert();
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    emailNotifications: true,
    pushNotifications: true,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchNotificationPreferences();
  }, []);

  const fetchNotificationPreferences = async () => {
    try {
      setIsLoading(true);
      const response = await userService.getNotificationPreferences();
      if (response.success && response.data) {
        setPreferences(response.data);
      }
    } catch (error) {
      showAlert({
        title: 'Error',
        message: 'Failed to load notification preferences',
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updateNotificationPreference = async (key: keyof NotificationPreferences, value: boolean) => {
    try {
      setIsSaving(true);
      const updatedPreferences = { ...preferences, [key]: value };
      setPreferences(updatedPreferences);

      const response = await userService.updateNotificationPreferences({ [key]: value });
      if (!response.success) {
        // Revert on failure
        setPreferences(preferences);
        showAlert({
          title: 'Error',
          message: 'Failed to update notification preferences',
          type: 'error'
        });
      }
    } catch (error) {
      // Revert on failure
      setPreferences(preferences);
      showAlert({
        title: 'Error',
        message: 'Failed to update notification preferences',
        type: 'error'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = () => {
    showAlert({
      title: 'Delete Account',
      message: 'Are you sure you want to delete your account? This action cannot be undone.',
      type: 'warning',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsDeleting(true);
              const response = await userService.deleteAccount();
              if (response.success) {
                showAlert({
                  title: 'Success',
                  message: 'Your account has been deleted successfully',
                  type: 'success',
                  buttons: [{
                    text: 'OK',
                    style: 'default',
                    onPress: () => {
                      logout();
                      router.replace('/(auth)/login');
                    }
                  }]
                });
              } else {
                throw new Error('Failed to delete account');
              }
            } catch (error) {
              showAlert({
                title: 'Error',
                message: 'Failed to delete account. Please try again.',
                type: 'error'
              });
            } finally {
              setIsDeleting(false);
            }
          }
        }
      ]
    });
  };

  const settingsSections = [
    {
      title: 'Notifications',
      items: [
        {
          id: 'pushNotifications',
          title: 'Push Notifications',
          subtitle: 'Quick toggle for push notifications',
          type: 'toggle' as const,
          icon: 'notifications-outline',
          value: preferences.pushNotifications,
          onToggle: (value: boolean) => updateNotificationPreference('pushNotifications', value),
        },
        {
          id: 'emailNotifications',
          title: 'Email Notifications',
          subtitle: 'Quick toggle for email notifications',
          type: 'toggle' as const,
          icon: 'mail-outline',
          value: preferences.emailNotifications,
          onToggle: (value: boolean) => updateNotificationPreference('emailNotifications', value),
        },
      ],
    },
    {
      title: 'Account',
      items: [
        {
          id: 'change-password',
          title: 'Change Password',
          subtitle: 'Update your password',
          type: 'navigation' as const,
          icon: 'lock-closed-outline',
          onPress: () => router.push('/(pages)/change-password'),
        },
        {
          id: 'delete-account',
          title: 'Delete Account',
          subtitle: 'Permanently delete your account',
          type: 'danger' as const,
          icon: 'trash-outline',
          onPress: handleDeleteAccount,
        },
      ],
    },
  ];

  const renderSettingItem = (item: SettingItem) => {
    return (
      <TouchableOpacity
        key={item.id}
        style={styles.settingItem}
        onPress={item.onPress}
        disabled={item.type === 'toggle' || item.type === 'info' || isDeleting}
        activeOpacity={0.7}
      >
        <View style={styles.settingLeft}>
          {item.icon && (
            <View style={[styles.iconContainer, item.type === 'danger' && styles.iconContainerDanger]}>
              <Ionicons name={item.icon as any} size={20} color={item.type === 'danger' ? '#DC2626' : Colors.light.textSecondary} />
            </View>
          )}
          <View style={styles.settingText}>
            <ThemedText style={[styles.settingTitle, item.type === 'danger' && styles.settingTitleDanger]}>{item.title}</ThemedText>
            {item.subtitle && (
              <ThemedText style={styles.settingSubtitle}>{item.subtitle}</ThemedText>
            )}
          </View>
        </View>
        
        <View style={styles.settingRight}>
          {item.type === 'toggle' && (
            <TouchableOpacity
              style={[
                styles.customSwitch,
                item.value && styles.customSwitchActive,
                isSaving && styles.customSwitchDisabled
              ]}
              onPress={() => !isSaving && item.onToggle?.(!item.value)}
              activeOpacity={0.8}
              disabled={isSaving}
            >
              <View style={[
                styles.customSwitchThumb,
                item.value && styles.customSwitchThumbActive
              ]} />
            </TouchableOpacity>
          )}
          {item.type === 'navigation' && (
            <MaterialIcons name="chevron-right" size={24} color={Colors.light.textSecondary} />
          )}
          {item.type === 'danger' && isDeleting && (
            <ActivityIndicator size="small" color="#DC2626" />
          )}
          {item.type === 'info' && (
            <ThemedText style={styles.infoText}>2.3 GB</ThemedText>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <AuthProtection>
      <DesktopProfileLayout>
        <ThemedView style={[styles.container, { paddingTop: isDesktop ? 0 : HEADER_HEIGHT }]}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={[styles.header, isDesktop && { paddingHorizontal: 0 }]}>
          <ThemedText style={styles.title}>Settings</ThemedText>
          <ThemedText style={styles.subtitle}>
            Customize your app experience
          </ThemedText>
        </View>

        {/* Settings Sections */}
        <View style={styles.content}>
          {settingsSections.map((section) => (
            <View key={section.title} style={styles.section}>
              <ThemedText style={[styles.sectionTitle, isDesktop && { paddingHorizontal: 0 }]}>{section.title}</ThemedText>
              <View style={[styles.sectionContent, isDesktop && { marginHorizontal: 0 }]}>
                {section.items.map(renderSettingItem)}
              </View>
            </View>
          ))}
        </View>
        {!isDesktop && <Footer />}
        </ScrollView>
        </ThemedView>
      </DesktopProfileLayout>
    </AuthProtection>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    paddingBottom: 20,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  content: {
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  sectionContent: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    borderRadius: 12,
    boxShadow: WebShadows.soft,
    elevation: 1,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  settingLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconContainerDanger: {
    backgroundColor: '#FEE2E2',
  },
  settingText: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.light.text,
    marginBottom: 2,
  },
  settingTitleDanger: {
    color: '#DC2626',
  },
  settingSubtitle: {
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  settingRight: {
    alignItems: 'center',
  },
  infoText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    fontWeight: '500',
  },
  customSwitch: {
    width: 40,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E5E5E5',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  customSwitchActive: {
    backgroundColor: '#CC1614',
  },
  customSwitchThumb: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
    boxShadow: WebShadows.subtle,
    elevation: 2,
  },
  customSwitchThumbActive: {
    transform: [{ translateX: 16 }],
  },
  customSwitchDisabled: {
    opacity: 0.5,
  },
});
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAlert } from '@/components/ui/custom-alert';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AuthProtection } from '@/components/auth-protection';
import { FloatingLabelInput } from '@/components/ui/floating-label-input';
import { GradientButton } from '@/components/ui/gradient-button';
import { Footer } from '@/components/footer';
import { DesktopProfileLayout } from '@/components/desktop-profile-layout';
import { Colors, WebShadows } from '@/constants/theme';
import { userPasswordService, ChangePasswordData } from '@/services/user-password.service';
import { useResponsive } from '@/hooks/use-responsive';
import { HEADER_HEIGHT } from '@/constants/layout';

export default function ChangePasswordScreen() {
  const router = useRouter();
  const { isDesktop } = useResponsive();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { showAlert } = useAlert();

  const validatePassword = (password: string): boolean => {
    return password.length >= 8;
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      showAlert({
        type: 'error',
        title: 'Missing Information',
        message: 'Please fill in all password fields'
      });
      return;
    }

    if (!validatePassword(newPassword)) {
      showAlert({
        type: 'error',
        title: 'Invalid Password',
        message: 'New password must be at least 8 characters long'
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      showAlert({
        type: 'error',
        title: 'Password Mismatch',
        message: 'New password and confirm password do not match'
      });
      return;
    }

    if (currentPassword === newPassword) {
      showAlert({
        type: 'error',
        title: 'No Change',
        message: 'New password must be different from current password'
      });
      return;
    }

    setIsLoading(true);

    try {
      const passwordData: ChangePasswordData = {
        currentPassword,
        newPassword,
        confirmPassword
      };

      const response = await userPasswordService.changePassword(passwordData);

      if (response.success) {
        showAlert({
          type: 'success',
          title: 'Password Changed Successfully',
          message: response.data?.message || 'Your password has been updated. Please use your new password for future logins.',
          buttons: [
            {
              text: 'OK',
              onPress: () => router.back(),
            },
          ]
        });

        // Clear form
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        showAlert({
          type: 'error',
          title: 'Error',
          message: response.error?.message || 'Failed to change password. Please try again.'
        });
      }
    } catch (error: any) {
      showAlert({
        type: 'error',
        title: 'Error',
        message: error.message || 'Failed to change password. Please try again.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthProtection>
      <DesktopProfileLayout>
        <ThemedView style={[styles.container, { paddingTop: isDesktop ? 0 : HEADER_HEIGHT }]}>
          <ScrollView 
            style={styles.content} 
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Header */}
            <View style={styles.header}>
              <ThemedText style={styles.title}>Change Password</ThemedText>
              <ThemedText style={styles.subtitle}>
                Update your account password for better security
              </ThemedText>
            </View>

            {/* Form */}
            <View style={[styles.formCard, isDesktop && { padding: 24 }]}>
              <View style={styles.form}>
              {/* Current Password */}
              <FloatingLabelInput
                label="Current Password"
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry={!showCurrentPassword}
                containerStyle={styles.inputContainer}
                rightIcon={
                  <TouchableOpacity
                    style={styles.eyeIcon}
                    onPress={() => setShowCurrentPassword(!showCurrentPassword)}
                  >
                    <MaterialIcons
                      name={showCurrentPassword ? 'visibility' : 'visibility-off'}
                      size={20}
                      color={Colors.light.textSecondary}
                    />
                  </TouchableOpacity>
                }
              />

              {/* New Password */}
              <FloatingLabelInput
                label="New Password"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showNewPassword}
                containerStyle={styles.inputContainer}
                rightIcon={
                  <TouchableOpacity
                    style={styles.eyeIcon}
                    onPress={() => setShowNewPassword(!showNewPassword)}
                  >
                    <MaterialIcons
                      name={showNewPassword ? 'visibility' : 'visibility-off'}
                      size={20}
                      color={Colors.light.textSecondary}
                    />
                  </TouchableOpacity>
                }
              />

              {/* Confirm Password */}
              <View style={styles.inputContainer}>
                <FloatingLabelInput
                  label="Confirm New Password"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                  error={confirmPassword.length > 0 && newPassword !== confirmPassword ? "Passwords do not match" : undefined}
                  rightIcon={
                    <TouchableOpacity
                      style={styles.eyeIcon}
                      onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      <MaterialIcons
                        name={showConfirmPassword ? 'visibility' : 'visibility-off'}
                        size={20}
                        color={Colors.light.textSecondary}
                      />
                    </TouchableOpacity>
                  }
                />
              </View>

              {/* Password Requirements */}
              <View style={styles.requirements}>
                <ThemedText style={styles.requirementsTitle}>Password Requirements:</ThemedText>
                <View style={styles.requirementItem}>
                  <MaterialIcons 
                    name={newPassword.length >= 8 ? 'check-circle' : 'radio-button-unchecked'} 
                    size={16} 
                    color={newPassword.length >= 8 ? Colors.light.success : Colors.light.textSecondary} 
                  />
                  <ThemedText style={styles.requirementText}>At least 8 characters</ThemedText>
                </View>
                <View style={styles.requirementItem}>
                  <MaterialIcons 
                    name={currentPassword !== newPassword && newPassword.length > 0 ? 'check-circle' : 'radio-button-unchecked'} 
                    size={16} 
                    color={currentPassword !== newPassword && newPassword.length > 0 ? Colors.light.success : Colors.light.textSecondary} 
                  />
                  <ThemedText style={styles.requirementText}>Different from current password</ThemedText>
                </View>
              </View>
              </View>
            </View>

            {/* Change Password Button */}
            <GradientButton
              title="Change Password"
              onPress={handleChangePassword}
              loading={isLoading}
              disabled={isLoading || !currentPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword}
              style={styles.changeButton}
            />

            {/* Security Note */}
            <View style={styles.securityNote}>
              <MaterialIcons name="security" size={16} color={Colors.light.textSecondary} />
              <ThemedText style={styles.securityText}>
                Your password is encrypted and stored securely
              </ThemedText>
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
  content: {
    flex: 1,
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
    fontSize: 14,
    color: Colors.light.textSecondary,
    lineHeight: 20,
  },
  form: {
    marginBottom: 16,
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    boxShadow: WebShadows.soft,
    elevation: 1,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 24,
  },
  inputContainer: {
    marginBottom: 10,
  },
  eyeIcon: {
    padding: 4,
  },
  requirements: {
    backgroundColor: Colors.light.backgroundSecondary,
    padding: 16,
    borderRadius: 12,
    marginTop: 10,
  },
  requirementsTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.light.text,
    marginBottom: 12,
  },
  requirementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  requirementText: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    marginLeft: 8,
  },
  changeButton: {
    marginTop: 0,
    marginBottom: 20,
    marginHorizontal: 16,
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
    marginHorizontal: 16,
  },
  securityText: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    marginLeft: 8,
  },
});

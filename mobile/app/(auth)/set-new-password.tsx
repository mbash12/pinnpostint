import React, { useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';

import { ThemedText } from '../../components/themed-text';
import { ThemedView } from '../../components/themed-view';
import { FloatingLabelInput } from '../../components/ui/floating-label-input';
import { GradientButton } from '../../components/ui/gradient-button';
import { DesktopAuthLayout } from '../../components/desktop-auth-layout';
import { Colors, WebShadows } from '@/constants/theme';
import { authService } from '../../services/auth.service';
import { useResponsive } from '../../hooks/use-responsive';
import { useAlert } from '../../components/ui/custom-alert';

export default function SetNewPasswordScreen() {
  const router = useRouter();
  const { resetToken } = useLocalSearchParams();
  const { isDesktop } = useResponsive();
  const { showAlert } = useAlert();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  const hasActiveErrors = Object.values(errors).some((error) => Boolean(error));

  const clearFieldError = (field: string) => {
    setErrors((prev) => {
      if (!prev[field]) {
        return prev;
      }

      const updatedErrors = { ...prev };
      delete updatedErrors[field];
      return updatedErrors;
    });
  };

  const handleResetPassword = async () => {
    const newErrors: {[key: string]: string} = {};
    
    if (!newPassword) {
      newErrors.newPassword = 'Please enter your new password';
    } else if (newPassword.length < 6) {
      newErrors.newPassword = 'Password must be at least 6 characters long';
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your new password';
    } else if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match. Please try again.';
    }

    if (!resetToken) {
      showAlert({
        title: 'Error',
        message: 'Reset token is missing. Please try the password reset process again.',
        type: 'error'
      });
      return;
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);

    try {
      // Call real API to reset password
      const response = await authService.resetPassword(
        { newPassword },
        resetToken as string
      );
      
      if (response.success) {
        showAlert({
          title: 'Password Reset Successful',
          message: 'Your password has been reset successfully. Please login with your new password.',
          type: 'success',
          buttons: [{ text: 'OK', onPress: () => router.replace('/(auth)/login' as any) }]
        });
      } else {
        throw new Error(response.message || 'Failed to reset password');
      }
    } catch (error: any) {
      if (error?.code === 'VALIDATION_ERROR' && error?.details) {
        const serverErrors: {[key: string]: string} = {};
        error.details.forEach((detail: any) => {
          serverErrors[detail.field] = detail.message;
        });
        setErrors(serverErrors);
        
        showAlert({
          title: 'Validation Error',
          message: 'Please fix the errors below and try again.',
          type: 'warning',
          buttons: [{ text: 'OK', style: 'default' }]
        });
      } else {
        showAlert({
          title: 'Error',
          message: error?.message || 'Operation failed. Please try again.',
          type: 'error'
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    router.back();
  };

  const mobileView = (
    <ThemedView style={styles.container}>
      <View style={styles.backgroundPattern} />
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header with back button */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={handleBack}
          >
            <MaterialIcons name="arrow-back" size={24} color={Colors.light.text} />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.logoContainer} onPress={() => router.push('/')}>
            <Image
              source={require('@/assets/images/logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </TouchableOpacity>
          
          <ThemedText type="title" style={styles.title}>Set New Password</ThemedText>
          <ThemedText style={styles.subtitle}>
            Create a strong password for your account
          </ThemedText>
        </View>

        {/* Form */}
        <View style={styles.formCard}>
          <FloatingLabelInput
            label="New Password"
            value={newPassword}
            onChangeText={(text) => {
              setNewPassword(text);
              clearFieldError('newPassword');
            }}
            secureTextEntry={!showNewPassword}
            error={errors.newPassword}
            leftIcon={<MaterialIcons name="lock" size={20} color={Colors.light.textSecondary} />}
            rightIcon={
              <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)}>
                <MaterialIcons
                  name={showNewPassword ? "visibility" : "visibility-off"}
                  size={20}
                  color={Colors.light.textSecondary}
                />
              </TouchableOpacity>
            }
          />

          <FloatingLabelInput
            label="Confirm Password"
            value={confirmPassword}
            onChangeText={(text) => {
              setConfirmPassword(text);
              clearFieldError('confirmPassword');
            }}
            secureTextEntry={!showConfirmPassword}
            error={errors.confirmPassword}
            leftIcon={<MaterialIcons name="lock" size={20} color={Colors.light.textSecondary} />}
            rightIcon={
              <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                <MaterialIcons
                  name={showConfirmPassword ? "visibility" : "visibility-off"}
                  size={20}
                  color={Colors.light.textSecondary}
                />
              </TouchableOpacity>
            }
          />

          <GradientButton
            title="Reset Password"
            onPress={handleResetPassword}
            loading={isLoading}
            disabled={isLoading || hasActiveErrors || !newPassword || !confirmPassword || newPassword !== confirmPassword}
            style={styles.resetButton}
          />
        </View>

        {/* Password Requirements */}
        <View style={styles.requirementsContainer}>
          <View style={styles.requirementsCard}>
            <ThemedText style={styles.requirementsTitle}>Password Requirements:</ThemedText>
            <ThemedText style={styles.requirementItem}>• At least 8 characters long</ThemedText>
            <ThemedText style={styles.requirementItem}>• Include both letters and numbers</ThemedText>
            <ThemedText style={styles.requirementItem}>• Use a mix of uppercase and lowercase</ThemedText>
          </View>
        </View>
      </ScrollView>
    </ThemedView>
  );
  
  const desktopView = (
    <DesktopAuthLayout
      title="Set New Password"
      subtitle="Create a strong password for your account"
      showBackButton={true}
      onBackPress={handleBack}
      footerContent={
        <View style={desktopStyles.requirementsContainer}>
          <View style={desktopStyles.requirementsCard}>
            <ThemedText style={desktopStyles.requirementsTitle}>Password Requirements:</ThemedText>
            <ThemedText style={desktopStyles.requirementItem}>• At least 8 characters long</ThemedText>
            <ThemedText style={desktopStyles.requirementItem}>• Include both letters and numbers</ThemedText>
            <ThemedText style={desktopStyles.requirementItem}>• Use a mix of uppercase and lowercase</ThemedText>
          </View>
        </View>
      }
    >
      <FloatingLabelInput
        label="New Password"
        value={newPassword}
        onChangeText={(text) => {
          setNewPassword(text);
          clearFieldError('newPassword');
        }}
        secureTextEntry={!showNewPassword}
        error={errors.newPassword}
        leftIcon={<MaterialIcons name="lock" size={20} color={Colors.light.textSecondary} />}
        rightIcon={
          <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)}>
            <MaterialIcons
              name={showNewPassword ? "visibility" : "visibility-off"}
              size={20}
              color={Colors.light.textSecondary}
            />
          </TouchableOpacity>
        }
      />

      <FloatingLabelInput
        label="Confirm Password"
        value={confirmPassword}
        onChangeText={(text) => {
          setConfirmPassword(text);
          clearFieldError('confirmPassword');
        }}
        secureTextEntry={!showConfirmPassword}
        error={errors.confirmPassword}
        leftIcon={<MaterialIcons name="lock" size={20} color={Colors.light.textSecondary} />}
        rightIcon={
          <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
            <MaterialIcons
              name={showConfirmPassword ? "visibility" : "visibility-off"}
              size={20}
              color={Colors.light.textSecondary}
            />
          </TouchableOpacity>
        }
      />

      <GradientButton
        title="Reset Password"
        onPress={handleResetPassword}
        loading={isLoading}
        disabled={isLoading || hasActiveErrors || !newPassword || !confirmPassword || newPassword !== confirmPassword}
      />
    </DesktopAuthLayout>
  );
  
  return isDesktop ? desktopView : mobileView;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFBFC',
  },
  backgroundPattern: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 280,
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    boxShadow: WebShadows.subtle,
    elevation: 1,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingTop: 80,
    paddingBottom: 20,
    paddingHorizontal: 24,
    position: 'relative',
  },
  backButton: {
    position: 'absolute',
    left: 16,
    top: 76,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
    justifyContent: 'center',
    alignItems: 'center',
    boxShadow: WebShadows.subtle,
    elevation: 1,
  },
  logoContainer: {
    width: 72,
    height: 72,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    boxShadow: WebShadows.subtle,
    elevation: 2,
  },
  logo: {
    width: 48,
    height: 48,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 6,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 20,
    fontWeight: '400',
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    borderRadius: 16,
    boxShadow: WebShadows.medium,
    elevation: 2,
    padding: 24,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#F0F2F5',
  },
  resetButton: {
    marginBottom: 16,
  },
  requirementsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  requirementsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    boxShadow: WebShadows.subtle,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#F0F2F5',
  },
  requirementsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 8,
  },
  requirementItem: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    marginBottom: 4,
    lineHeight: 16,
  },
});

const desktopStyles = StyleSheet.create({
  requirementsContainer: {
    width: '100%',
  },
  requirementsCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    boxShadow: WebShadows.subtle,
  },
  requirementsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 8,
  },
  requirementItem: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    marginBottom: 4,
    lineHeight: 16,
  },
});

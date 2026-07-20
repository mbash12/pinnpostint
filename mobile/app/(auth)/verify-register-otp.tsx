import React, { useState, useEffect } from 'react';
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
import { formatPhoneNumber } from '@/config/environment';
import { useResponsive } from '../../hooks/use-responsive';
import { useAlert } from '../../components/ui/custom-alert';
import { storage } from '../../utils/storage';

export default function VerifyRegisterOtpScreen() {
  const router = useRouter();
  const { isDesktop } = useResponsive();
  const { showAlert } = useAlert();
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [errors, setErrors] = useState<{[key: string]: string}>({});

  useEffect(() => {
    // Load phone number from storage
    const loadPhoneNumber = async () => {
      const storedPhone = await storage.getPhoneNumber();
      if (storedPhone) {
        setPhoneNumber(storedPhone);
        startResendTimer();
      } else {
        // No phone number found, redirect back to register
        showAlert({
          title: 'Error',
          message: 'No phone number found. Please start the registration process again.',
          type: 'error'
        });
        router.push('/(auth)/register' as any);
      }
    };

    loadPhoneNumber();
  }, []);

  const handleVerifyOtp = async () => {
    const newErrors: {[key: string]: string} = {};
    
    if (!otp) {
      newErrors.otp = 'Please enter the OTP';
    } else if (otp.length !== 6) {
      newErrors.otp = 'Please enter a 6-digit OTP';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);

    try {
      // Format phone number with country code using environment config
      const formattedPhone = formatPhoneNumber(phoneNumber as string);

      // Call real API to verify OTP
      const response = await authService.verifyRegistrationOtp({
        phone: formattedPhone,
        otp
      });
      
      if (response.success && response.data?.tempToken) {
        // Store temp token in local storage
        await storage.setTempToken(response.data.tempToken);
        
        showAlert({
          title: 'Phone Verified',
          message: 'Your phone number has been verified successfully!',
          type: 'success',
          duration: 2000
        });
        setTimeout(() => {
          router.push('/(auth)/complete-profile' as any);
        }, 2000);
      } else if (response.error) {
        // Handle API error responses with success: false
        throw new Error(response.error.message || 'Verification failed');
      } else {
        throw new Error(response.message || 'Verification failed');
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

  const startResendTimer = () => {
    setResendTimer(60);
    const timer = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleResendOtp = async () => {
    if (resendTimer === 0) {
      setIsLoading(true);
      try {
        // Call real API to resend OTP
        const response = await authService.register({ phone: formatPhoneNumber(phoneNumber as string) });
        
        if (response.success) {
          startResendTimer();
          showAlert({
            title: 'OTP Resent',
            message: `A new verification code has been sent to ${phoneNumber}`,
            type: 'success',
            duration: 3000
          });
        } else {
          throw new Error(response.message || 'Failed to resend OTP');
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
    }
  };

  const handleBack = async () => {
    // Clear stored phone number when going back
    await storage.clearPhoneNumber();
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
          
          <ThemedText type="title" style={styles.title}>Verify OTP</ThemedText>
          <ThemedText style={styles.subtitle}>
            Enter the 6-digit code sent to {phoneNumber}
          </ThemedText>
        </View>

        {/* Form */}
        <View style={styles.formCard}>
          <FloatingLabelInput
            label="Enter OTP"
            value={otp}
            onChangeText={(text) => {
              const numericValue = text.replace(/[^0-9]/g, '');
              setOtp(numericValue);
              if (errors.otp) setErrors({...errors, otp: ''});
            }}
            keyboardType="numeric"
            maxLength={6}
            error={errors.otp}
            leftIcon={<MaterialIcons name="verified-user" size={20} color={Colors.light.textSecondary} />}
          />

          {/* OTP Info */}
          <View style={styles.otpInfo}>
            <ThemedText style={styles.otpInfoText}>
              Didn&apos;t receive the code?
            </ThemedText>
            <TouchableOpacity 
              style={styles.resendButton}
              onPress={handleResendOtp}
              disabled={resendTimer > 0}
            >
              <ThemedText style={[
                styles.resendText,
                resendTimer > 0 && styles.resendTextDisabled
              ]}>
                {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend OTP'}
              </ThemedText>
            </TouchableOpacity>
          </View>

          <GradientButton
            title="Verify & Create Account"
            onPress={handleVerifyOtp}
            loading={isLoading}
            disabled={isLoading || Object.keys(errors).length > 0 || !otp || otp.length !== 6}
            style={styles.verifyButton}
          />

          <TouchableOpacity 
            style={styles.editButton} 
            onPress={handleBack}
          >
            <ThemedText style={styles.editButtonText}>Change Phone Number</ThemedText>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ThemedView>
  );
  
  const desktopView = (
    <DesktopAuthLayout
      title="Verify OTP"
      subtitle={`Enter the 6-digit code sent to ${phoneNumber}`}
      showBackButton={true}
      onBackPress={handleBack}
      footerContent={
        <TouchableOpacity 
          style={desktopStyles.editButton} 
          onPress={handleBack}
        >
          <ThemedText style={desktopStyles.editButtonText}>Change Phone Number</ThemedText>
        </TouchableOpacity>
      }
    >
      <FloatingLabelInput
        label="Enter OTP"
        value={otp}
        onChangeText={(text) => {
          const numericValue = text.replace(/[^0-9]/g, '');
          setOtp(numericValue);
          if (errors.otp) setErrors({...errors, otp: ''});
        }}
        keyboardType="numeric"
        maxLength={6}
        error={errors.otp}
        leftIcon={<MaterialIcons name="verified-user" size={20} color={Colors.light.textSecondary} />}
      />

      {/* OTP Info */}
      <View style={desktopStyles.otpInfo}>
        <ThemedText style={desktopStyles.otpInfoText}>
          Didn&apos;t receive the code?
        </ThemedText>
        <TouchableOpacity 
          style={desktopStyles.resendButton}
          onPress={handleResendOtp}
          disabled={resendTimer > 0}
        >
          <ThemedText style={[
            desktopStyles.resendText,
            resendTimer > 0 && desktopStyles.resendTextDisabled
          ]}>
            {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend OTP'}
          </ThemedText>
        </TouchableOpacity>
      </View>

      <GradientButton
        title="Verify & Create Account"
        onPress={handleVerifyOtp}
        loading={isLoading}
        disabled={isLoading || Object.keys(errors).length > 0 || !otp || otp.length !== 6}
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
  userInfo: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 20,
  },
  userName: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.light.primary,
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
  otpInfo: {
    alignItems: 'center',
    marginVertical: 12,
  },
  otpInfoText: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    marginBottom: 6,
  },
  resendButton: {
    paddingVertical: 4,
  },
  resendText: {
    fontSize: 13,
    color: Colors.light.primary,
    fontWeight: '600',
  },
  resendTextDisabled: {
    color: Colors.light.textSecondary,
  },
  verifyButton: {
    marginBottom: 12,
  },
  editButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  editButtonText: {
    fontSize: 13,
    color: Colors.light.primary,
    fontWeight: '600',
  },
});

const desktopStyles = StyleSheet.create({
  otpInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  otpInfoText: {
    fontSize: 14,
    color: Colors.light.text,
  },
  resendButton: {
    padding: 8,
  },
  resendText: {
    fontSize: 14,
    color: Colors.light.primary,
    fontWeight: '600',
  },
  resendTextDisabled: {
    color: Colors.light.textSecondary,
  },
  editButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  editButtonText: {
    fontSize: 14,
    color: Colors.light.primary,
    fontWeight: '600',
  },
});
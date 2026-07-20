import React, { useState } from 'react';
import { Image, ScrollView, StyleSheet, TouchableOpacity, View, Platform, Dimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { ThemedText } from '../../components/themed-text';
import { ThemedView } from '../../components/themed-view';
import { FloatingLabelInput } from '../../components/ui/floating-label-input';
import { GradientButton } from '../../components/ui/gradient-button';
import { DesktopAuthLayout } from '../../components/desktop-auth-layout';
import { TermsModal } from '../../components/ui/terms-modal';
import { Colors, WebShadows } from '@/constants/theme';
import { authService } from '../../services/auth.service';
import { formatPhoneNumber } from '@/config/environment';
import { useAlert } from '../../components/ui/custom-alert';
import { storage } from '../../utils/storage';

export default function RegisterScreen() {
  const router = useRouter();
  const { showAlert } = useAlert();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  
  const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);
  
  React.useEffect(() => {
    const onChange = (result: any) => {
      setScreenWidth(result.window.width);
    };
    
    const dimensionsHandler = Platform.OS === 'web' 
      ? Dimensions.addEventListener('change', onChange)
      : null;
      
    return () => {
      if (dimensionsHandler) {
        dimensionsHandler.remove();
      }
    };
  }, []);

  React.useEffect(() => {
    // Clear error when phone number changes
    setErrors((prevErrors) => {
      if (prevErrors.phoneNumber) {
        return { ...prevErrors, phoneNumber: '' };
      }
      return prevErrors;
    });
  }, [phoneNumber]);
  
  const isDesktop = Platform.OS === 'web' && screenWidth >= 1024;

  const handleSendOtp = async () => {
    const newErrors: {[key: string]: string} = {};
    
    if (!phoneNumber.trim()) {
      newErrors.phoneNumber = 'Phone number is required';
    } else if (phoneNumber.length < 8) {
      newErrors.phoneNumber = 'Please enter a valid phone number with country code (e.g., +1 9876543210)';
    }
    
    if (!agreeToTerms) {
      newErrors.terms = 'Please agree to terms and conditions';
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);

    try {
      // Format phone number with country code using environment config
      const formattedPhone = formatPhoneNumber(phoneNumber);

      // Call real API to send OTP
      const response = await authService.register({ phone: formattedPhone });

      if (response.success && response.data) {
        // Store phone number in local storage
        await storage.setPhoneNumber(phoneNumber);
        
        showAlert({
          title: 'OTP Sent',
          message: `A verification code has been sent to ${phoneNumber}`,
          type: 'success',
          duration: 3000
        });
        router.push('/(auth)/verify-register-otp' as any);
      } else if (response.error) {
        // Handle API error responses with success: false
        const errorMessage = response.error.message || 'Failed to send OTP';
        showAlert({
          title: 'Error',
          message: errorMessage,
          type: 'error'
        });
      } else {
        const errorMessage = response.message || 'Failed to send OTP';
        showAlert({
          title: 'Error',
          message: errorMessage,
          type: 'error'
        });
      }
    } catch (error: any) {
      // Handle server validation errors
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
          title: 'Registration Failed',
          message: error?.message || 'Failed to send OTP. Please try again.',
          type: 'error'
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const mobileView = (
    <ThemedView style={styles.container}>
      <View style={styles.backgroundPattern} />
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Logo and Welcome */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.logoContainer} onPress={() => router.push('/')}>
            <Image
              source={require('@/assets/images/logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </TouchableOpacity>
          <ThemedText type="title" style={styles.title}>Create Account</ThemedText>
          <ThemedText style={styles.subtitle}>
            Join Pin N Post with your phone number
          </ThemedText>
        </View>

        {/* Form */}
        <View style={styles.formCard}>
          <FloatingLabelInput
            label="Phone Number"
            value={phoneNumber}
            onChangeText={(text) => {
              // Only allow numeric characters (no + sign)
              const numericValue = text.replace(/[^0-9]/g, '');
              setPhoneNumber(numericValue);
              if (errors.phoneNumber) setErrors({...errors, phoneNumber: ''});
            }}
            keyboardType="phone-pad"
            maxLength={10}
            error={errors.phoneNumber}
            leftIcon={<MaterialIcons name="phone" size={20} color={Colors.light.textSecondary} />}
          />

          {/* Terms and Conditions */}
          <TouchableOpacity
            style={styles.termsContainer}
            onPress={() => setAgreeToTerms(!agreeToTerms)}
          >
            <View style={[styles.checkbox, agreeToTerms && styles.checkboxChecked]}>
              {agreeToTerms && <MaterialIcons name="check" size={16} color="#FFFFFF" />}
            </View>
            <View style={styles.termsText}>
              <ThemedText style={styles.termsLabel}>
                I agree to the{' '}
                <ThemedText
                  style={styles.termsLink}
                  onPress={() => setShowTermsModal(true)}
                >
                  Terms and Conditions
                </ThemedText>
                {' '}and{' '}
                <ThemedText
                  style={styles.termsLink}
                  onPress={() => setShowPrivacyModal(true)}
                >
                  Privacy Policy
                </ThemedText>
              </ThemedText>
            </View>
          </TouchableOpacity>

          <GradientButton
            title="Send OTP"
            onPress={handleSendOtp}
            loading={isLoading}
            disabled={isLoading || !phoneNumber.trim() || phoneNumber.length !== 10 || !agreeToTerms || Object.keys(errors).length > 0}
            style={styles.sendButton}
          />
        </View>

        {/* Sign In Link */}
        <View style={styles.footer}>
          <View style={styles.footerCard}>
            <ThemedText style={styles.footerText}>Already have an account? </ThemedText>
            <TouchableOpacity onPress={() => router.push('/(auth)/login')} style={styles.signInButton}>
              <ThemedText style={styles.signInLink}>Sign In</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Modals for Terms and Privacy */}
      <TermsModal
        visible={showTermsModal}
        onClose={() => setShowTermsModal(false)}
        type="terms"
      />
      <TermsModal
        visible={showPrivacyModal}
        onClose={() => setShowPrivacyModal(false)}
        type="privacy"
      />
    </ThemedView>
  );
  
  const desktopView = (
    <DesktopAuthLayout
      title="Create Account"
      subtitle="Join Pin N Post with your phone number"
      footerContent={
        <View style={desktopStyles.footer}>
          <View style={desktopStyles.footerCard}>
            <ThemedText style={desktopStyles.footerText}>Already have an account? </ThemedText>
            <TouchableOpacity onPress={() => router.push('/(auth)/login')} style={desktopStyles.signInButton}>
              <ThemedText style={desktopStyles.signInLink}>Sign In</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      }
    >
      <FloatingLabelInput
        label="Phone Number"
        value={phoneNumber}
        onChangeText={(text) => {
          // Only allow numeric characters (no + sign)
          const numericValue = text.replace(/[^0-9]/g, '');
          setPhoneNumber(numericValue);
        }}
        keyboardType="phone-pad"
        maxLength={10}
        leftIcon={<MaterialIcons name="phone" size={20} color={Colors.light.textSecondary} />}
      />

      {/* Terms and Conditions */}
      <TouchableOpacity
        style={desktopStyles.termsContainer}
        onPress={() => setAgreeToTerms(!agreeToTerms)}
      >
        <View style={[desktopStyles.checkbox, agreeToTerms && desktopStyles.checkboxChecked]}>
          {agreeToTerms && <MaterialIcons name="check" size={16} color="#FFFFFF" />}
        </View>
        <View style={desktopStyles.termsText}>
          <ThemedText style={desktopStyles.termsLabel}>
            I agree to the{' '}
            <TouchableOpacity onPress={() => setShowTermsModal(true)}>
              <ThemedText style={desktopStyles.termsLink}>Terms and Conditions</ThemedText>
            </TouchableOpacity>
            {' '}and{' '}
            <TouchableOpacity onPress={() => setShowPrivacyModal(true)}>
              <ThemedText style={desktopStyles.termsLink}>Privacy Policy</ThemedText>
            </TouchableOpacity>
          </ThemedText>
        </View>
      </TouchableOpacity>

      <GradientButton
        title="Send OTP"
        onPress={handleSendOtp}
        loading={isLoading}
        disabled={isLoading || !phoneNumber || phoneNumber.length !== 10 || !agreeToTerms || Object.keys(errors).length > 0}
      />

      {/* Modals for Terms and Privacy */}
      <TermsModal
        visible={showTermsModal}
        onClose={() => setShowTermsModal(false)}
        type="terms"
      />
      <TermsModal
        visible={showPrivacyModal}
        onClose={() => setShowPrivacyModal(false)}
        type="privacy"
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
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF2F0',
    borderColor: '#FFCCC7',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
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
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
    paddingHorizontal: 2,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderWidth: 1.5,
    borderColor: Colors.light.textSecondary,
    borderRadius: 4,
    marginRight: 10,
    marginTop: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
  },
  termsText: {
    flex: 1,
  },
  termsLabel: {
    fontSize: 12,
    color: Colors.light.text,
    lineHeight: 18,
  },
  termsLink: {
    color: Colors.light.primary,
    fontWeight: '500',
    fontSize: 12,
  },
  sendButton: {
    marginBottom: 16,
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  footerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    boxShadow: WebShadows.subtle,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#F0F2F5',
  },
  footerText: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    fontWeight: '400',
  },
  signInButton: {
    marginLeft: 4,
  },
  signInLink: {
    fontSize: 13,
    color: Colors.light.primary,
    fontWeight: '600',
  },
});

const desktopStyles = StyleSheet.create({
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
    paddingHorizontal: 2,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderWidth: 1.5,
    borderColor: Colors.light.textSecondary,
    borderRadius: 4,
    marginRight: 10,
    marginTop: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
  },
  termsText: {
    flex: 1,
  },
  termsLabel: {
    fontSize: 13,
    color: Colors.light.text,
    lineHeight: 18,
  },
  termsLink: {
    color: Colors.light.primary,
    fontWeight: '500',
    fontSize: 13,
  },
  footer: {
    width: '100%',
  },
  footerCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  footerText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    fontWeight: '400',
  },
  signInButton: {
    marginLeft: 4,
  },
  signInLink: {
    fontSize: 14,
    color: Colors.light.primary,
    fontWeight: '600',
  },
});

import React, { useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, TouchableOpacity, View, Platform, Dimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { ThemedText } from '../../components/themed-text';
import { ThemedView } from '../../components/themed-view';
import { FloatingLabelInput } from '../../components/ui/floating-label-input';
import { GradientButton } from '../../components/ui/gradient-button';
import { DesktopAuthLayout } from '../../components/desktop-auth-layout';
import { Colors, WebShadows } from '@/constants/theme';
import { authService } from '../../services/auth.service';
import { formatPhoneNumber } from '@/config/environment';
import { useAlert } from '../../components/ui/custom-alert';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { showAlert } = useAlert();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  
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
  
  const isDesktop = Platform.OS === 'web' && screenWidth >= 1024;

  const handleSendOtp = async () => {
    const newErrors: {[key: string]: string} = {};
    
    if (!phoneNumber.trim()) {
      newErrors.phoneNumber = 'Phone number is required';
    } else if (phoneNumber.length < 8) {
      newErrors.phoneNumber = 'Please enter a valid phone number with country code (e.g., +1 9876543210)';
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);

    try {
      // Format phone number with country code using environment config
      const formattedPhone = formatPhoneNumber(phoneNumber);

      // Call real API to send password reset OTP
      const response = await authService.forgotPassword({ phone: formattedPhone });
      
      if (response.success && response.data) {
        showAlert({
          title: 'OTP Sent',
          message: `A verification code has been sent to ${phoneNumber}`,
          type: 'success',
          duration: 3000
        });
        router.push(('/(auth)/verify-otp?phoneNumber=' + encodeURIComponent(phoneNumber)) as any);
      } else if (response.error) {
        // Handle API error responses with success: false
        throw new Error(response.error.message || 'Failed to send OTP');
      } else {
        throw new Error(response.message || 'Failed to send OTP');
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
          title: 'Request Failed',
          message: error?.message || 'Failed to send OTP. Please try again.',
          type: 'error'
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToLogin = () => {
    router.push('/(auth)/login');
  };

  const mobileView = (
    <ThemedView style={styles.container}>
      <View style={styles.backgroundPattern} />
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header with back button */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={handleBackToLogin}
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
          
          <ThemedText type="title" style={styles.title}>Forgot Password</ThemedText>
          <ThemedText style={styles.subtitle}>
            Enter your phone number to receive a verification code
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

          <GradientButton
            title="Send OTP"
            onPress={handleSendOtp}
            loading={isLoading}
            disabled={isLoading || !phoneNumber || phoneNumber.length !== 10}
            style={styles.sendButton}
          />
        </View>

        {/* Back to Login Link */}
        <View style={styles.footer}>
          <View style={styles.footerCard}>
            <ThemedText style={styles.footerText}>Remember your password? </ThemedText>
            <TouchableOpacity onPress={handleBackToLogin} style={styles.loginButton}>
              <ThemedText style={styles.loginLink}>Back to Login</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </ThemedView>
  );
  
  const desktopView = (
    <DesktopAuthLayout
      title="Forgot Password"
      subtitle="Enter your phone number to receive a verification code"
      showBackButton={true}
      onBackPress={handleBackToLogin}
      footerContent={
        <View style={desktopStyles.footer}>
          <View style={desktopStyles.footerCard}>
            <ThemedText style={desktopStyles.footerText}>Remember your password? </ThemedText>
            <TouchableOpacity onPress={handleBackToLogin} style={desktopStyles.loginButton}>
              <ThemedText style={desktopStyles.loginLink}>Back to Login</ThemedText>
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

      <GradientButton
        title="Send OTP"
        onPress={handleSendOtp}
        loading={isLoading}
        disabled={isLoading || !phoneNumber || phoneNumber.length !== 10}
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
  loginButton: {
    marginLeft: 4,
  },
  loginLink: {
    fontSize: 13,
    color: Colors.light.primary,
    fontWeight: '600',
  },
});

const desktopStyles = StyleSheet.create({
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
  loginButton: {
    marginLeft: 4,
  },
  loginLink: {
    fontSize: 14,
    color: Colors.light.primary,
    fontWeight: '600',
  },
});
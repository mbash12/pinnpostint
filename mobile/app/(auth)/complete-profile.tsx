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
import { useAuth } from '../../contexts/auth-context';
import { useResponsive } from '../../hooks/use-responsive';
import { useAlert } from '../../components/ui/custom-alert';
import { validateForm, validateField, profileValidationSchema } from '../../utils/validation';
import { storage } from '../../utils/storage';

export default function CompleteProfileScreen() {
  const router = useRouter();
  const { completeRegistration } = useAuth();
  const { isDesktop } = useResponsive();
  const { showAlert } = useAlert();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [tempToken, setTempToken] = useState<string>('');

  React.useEffect(() => {
    const loadRegistrationData = async () => {
      const storedPhone = await storage.getPhoneNumber();
      const storedToken = await storage.getTempToken();
      
      if (storedPhone && storedToken) {
        setPhoneNumber(storedPhone);
        setTempToken(storedToken);
      } else {
        showAlert({
          title: 'Error',
          message: 'Registration data not found. Please start the registration process again.',
          type: 'error'
        });
        router.push('/(auth)/register' as any);
      }
    };

    loadRegistrationData();
  }, []);

  const handleInputChange = (field: string, value: string) => {
    // Update state
    switch (field) {
      case 'firstName':
        setFirstName(value);
        break;
      case 'lastName':
        setLastName(value);
        break;
      case 'email':
        setEmail(value);
        break;
      case 'password':
        setPassword(value);
        break;
      case 'confirmPassword':
        setConfirmPassword(value);
        break;
    }

    // Real-time validation
    const error = validateField(value, profileValidationSchema[field]);
    setErrors(prev => ({
      ...prev,
      [field]: error || ''
    }));
  };

  const handleCompleteProfile = async () => {
    // Validate form using schema
    const formData = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      password,
      confirmPassword
    };

    const validationErrors = validateForm(formData, {
      firstName: profileValidationSchema.firstName,
      lastName: profileValidationSchema.lastName,
      email: profileValidationSchema.email,
    });

    // Custom password validation
    if (!password) {
      validationErrors.password = 'Password is required';
    } else if (password.length < 6) {
      validationErrors.password = 'Password must be at least 6 characters long';
    }

    if (password !== confirmPassword) {
      validationErrors.confirmPassword = 'Passwords do not match';
    }

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      showAlert({
        title: 'Validation Error',
        message: 'Please fix the errors below and try again.',
        type: 'warning'
      });
      return;
    }

    setIsLoading(true);

    try {
      // Call real API to complete registration
      await completeRegistration({
        firstName,
        lastName,
        password,
        email
      }, tempToken);
      
      // Clear registration data from storage
      await storage.clearRegistrationData();
      
      showAlert({
        title: 'Registration Complete!',
        message: 'Your account has been created successfully.',
        type: 'success',
        duration: 2000
      });
      
      setTimeout(() => {
        router.replace('/(tabs)' as any);
      }, 2000);
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
          title: 'Error',
          message: error?.message || 'Failed to complete registration. Please try again.',
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
          
          <ThemedText type="title" style={styles.title}>Complete Profile</ThemedText>
          <ThemedText style={styles.subtitle}>
            Add your information to complete registration
          </ThemedText>
        </View>

        {/* Form */}
        <View style={styles.formCard}>
          <FloatingLabelInput
            label="First Name"
            value={firstName}
            maxLength={50}
            onChangeText={(text) => handleInputChange('firstName', text)}
            error={errors.firstName}
            leftIcon={<MaterialIcons name="person" size={20} color={Colors.light.textSecondary} />}
          />

          <FloatingLabelInput
            label="Last Name"
            value={lastName}
            maxLength={50}
            onChangeText={(text) => handleInputChange('lastName', text)}
            error={errors.lastName}
            leftIcon={<MaterialIcons name="person" size={20} color={Colors.light.textSecondary} />}
          />

          <FloatingLabelInput
            label="Email Address"
            value={email}
            maxLength={254}
            onChangeText={(text) => handleInputChange('email', text)}
            keyboardType="email-address"
            autoCapitalize="none"
            error={errors.email}
            leftIcon={<MaterialIcons name="email" size={20} color={Colors.light.textSecondary} />}
          />

          <FloatingLabelInput
            label="Password"
            value={password}
            maxLength={128}
            onChangeText={(text) => handleInputChange('password', text)}
            secureTextEntry={!showPassword}
            error={errors.password}
            leftIcon={<MaterialIcons name="lock" size={20} color={Colors.light.textSecondary} />}
            rightIcon={
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <MaterialIcons
                  name={showPassword ? "visibility" : "visibility-off"}
                  size={20}
                  color={Colors.light.textSecondary}
                />
              </TouchableOpacity>
            }
          />

          <FloatingLabelInput
            label="Confirm Password"
            value={confirmPassword}
            maxLength={128}
            onChangeText={(text) => handleInputChange('confirmPassword', text)}
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
            title="Complete Registration"
            onPress={handleCompleteProfile}
            loading={isLoading}
            disabled={isLoading || !firstName || !lastName || !email || !password || !confirmPassword || password !== confirmPassword}
            style={styles.completeButton}
          />
        </View>
      </ScrollView>
    </ThemedView>
  );
  
  const desktopView = (
    <DesktopAuthLayout
      title="Complete Profile"
      subtitle="Add your information to complete registration"
      showBackButton={true}
      onBackPress={handleBack}
    >
      <FloatingLabelInput
        label="First Name"
        value={firstName}
        maxLength={50}
        onChangeText={(text) => handleInputChange('firstName', text)}
        error={errors.firstName}
        leftIcon={<MaterialIcons name="person" size={20} color={Colors.light.textSecondary} />}
      />
      <FloatingLabelInput
        label="Last Name"
        value={lastName}
        maxLength={50}
        onChangeText={(text) => handleInputChange('lastName', text)}
        error={errors.lastName}
        leftIcon={<MaterialIcons name="person" size={20} color={Colors.light.textSecondary} />}
      />

      <FloatingLabelInput
        label="Email Address"
        value={email}
        maxLength={254}
        onChangeText={(text) => handleInputChange('email', text)}
        keyboardType="email-address"
        autoCapitalize="none"
        error={errors.email}
        leftIcon={<MaterialIcons name="email" size={20} color={Colors.light.textSecondary} />}
      />

      <FloatingLabelInput
        label="Password"
        value={password}
        maxLength={128}
        onChangeText={(text) => handleInputChange('password', text)}
        secureTextEntry={!showPassword}
        error={errors.password}
        leftIcon={<MaterialIcons name="lock" size={20} color={Colors.light.textSecondary} />}
        rightIcon={
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
            <MaterialIcons
              name={showPassword ? "visibility" : "visibility-off"}
              size={20}
              color={Colors.light.textSecondary}
            />
          </TouchableOpacity>
        }
      />

      <FloatingLabelInput
        label="Confirm Password"
        value={confirmPassword}
        maxLength={128}
        onChangeText={(text) => handleInputChange('confirmPassword', text)}
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
        title="Complete Registration"
        onPress={handleCompleteProfile}
        loading={isLoading}
        disabled={isLoading || !firstName || !lastName || !email || !password || !confirmPassword || password !== confirmPassword}
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
  userInfoCard: {
    display: 'none',
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
  completeButton: {
    marginTop: 8,
  },
  helperRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: -8,
    marginBottom: 8,
  },
  characterCounter: {
    fontSize: 11,
    color: '#666666',
    marginLeft: 8,
  },
});

const desktopStyles = StyleSheet.create({
});

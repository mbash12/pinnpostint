import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { FloatingLabelInput } from '@/components/ui/floating-label-input';
import { GradientButton } from '@/components/ui/gradient-button';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useAlert } from '@/components/ui/custom-alert';
import { formatPhoneNumber } from '@/config/environment';

interface LoginFormProps {
  onSuccess?: () => void;
  showFooter?: boolean;
}

export function LoginForm({ onSuccess, showFooter = true }: LoginFormProps) {
  const router = useRouter();
  const { login, setLoginModalVisible } = useAuth();
  const { showAlert } = useAlert();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{[key: string]: string}>({});

  const handleLogin = async () => {
    const newErrors: {[key: string]: string} = {};

    if (!phoneNumber.trim()) {
      newErrors.phoneNumber = 'Phone number is required';
    } else if (phoneNumber.length !== 10) {
      newErrors.phoneNumber = 'Please enter a valid 10-digit phone number';
    }
    
    if (!password.trim()) {
      newErrors.password = 'Password is required';
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);

    try {
      const formattedPhone = formatPhoneNumber(phoneNumber);
      await login({ phone: formattedPhone, password });
      
      if (onSuccess) {
        onSuccess();
      } else {
        router.replace('/(tabs)' as any);
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
          title: 'Login Failed',
          message: error?.message || 'Invalid phone number or password. Please try again.',
          type: 'error'
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <FloatingLabelInput
        label="Phone Number"
        value={phoneNumber}
        onChangeText={(text) => {
          const numericValue = text.replace(/[^0-9]/g, '');
          setPhoneNumber(numericValue);
          if (errors.phoneNumber) setErrors({...errors, phoneNumber: ''});
        }}
        keyboardType="phone-pad"
        maxLength={10}
        error={errors.phoneNumber}
        leftIcon={<MaterialIcons name="phone" size={20} color={Colors.light.textSecondary} />}
      />
      
      <FloatingLabelInput
        label="Password"
        value={password}
        onChangeText={(text) => {
          setPassword(text);
          if (errors.password) setErrors({...errors, password: ''});
        }}
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

      <GradientButton
        title="Sign In"
        onPress={handleLogin}
        loading={isLoading}
        disabled={isLoading || !phoneNumber || phoneNumber.length < 10 || !password}
      />

      {showFooter && (
        <View style={styles.footer}>
          <View style={styles.footerRow}>
            <ThemedText style={styles.footerText}>Don't have an account? </ThemedText>
            <TouchableOpacity onPress={() => {
              setLoginModalVisible(false);
              router.push('/(auth)/register');
            }}>
              <ThemedText style={styles.linkText}>Create Account</ThemedText>
            </TouchableOpacity>
          </View>
          <TouchableOpacity 
            onPress={() => {
              setLoginModalVisible(false);
              router.push('/(auth)/forgot-password');
            }}
            style={styles.forgotPassword}
          >
            <ThemedText style={styles.linkText}>Forgot Password?</ThemedText>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: 20,
  },
  footer: {
    marginTop: 10,
    gap: 12,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  linkText: {
    fontSize: 14,
    color: Colors.light.primary,
    fontWeight: '600',
  },
  forgotPassword: {
    alignItems: 'center',
  }
});

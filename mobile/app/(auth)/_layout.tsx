import { Stack } from 'expo-router';
import { StyleSheet } from 'react-native';


import { SafeAreaView } from 'react-native-safe-area-context';

export default function AuthLayout() {
  return (
    <SafeAreaView style={styles.container}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: styles.content,
        }}>
        <Stack.Screen name="login" options={{ title: 'Login' }} />
        <Stack.Screen name="register" options={{ title: 'Register' }} />
        <Stack.Screen name="forgot-password" options={{ title: 'Forgot Password' }} />
        <Stack.Screen name="verify-otp" options={{ title: 'Verify OTP' }} />
        <Stack.Screen name="verify-register-otp" options={{ title: 'Verify Registration OTP' }} />
        <Stack.Screen name="complete-profile" options={{ title: 'Complete Profile' }} />
        <Stack.Screen name="set-new-password" options={{ title: 'Set New Password' }} />
      </Stack>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFBFC',
  },
  content: {
    flex: 1,
  },
});
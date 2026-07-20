import { useLocalSearchParams, router } from 'expo-router';
import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { GradientButton } from '@/components/ui/gradient-button';

import { AuthProtection } from '@/components/auth-protection';
import { Colors } from '@/constants/theme';
import { HEADER_HEIGHT } from '@/constants/layout';

export default function PaymentSuccessPage() {
  const { adId } = useLocalSearchParams<{ 
    adId: string;
  }>();

  useEffect(() => {
    // Auto redirect after 3 seconds
    const timer = setTimeout(() => {
      router.replace('/(tabs)/my-ads?tab=ads');
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  const handleViewMyAds = () => {
    router.replace('/(tabs)/my-ads?tab=ads');
  };

  return (
    <AuthProtection>
      <View style={styles.container}>
        <View style={styles.content}>
          <View style={styles.successIconContainer}>
            <ThemedText style={styles.successIcon}>✓</ThemedText>
          </View>

          <ThemedText style={styles.title}>Ad Posted Successfully!</ThemedText>
          <ThemedText style={styles.subtitle}>
            Your ad has been posted successfully and is now on review.
          </ThemedText>

          <View style={styles.detailsContainer}>
            <ThemedText style={styles.detailText}>Ad ID: {adId}</ThemedText>
          </View>

          <GradientButton
            title="View My Ads"
            onPress={handleViewMyAds}
            style={styles.button}
          />

          <ThemedText style={styles.redirectText}>
            Redirecting to My Ads in 3 seconds...
          </ThemedText>
        </View>
      </View>
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
    paddingHorizontal: 20,
    paddingTop: HEADER_HEIGHT,
    paddingBottom: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  successIcon: {
    fontSize: 40,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333333',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  detailsContainer: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 20,
    marginBottom: 32,
    width: '100%',
    maxWidth: 400,
  },
  detailText: {
    fontSize: 14,
    color: '#333333',
    marginBottom: 8,
    textAlign: 'center',
  },
  button: {
    width: '100%',
    maxWidth: 400,
    marginBottom: 16,
  },
  redirectText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
});

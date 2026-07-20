import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { settingsService } from '@/services/settings.service';

interface SubscriptionSettings {
  subscriptionPrice: number;
  subscriptionDuration: number;
  reminderExpirationDays: number;
  subscriptionCurrency: string;
}

interface SubscriptionInfoProps {
  style?: any;
}

export const SubscriptionInfo: React.FC<SubscriptionInfoProps> = ({ style }) => {
  const [settings, setSettings] = useState<SubscriptionSettings>({
    subscriptionPrice: 99,
    subscriptionDuration: 7,
    reminderExpirationDays: 3,
    subscriptionCurrency: 'INR'
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSubscriptionSettings();
  }, []);

  const loadSubscriptionSettings = async () => {
    try {
      const settings = await settingsService.getSubscriptionSettings();
      setSettings(settings);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return `₹${amount}`;
  };

  const getExpiryInfo = () => {
    return `${settings.subscriptionDuration} days after approval`;
  };

  const getReminderInfo = () => {
    return `${settings.reminderExpirationDays} days before expiry`;
  };

  if (loading) {
    return (
      <ThemedView style={[styles.container, style]}>
        <ThemedText style={styles.loadingText}>Loading subscription details...</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, style]}>
      <View style={styles.header}>
        <MaterialIcons name="payment" size={24} color={Colors.primary} />
        <ThemedText style={styles.title}>Subscription Details</ThemedText>
      </View>

      <View style={styles.content}>
        <View style={styles.infoRow}>
          <View style={styles.iconContainer}>
            <MaterialIcons name="attach-money" size={20} color="#FFFFFF" />
          </View>
          <View style={styles.infoContent}>
            <ThemedText style={styles.label}>Subscription Fee</ThemedText>
            <ThemedText style={styles.value}>{formatCurrency(settings.subscriptionPrice)}</ThemedText>
          </View>
        </View>

        <View style={styles.noteContainer}>
          <MaterialIcons name="info" size={16} color={Colors.textSecondary} />
          <ThemedText style={styles.note}>
            After payment, your ad will be reviewed by our team before going live. Once approved, it will be active for {settings.subscriptionDuration} days. You'll receive a notification {settings.reminderExpirationDays} days before expiry to renew your subscription.
          </ThemedText>
        </View>
      </View>
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
    color: Colors.text,
  },
  content: {
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoContent: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  value: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.text,
  },
  noteContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F0F8FF',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E3F2FD',
  },
  note: {
    fontSize: 12,
    color: Colors.text,
    marginLeft: 8,
    flex: 1,
    lineHeight: 16,
  },
  loadingText: {
    textAlign: 'center',
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
});

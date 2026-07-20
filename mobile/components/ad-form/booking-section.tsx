import { MaterialIcons } from '@expo/vector-icons';
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import { useEffect, useState } from 'react';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { settingsService } from '@/services/settings.service';
import { categoriesService } from '@/services/categories.service';

interface BookingSectionProps {
  formData: {
    enableBooking: boolean;
    categoryId?: string;
    subcategoryId?: string;
  };
  onInputChange: (field: string, value: string | boolean) => void;
}

export function BookingSection({
  formData,
  onInputChange,
}: BookingSectionProps) {
  const [bookingPrice, setBookingPrice] = useState(0);
  const [subcategorySupportsBooking, setSubcategorySupportsBooking] = useState(false);

  useEffect(() => {
    loadBookingPrice();
    checkSubcategoryBookingSupport();
  }, [formData.categoryId, formData.subcategoryId]);

  const loadBookingPrice = async () => {
    try {
      const response = await settingsService.getPublicSystemSettings();
      if (response.data.success && response.data.data) {
        setBookingPrice(response.data.data.bookingPrice || 0);
      }
    } catch (error) {
    }
  };

  const checkSubcategoryBookingSupport = async () => {
    if (!formData.categoryId || !formData.subcategoryId) {
      setSubcategorySupportsBooking(false);
      onInputChange('enableBooking', false);
      return;
    }

    try {
      const response = await categoriesService.getCategorySubcategories(formData.categoryId);
      const selectedSubcategory = response?.data?.find((sub) => sub.id === formData.subcategoryId);
      const supportsBooking = selectedSubcategory?.supportsBooking || false;
      setSubcategorySupportsBooking(supportsBooking);
      
      // If subcategory doesn't support booking, disable it
      if (!supportsBooking && formData.enableBooking) {
        onInputChange('enableBooking', false);
      }
    } catch (error) {
      // Default to true to show the option
      setSubcategorySupportsBooking(true);
    }
  };

  const formatCurrency = (amount: number) => {
    return `₹${amount}`;
  };

  // Don't render if subcategory doesn't support booking
  if (!subcategorySupportsBooking) {
    return null;
  }

  return (
    <View style={styles.section}>
      <ThemedText style={styles.sectionTitle}>Booking Activation</ThemedText>

      <TouchableOpacity
        style={styles.bookingToggle}
        onPress={() => onInputChange('enableBooking', !formData.enableBooking)}
      >
        <MaterialIcons
          name={formData.enableBooking ? 'check-box' : 'check-box-outline-blank'}
          size={20}
          color={Colors.light.primary}
        />
        <ThemedText style={styles.bookingText}>Enable Booking</ThemedText>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 16,
  },
  infoText: {
    fontSize: 13,
    color: '#666666',
    marginBottom: 8,
    lineHeight: 18,
  },
  helperText: {
    fontSize: 13,
    color: '#666666',
    marginBottom: 16,
    lineHeight: 18,
  },
  bookingToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 4,
    marginBottom: 16,
  },
  bookingText: {
    fontSize: 16,
    color: '#333333',
    flex: 1,
  },
});

import { MaterialIcons } from '@expo/vector-icons';
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { FloatingLabelInput } from '@/components/ui/floating-label-input';
import { formatPriceInput } from '@/utils/price-formatter';
import { Colors } from '@/constants/theme';

interface PricingSectionProps {
  formData: {
    price: string;
    useDiscountedPrice: boolean;
    discountedPrice: string;
  };
  errors: { [key: string]: string };
  onInputChange: (field: string, value: string | boolean) => void;
  showDiscount?: boolean;
  priceRequired?: boolean;
}

export function PricingSection({
  formData,
  errors,
  onInputChange,
  showDiscount = true,
  priceRequired = true,
}: PricingSectionProps) {
  const handlePriceChange = (value: string) => {
    const cleanValue = value.replace(/[^0-9]/g, '');
    onInputChange('price', cleanValue);
  };

  return (
    <View style={styles.section}>
      <ThemedText style={styles.sectionTitle}>Determine Price</ThemedText>

      <View style={styles.priceInputContainer}>
        <FloatingLabelInput
          label={priceRequired ? 'Price*' : 'Price (optional)'}
          value={formatPriceInput(formData.price)}
          onChangeText={handlePriceChange}
          error={errors.price}
          keyboardType="numeric"
          maxLength={15}
          containerStyle={[styles.input, styles.priceInput]}
        />
      </View>

      {showDiscount && (
        <>
          <TouchableOpacity
            style={styles.discountToggle}
            onPress={() => onInputChange('useDiscountedPrice', !formData.useDiscountedPrice)}
          >
            <MaterialIcons
              name={formData.useDiscountedPrice ? 'check-box' : 'check-box-outline-blank'}
              size={24}
              color={Colors.light.primary}
            />
            <ThemedText style={styles.discountText}>Use Discounted Price</ThemedText>
          </TouchableOpacity>

          {formData.useDiscountedPrice && (
            <View style={styles.priceInputContainer}>
              <FloatingLabelInput
                label="Discounted Price*"
                value={formatPriceInput(formData.discountedPrice)}
                onChangeText={(value) => onInputChange('discountedPrice', value.replace(/[^0-9]/g, ''))}
                error={errors.discountedPrice}
                keyboardType="numeric"
                maxLength={15}
                containerStyle={[styles.input, styles.priceInput]}
              />
            </View>
          )}
        </>
      )}
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
  priceInputContainer: {
    marginBottom: 16,
  },
  input: {
    marginBottom: 16,
  },
  priceInput: {
    marginBottom: 8,
  },
  discountToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 4,
    marginBottom: 16,
  },
  discountText: {
    fontSize: 16,
    color: '#333333',
    flex: 1,
  },
  infoText: {
    fontSize: 13,
    color: '#666666',
    marginBottom: 8,
    lineHeight: 18,
  },
});

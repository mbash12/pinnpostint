import { StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { formatPrice, shouldHidePrice } from '@/utils/price-formatter';

interface PriceDisplayProps {
  price: string | number | null;
  discountPrice?: string | number | null;
  size?: 'small' | 'medium' | 'large';
  style?: any;
}

export function PriceDisplay({ price, discountPrice, size = 'medium', style }: PriceDisplayProps) {
  const sizeStyles = {
    small: { main: 20, secondary: 16 },
    medium: { main: 28, secondary: 20 },
    large: { main: 32, secondary: 20 },
  };

  // Hide price if it's 0, null, or not available
  if (shouldHidePrice(price) && shouldHidePrice(discountPrice)) {
    return null;
  }

  const formattedPrice = formatPrice(price);
  const formattedDiscountPrice = discountPrice ? formatPrice(discountPrice) : null;

  return (
    <View style={[styles.container, style]}>
      {formattedDiscountPrice && !shouldHidePrice(discountPrice) ? (
        <>
          <ThemedText style={[styles.discountPrice, { fontSize: sizeStyles[size].main }]}>
            {formattedDiscountPrice}
          </ThemedText>
          {!shouldHidePrice(price) && (
            <ThemedText style={[styles.originalPrice, { fontSize: sizeStyles[size].secondary }]}>
              {formattedPrice}
            </ThemedText>
          )}
        </>
      ) : !shouldHidePrice(price) ? (
        <ThemedText style={[styles.price, { fontSize: sizeStyles[size].main }]}>
          {formattedPrice}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  price: {
    fontWeight: 'bold',
    color: Colors.light.primary,
  },
  discountPrice: {
    fontWeight: 'bold',
    color: Colors.light.primary,
  },
  originalPrice: {
    fontWeight: '500',
    color: Colors.light.textSecondary,
    textDecorationLine: 'line-through',
  },
});

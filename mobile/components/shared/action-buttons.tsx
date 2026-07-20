import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, TouchableOpacity, View, Share } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';

interface ActionButtonsProps {
  onWhatsAppPress: () => void;
  onBookingPress: () => void;
  onSharePress?: () => void;
  isDesktop?: boolean;
  style?: any;
}

export function ActionButtons({ onWhatsAppPress, onBookingPress, onSharePress, isDesktop = false, style }: ActionButtonsProps) {
  const buttonHeight = isDesktop ? 56 : 50;
  const buttonRadius = isDesktop ? 28 : 25;

  return (
    <View style={[styles.container, isDesktop && styles.desktopContainer, style]}>
      {onSharePress && (
        <TouchableOpacity 
          style={[styles.shareButton, { height: buttonHeight, borderRadius: buttonRadius }]}
          onPress={onSharePress}
          activeOpacity={0.8}
        >
          <MaterialIcons name="share" size={20} color={Colors.light.textSecondary} />
        </TouchableOpacity>
      )}
      
      <TouchableOpacity 
        style={[styles.whatsappButton, { height: buttonHeight, borderRadius: buttonRadius }]}
        onPress={onWhatsAppPress}
        activeOpacity={0.8}
      >
        <ThemedText style={styles.whatsappText}>WhatsApp</ThemedText>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={[styles.bookingButton, { height: buttonHeight, borderRadius: buttonRadius }]}
        onPress={onBookingPress}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={[Colors.light.gradientStart, Colors.light.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.bookingGradient}
        >
          <ThemedText style={styles.bookingText}>Book Now</ThemedText>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 12,
  },
  desktopContainer: {
    gap: 16,
  },
  shareButton: {
    width: 50,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  whatsappButton: {
    flex: 1,
    borderWidth: 2,
    borderColor: Colors.light.primary,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  whatsappText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.primary,
  },
  bookingButton: {
    flex: 1,
    overflow: 'hidden',
  },
  bookingGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookingText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

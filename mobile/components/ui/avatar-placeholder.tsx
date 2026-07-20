import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { View, StyleSheet } from 'react-native';
import { Colors } from '@/constants/theme';

interface AvatarPlaceholderProps {
  size?: number;
  style?: any;
}

export function AvatarPlaceholder({ size = 80, style }: AvatarPlaceholderProps) {
  return (
    <View style={[styles.placeholder, { width: size, height: size, borderRadius: size / 2 }, style]}>
      <LinearGradient
        colors={['#f0f0f0', '#e0e0e0']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.gradient, { width: size, height: size, borderRadius: size / 2 }]}
      >
        <MaterialIcons 
          name="person" 
          size={size * 0.5} 
          color={Colors.light.textSecondary} 
        />
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: '#f8f8f8',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e8e8e8',
    overflow: 'hidden',
  },
  gradient: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Colors } from '@/constants/theme';

interface GradientButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  size?: 'small' | 'medium' | 'large';
  icon?: string;
  loading?: boolean;
  disabled?: boolean;
  style?: any;
}

export function GradientButton({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  icon,
  loading = false,
  disabled = false,
  style,
}: GradientButtonProps) {
  const buttonHeight = size === 'small' ? 36 : size === 'large' ? 56 : 50;
  const fontSize = size === 'small' ? 13 : size === 'large' ? 18 : 16;
  const iconSize = size === 'small' ? 14 : size === 'large' ? 20 : 16;
  const paddingH = size === 'small' ? 16 : size === 'large' ? 32 : 24;

  const renderContent = () => {
    if (loading) {
      return <ActivityIndicator size="small" color={variant === 'secondary' ? Colors.light.primary : '#FFFFFF'} />;
    }

    return (
      <View style={styles.content}>
        <Text style={[styles.text, { fontSize, color: variant === 'secondary' ? Colors.light.primary : '#FFFFFF' }]}>
          {title}
        </Text>
        {icon && (
          <MaterialIcons 
            name={icon as any} 
            size={iconSize} 
            color={variant === 'secondary' ? Colors.light.primary : '#FFFFFF'} 
          />
        )}
      </View>
    );
  };

  if (variant === 'secondary') {
    return (
      <TouchableOpacity
        style={[
          styles.button,
          {
            height: buttonHeight,
            paddingHorizontal: paddingH,
            borderWidth: 2,
            borderColor: Colors.light.primary,
            backgroundColor: '#FFFFFF',
            justifyContent: 'center',
            alignItems: 'center',
          },
          disabled && styles.disabled,
          style
        ]}
        onPress={onPress}
        disabled={disabled || loading}
        activeOpacity={0.8}
      >
        {renderContent()}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[
        styles.button,
        {
          height: buttonHeight,
        },
        disabled && styles.disabled,
        style
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      <LinearGradient
        colors={[Colors.light.gradientStart, Colors.light.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.gradient}
      >
        {renderContent()}
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    overflow: 'hidden',
    borderRadius: 25,
  },
  gradient: {
    borderRadius: 25,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: 'auto'
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  text: {
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.5,
  },
});
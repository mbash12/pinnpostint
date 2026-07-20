/**
 * Location Banner Component
 * Shows a contextual prompt to enable location services
 * "Turn On" button opens app settings directly
 */

import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Linking,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSelectedLocation } from '@/contexts/location-context';

interface LocationBannerProps {
  onPermissionGranted?: () => void;
}

export function LocationBanner({ onPermissionGranted }: LocationBannerProps) {
  const { showBanner, dismissBanner } = useSelectedLocation();
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (showBanner) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -100,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [showBanner]);

  const handleEnablePress = async () => {
    try {
      // Open app settings where user can enable location permission
      await Linking.openSettings();
    } catch (error) {
      // Silent fail
    }
  };

  const handleDismissPress = () => {
    dismissBanner();
  };

  if (!showBanner) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
        },
      ]}
    >
      <View style={styles.content}>
        <MaterialIcons
          name="location-off"
          size={20}
          color="#6B7280"
          style={styles.icon}
        />
        <Text style={styles.text}>
          Enable location to see nearby results
        </Text>
        <TouchableOpacity
          style={styles.enableButton}
          onPress={handleEnablePress}
          activeOpacity={0.7}
        >
          <Text style={styles.enableButtonText}>Turn On</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.dismissButton}
          onPress={handleDismissPress}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <MaterialIcons name="close" size={18} color="#9CA3AF" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  icon: {
    marginRight: 8,
  },
  text: {
    flex: 1,
    fontSize: 13,
    color: '#4B5563',
    fontWeight: '500',
  },
  enableButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 8,
  },
  enableButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  dismissButton: {
    padding: 4,
  },
});

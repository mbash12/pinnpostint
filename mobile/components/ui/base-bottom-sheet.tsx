import React, { useEffect, useRef, ReactNode } from 'react';
import {
  Modal,
  View,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
  Animated,
  Easing,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { Colors, WebShadows } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';

const { height: screenHeight, width: screenWidth } = Dimensions.get('window');

export type BaseBottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  showCloseButton?: boolean;
  showResetButton?: boolean;
  onReset?: () => void;
  resetText?: string;
  maxHeight?: number;
  backdropOpacity?: number;
  enableBackdropDismiss?: boolean;
};

export function BaseBottomSheet({
  visible,
  onClose,
  title,
  children,
  showCloseButton = true,
  showResetButton = false,
  onReset,
  resetText = 'Reset',
  maxHeight = 0.85,
  backdropOpacity = 0.5,
  enableBackdropDismiss = true,
}: BaseBottomSheetProps) {
  const isDesktop = Platform.OS === 'web' && screenWidth > 768;
  
  // Animation values
  const slideAnim = useRef(new Animated.Value(screenHeight)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    if (visible) {
      if (isDesktop) {
        // Desktop animations: scale and fade in
        Animated.parallel([
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 250,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
          }),
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: false,
          })
        ]).start();
      } else {
        // Mobile animation: slide up smoothly
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }).start();
      }
    } else {
      if (isDesktop) {
        // Desktop animations: scale and fade out
        Animated.parallel([
          Animated.timing(scaleAnim, {
            toValue: 0.8,
            duration: 200,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: false,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0,
            duration: 150,
            useNativeDriver: false,
          })
        ]).start();
      } else {
        // Mobile animation: slide down smoothly
        Animated.timing(slideAnim, {
          toValue: screenHeight,
          duration: 250,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: false,
        }).start();
      }
    }
  }, [visible, slideAnim, scaleAnim, opacityAnim, isDesktop]);

  const handleBackdropPress = () => {
    if (enableBackdropDismiss) {
      onClose();
    }
  };

  const renderContent = () => (
    <Animated.View
      style={[
        styles.container,
        isDesktop && styles.desktopContainer,
        isDesktop ? {
          transform: [{ scale: scaleAnim }],
          opacity: opacityAnim,
          maxHeight: screenHeight * maxHeight
        } : {
          transform: [{ translateY: slideAnim }],
          maxHeight: screenHeight * maxHeight,
          height: screenHeight * maxHeight
        }
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        {showCloseButton && (
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <MaterialIcons name="close" size={24} color={Colors.light.text} />
          </TouchableOpacity>
        )}
        <ThemedText style={styles.title}>{title}</ThemedText>
        <View style={styles.headerEnd}>
          {showResetButton && onReset && (
            <TouchableOpacity onPress={onReset} style={styles.resetButton}>
              <ThemedText style={styles.resetText}>{resetText}</ThemedText>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {children}
      </View>
    </Animated.View>
  );

  if (isDesktop) {
    return (
      <Modal
        visible={visible}
        transparent={true}
        onRequestClose={onClose}
        animationType="none"
      >
        <View 
          style={[styles.desktopSafeArea, { backgroundColor: `rgba(0, 0, 0, ${backdropOpacity})` }]}
        >
          {renderContent()}
        </View>
      </Modal>
    );
  }

  return (
    <Modal
      visible={visible}
      transparent={true}
      onRequestClose={onClose}
      animationType="none"
    >
      <View
        style={[styles.overlay, { backgroundColor: `rgba(0, 0, 0, ${backdropOpacity})` }]}
      >
        {/* Backdrop - separate from content */}
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={handleBackdropPress}
        />
        
        {/* Content - blocks touches from reaching backdrop */}
        <View
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
        >
          {renderContent()}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  desktopSafeArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: Colors.light.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  desktopContainer: {
    width: '90%',
    maxWidth: 600,
    borderRadius: 16,
    margin: 'auto',
    boxShadow: WebShadows.prominent,
    ...Platform.select({
      web: {
        boxShadow: WebShadows.prominent,
      },
      default: {
        elevation: 2,
        shadowColor: 'rgba(0, 0, 0, 0.08)',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
    }),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  closeButton: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    flex: 1,
    textAlign: 'center',
  },
  headerEnd: {
    width: 60,
    alignItems: 'flex-end',
  },
  resetButton: {
    padding: 4,
  },
  resetText: {
    fontSize: 14,
    color: Colors.light.primary,
    fontWeight: '500',
  },
  content: {
    flex: 1,
    overflow: 'hidden',
  },
});
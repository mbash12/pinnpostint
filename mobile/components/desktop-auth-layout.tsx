import React from 'react';
import { Image, StyleSheet, View, TouchableOpacity, Platform, Text, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { Colors, WebShadows, Fonts } from '@/constants/theme';
import { useBackNavigation } from '@/utils/navigation-helpers';

interface DesktopAuthLayoutProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  showBackButton?: boolean;
  onBackPress?: () => void;
  footerContent?: React.ReactNode;
}

export function DesktopAuthLayout({
  title,
  subtitle,
  children,
  showBackButton = false,
  onBackPress,
  footerContent
}: DesktopAuthLayoutProps) {
  const router = useRouter();
  const { goBack } = useBackNavigation();

  const handleBack = () => {
    if (onBackPress) {
      onBackPress();
    } else {
      goBack();
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Left side - Welcome Section */}
        <View style={styles.leftSection}>
          <View style={styles.welcomeContent}>
            <TouchableOpacity style={styles.logoContainer} onPress={() => router.push('/')}>
              <View style={styles.logoWrapper}>
                <Image
                  source={require('@/assets/images/logo.png')}
                  style={styles.logo}
                  resizeMode="contain"
                />
                <View style={styles.textColumn}>
                  <Text style={styles.brandName}>Pin N Post</Text>
                  <Text style={styles.tagline}>BUY, RENT, SELL</Text>
                </View>
              </View>
            </TouchableOpacity>
            <ThemedText style={styles.welcomeTitle}>Welcome to Pin N Post!</ThemedText>
            <ThemedText style={styles.welcomeSubtitle}>
              Your trusted marketplace for buying and selling everything you need.
            </ThemedText>
            

          </View>
        </View>

        {/* Right side - Form Section */}
        <View style={styles.rightSection}>
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollViewContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <View style={styles.formContainer}>
              <View style={styles.formHeader}>
                <ThemedText style={styles.formTitle}>{title}</ThemedText>
                <ThemedText style={styles.formSubtitle}>{subtitle}</ThemedText>
              </View>

              <View style={styles.form}>
                {children}
              </View>

              {footerContent && (
                <View style={styles.formFooter}>
                  {footerContent}
                </View>
              )}
            </View>
          </ScrollView>

          {/* Navigation buttons - rendered after ScrollView so they're on top */}
          {showBackButton && (
            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
              <MaterialIcons name="arrow-back" size={24} color={Colors.light.text} />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.closeButton} onPress={() => router.push('/' as any)}>
            <MaterialIcons name="close" size={24} color={Colors.light.text} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create<any>({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    width: '100%',
    height: '100vh',
  },
  content: {
    flexDirection: 'row',
    width: '100%',
    height: '100%',
  },
  leftSection: {
    flex: 1,
    backgroundColor: Colors.light.primary,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    position: 'relative',
    minHeight: '100vh',
  },
  welcomeContent: {
    maxWidth: 500,
    zIndex: 1,
    alignItems: 'center',
  },
  logoContainer: {
    alignSelf: 'center',
    marginBottom: 32,
  },
  logoWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  logo: {
    width: 56,
    height: 56,
  },
  textColumn: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  brandName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 28,
    fontFamily: Fonts?.sans || 'System',
  },
  tagline: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
    letterSpacing: 2,
    lineHeight: 16,
    marginTop: -2,
    fontFamily: Fonts?.sans || 'System',
  },
  welcomeTitle: {
    fontSize: 42,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 16,
    textAlign: 'center',
    lineHeight: 50,
    fontFamily: Fonts?.sans || 'System',
  },
  welcomeSubtitle: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    lineHeight: 28,
    marginBottom: 48,
    fontWeight: '400',
    fontFamily: Fonts?.sans || 'System',
  },
  rightSection: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    position: 'relative',
    minHeight: '100vh',
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 60,
  },
  backButton: {
    position: 'absolute',
    top: 24,
    left: 24,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
    justifyContent: 'center',
    alignItems: 'center',
    boxShadow: WebShadows.subtle,
    elevation: 1,
  },
  closeButton: {
    position: 'absolute',
    top: 24,
    right: 24,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
    justifyContent: 'center',
    alignItems: 'center',
    boxShadow: WebShadows.subtle,
    elevation: 1,
  },
  formContainer: {
    width: '100%',
    maxWidth: 400,
  },
  formHeader: {
    marginBottom: 48,
    alignItems: 'center',
  },
  formTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 8,
    textAlign: 'center',
    fontFamily: Fonts?.sans || 'System',
  },
  formSubtitle: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    fontFamily: Fonts?.sans || 'System',
  },
  form: {
    width: '100%',
    gap: 24,
  },
  formFooter: {
    marginTop: 32,
  },
});

import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState, useEffect } from 'react';
import { Dimensions, Platform, StyleSheet, TouchableOpacity, View, Linking } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';

interface FooterProps {
  showOnMobile?: boolean;
}

export function Footer({ showOnMobile = true }: FooterProps) {
  const router = useRouter();
  const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);
  const [isDesktop, setIsDesktop] = useState(Platform.OS === 'web' && screenWidth > 768);

  useEffect(() => {
    const onChange = (result: any) => {
      const newWidth = result.window.width;
      setScreenWidth(newWidth);
      setIsDesktop(Platform.OS === 'web' && newWidth > 768);
    };

    const dimensionsHandler = Platform.OS === 'web'
      ? Dimensions.addEventListener('change', onChange)
      : null;

    return () => {
      if (dimensionsHandler) {
        dimensionsHandler.remove();
      }
    };
  }, []);

  if (!isDesktop && !showOnMobile) {
    return null;
  }

  if (!isDesktop) {
    return (
      <ThemedView style={mobileStyles.footer}>
        {/* Brand */}
        <View style={mobileStyles.brandSection}>
          <ThemedText style={mobileStyles.brandName}>Pin N Post</ThemedText>
          <ThemedText style={mobileStyles.brandTagline}>
            Your trusted marketplace for buying and selling.
          </ThemedText>
        </View>

        {/* Link Grid */}
        <View style={mobileStyles.linkGrid}>
          <View style={mobileStyles.gridColumn}>
            <ThemedText style={mobileStyles.columnTitle}>Quick Links</ThemedText>
            <TouchableOpacity onPress={() => router.push({ pathname: '/(tabs)/browse', params: { browse: 'all' } })}>
              <ThemedText style={mobileStyles.link}>Browse Ads</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/(tabs)/blog')}>
              <ThemedText style={mobileStyles.link}>Blog</ThemedText>
            </TouchableOpacity>
          </View>

          <View style={mobileStyles.gridColumn}>
            <ThemedText style={mobileStyles.columnTitle}>Support</ThemedText>
            <TouchableOpacity onPress={() => router.push('/(pages)/help-support')}>
              <ThemedText style={mobileStyles.link}>Help Center</ThemedText>
            </TouchableOpacity>
          </View>

          <View style={mobileStyles.gridColumn}>
            <ThemedText style={mobileStyles.columnTitle}>Legal</ThemedText>
            <TouchableOpacity onPress={() => router.push('/(pages)/legal/terms')}>
              <ThemedText style={mobileStyles.link}>Terms</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/(pages)/legal/privacy')}>
              <ThemedText style={mobileStyles.link}>Privacy</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/(pages)/legal/account-deletion')}>
              <ThemedText style={mobileStyles.link}>Account Deletion</ThemedText>
            </TouchableOpacity>
          </View>
        </View>

        {/* Bottom Bar */}
        <View style={mobileStyles.bottom}>
          <ThemedText style={mobileStyles.copyright}>
            © 2025 Pin N Post. All rights reserved.
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.footer}>
      <View style={styles.footerContent}>
        {/* About Section */}
        <View style={styles.footerSection}>
          <ThemedText style={styles.footerTitle}>About Pin N Post</ThemedText>
          <ThemedText style={styles.footerText}>
            Your trusted marketplace for buying and selling. Connect with buyers and sellers in your area.
          </ThemedText>
        </View>

        {/* Quick Links */}
        <View style={styles.footerSection}>
          <ThemedText style={styles.footerTitle}>Quick Links</ThemedText>
          <TouchableOpacity onPress={() => router.push({ pathname: '/(tabs)/browse', params: { browse: 'all' } })}>
            <ThemedText style={styles.footerLink}>Browse Ads</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/(tabs)/blog')}>
            <ThemedText style={styles.footerLink}>Blog</ThemedText>
          </TouchableOpacity>
        </View>

        {/* Support */}
        <View style={styles.footerSection}>
          <ThemedText style={styles.footerTitle}>Support</ThemedText>
          <TouchableOpacity onPress={() => router.push('/(pages)/help-support')}>
            <ThemedText style={styles.footerLink}>Help Center</ThemedText>
          </TouchableOpacity>
        </View>

        {/* Legal */}
        <View style={styles.footerSection}>
          <ThemedText style={styles.footerTitle}>Legal</ThemedText>
          <TouchableOpacity onPress={() => router.push('/(pages)/legal/terms')}>
            <ThemedText style={styles.footerLink}>Terms of Service</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/(pages)/legal/privacy')}>
            <ThemedText style={styles.footerLink}>Privacy Policy</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/(pages)/legal/account-deletion')}>
            <ThemedText style={styles.footerLink}>Account Deletion</ThemedText>
          </TouchableOpacity>
        </View>
      </View>

      {/* Bottom Bar */}
      <View style={styles.footerBottom}>
        <View style={styles.footerBottomContent}>
          <ThemedText style={styles.copyright}>
            © 2025 Pin N Post. All rights reserved.
          </ThemedText>
        </View>
      </View>
    </ThemedView>
  );
}

const mobileStyles = StyleSheet.create({
  footer: {
    backgroundColor: '#1F2937',
    paddingTop: 32,
    paddingBottom: 24,
    paddingHorizontal: 20,
    width: '100%',
    alignSelf: 'stretch',
    flexShrink: 0,
  },
  brandSection: {
    marginBottom: 24,
  },
  brandName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  brandTagline: {
    fontSize: 13,
    color: '#9CA3AF',
    lineHeight: 19,
  },
  linkGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  gridColumn: {
    flex: 1,
    marginRight: 16,
  },
  columnTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  link: {
    fontSize: 13,
    color: '#D1D5DB',
    marginBottom: 10,
    lineHeight: 18,
  },
  bottom: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    paddingTop: 16,
  },
  copyright: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
});

const styles = StyleSheet.create({
  footer: {
    backgroundColor: '#1F2937',
    paddingTop: 60,
    width: '100%',
    alignSelf: 'stretch',
    flexShrink: 0,
    marginBottom: 0,
    ...Platform.select({
      web: {
        paddingBottom: 32,
      },
    }),
  },
  footerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 40,
    paddingBottom: 40,
  },
  footerSection: {
    flex: 1,
    marginRight: 40,
  },
  footerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 20,
  },
  footerText: {
    fontSize: 14,
    color: '#D1D5DB',
    lineHeight: 22,
    marginBottom: 20,
  },
  footerLink: {
    fontSize: 14,
    color: '#D1D5DB',
    marginBottom: 12,
    lineHeight: 20,
  },
  socialLinks: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  socialIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerBottom: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 16,
    marginBottom: 0,
  },
  footerBottomContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 40,
  },
  copyright: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  bottomLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bottomLink: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  separator: {
    fontSize: 14,
    color: '#9CA3AF',
  },
});

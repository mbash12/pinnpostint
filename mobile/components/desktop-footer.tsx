import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { View, Text, TouchableOpacity, StyleSheet, TextInput } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Fonts } from '@/constants/theme';

interface DesktopFooterProps {
  isDesktop: boolean;
}

export function DesktopFooter({ isDesktop }: DesktopFooterProps) {
  const router = useRouter();

  if (!isDesktop) return null;

  const footerSections = [
    {
      title: 'Company',
      links: [
        { name: 'About Us', path: '/about' },
        { name: 'Careers', path: '/careers' },
        { name: 'Press', path: '/press' },
        { name: 'Blog', path: '/blog' },
      ]
    },
    {
      title: 'Support',
      links: [
        { name: 'Help Center', path: '/(pages)/help-support' },
        { name: 'Community Guidelines', path: '/guidelines' },
        // { name: 'Contact Us', path: '/contact' },
      ]
    },
    {
      title: 'Legal',
      links: [
        { name: 'Terms of Service', path: '/(pages)/legal/terms' },
        { name: 'Privacy Policy', path: '/(pages)/legal/privacy' },
      ]
    },
    {
      title: 'Discover',
      links: [
        { name: 'Trending Items', path: '/trending' },
        { name: 'Featured Services', path: '/services' },
        { name: 'Local Deals', path: '/deals' },
      ]
    }
  ];

  const socialLinks = [
    { name: 'Facebook', icon: 'facebook', url: '' },
    { name: 'Twitter', icon: 'twitter', url: '' },
    { name: 'Instagram', icon: 'camera-alt', url: '' },
    { name: 'LinkedIn', icon: 'work', url: '' },
    { name: 'YouTube', icon: 'play-circle-filled', url: '' },
  ];

  const appDownloadLinks = [
    { name: 'App Store', icon: 'apple', url: '' },
    { name: 'Google Play', icon: 'android', url: '' },
  ];

  const handleLinkPress = (path: string) => {
    router.push(path as any);
  };

  return (
    <ThemedView style={styles.footer}>
      <View style={styles.footerContent}>
        {/* Main Footer Content */}
        <View style={styles.footerMain}>
          {/* Company Info */}
          <View style={styles.footerSection}>
            <View style={styles.footerBrand}>
              <Text style={styles.footerLogo}>Pin N Post</Text>
              <Text style={styles.footerTagline}>
                Your trusted local marketplace for buying, selling, and connecting with your community.
              </Text>
            </View>
            
          </View>

          {/* Footer Links */}
          <View style={styles.footerLinksContainer}>
            {footerSections.map((section) => (
              <View key={section.title} style={styles.footerSection}>
                <Text style={styles.footerSectionTitle}>{section.title}</Text>
                {section.links.map((link) => (
                  <TouchableOpacity
                    key={link.name}
                    style={styles.footerLink}
                    onPress={() => handleLinkPress(link.path)}
                  >
                    <Text style={styles.footerLinkText}>{link.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </View>

          {/* App Downloads */}
          <View style={styles.footerSection}>
            <Text style={styles.footerSectionTitle}>Get the App</Text>
            <Text style={styles.appDescription}>
              Buy and sell on the go with our mobile app
            </Text>
            <View style={styles.appButtons}>
              {appDownloadLinks.map((app) => (
                <TouchableOpacity key={app.name} style={styles.appButton}>
                  <MaterialIcons name={app.icon as any} size={24} color={Colors.light.text} />
                  <View style={styles.appButtonText}>
                    <Text style={styles.appButtonSmall}>Download on the</Text>
                    <Text style={styles.appButtonLarge}>{app.name}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Newsletter Section */}
        <View style={styles.newsletterSection}>
          <View style={styles.newsletterContent}>
            <View style={styles.newsletterText}>
              <Text style={styles.newsletterTitle}>Stay Updated</Text>
              <Text style={styles.newsletterDescription}>
                Get the latest updates on new features and exclusive offers
              </Text>
            </View>
            <View style={styles.newsletterForm}>
              <TextInput
                style={styles.newsletterInput}
                placeholder="Enter your email"
                placeholderTextColor={Colors.light.textSecondary}
                tabIndex={0}
              />
              <TouchableOpacity style={styles.newsletterButton}>
                <Text style={styles.newsletterButtonText}>Subscribe</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Bottom Footer */}
        <View style={styles.footerBottom}>
          <View style={styles.footerBottomContent}>
            <Text style={styles.copyright}>
              © 2025 Pin N Post. All rights reserved.
            </Text>
            <View style={styles.bottomLinks}>
              <TouchableOpacity onPress={() => handleLinkPress('/(pages)/legal/terms')}>
                <Text style={styles.bottomLinkText}>Terms</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleLinkPress('/(pages)/legal/privacy')}>
                <Text style={styles.bottomLinkText}>Privacy</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  footer: {
    backgroundColor: '#1A1A1A',
    width: '100%',
    marginTop: 'auto',
  },
  footerContent: {
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
  },
  footerMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  footerSection: {
    flex: 1,
    marginRight: 40,
  },
  footerBrand: {
    marginBottom: 32,
  },
  footerLogo: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
    fontFamily: Fonts?.sans || 'System',
  },
  footerTagline: {
    fontSize: 14,
    color: '#B0B0B0',
    lineHeight: 20,
    maxWidth: 280,
    fontFamily: Fonts?.sans || 'System',
  },
  socialSection: {
    marginTop: 24,
  },
  socialTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
    fontFamily: Fonts?.sans || 'System',
  },
  socialLinks: {
    flexDirection: 'row',
    gap: 12,
  },
  socialLink: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2A2A2A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerLinksContainer: {
    flexDirection: 'row',
    flex: 2,
    justifyContent: 'space-between',
  },
  footerSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 16,
    fontFamily: Fonts?.sans || 'System',
  },
  footerLink: {
    marginBottom: 12,
  },
  footerLinkText: {
    fontSize: 14,
    color: '#B0B0B0',
    fontFamily: Fonts?.sans || 'System',
  },
  appDescription: {
    fontSize: 14,
    color: '#B0B0B0',
    marginBottom: 16,
    lineHeight: 20,
    fontFamily: Fonts?.sans || 'System',
  },
  appButtons: {
    gap: 12,
  },
  appButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A2A2A',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 12,
  },
  appButtonText: {
    flex: 1,
  },
  appButtonSmall: {
    fontSize: 10,
    color: '#B0B0B0',
    fontFamily: Fonts?.sans || 'System',
  },
  appButtonLarge: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: Fonts?.sans || 'System',
  },
  newsletterSection: {
    backgroundColor: '#2A2A2A',
    marginHorizontal: 40,
    borderRadius: 12,
    padding: 32,
    marginBottom: 40,
  },
  newsletterContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  newsletterText: {
    flex: 1,
  },
  newsletterTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
    fontFamily: Fonts?.sans || 'System',
  },
  newsletterDescription: {
    fontSize: 14,
    color: '#B0B0B0',
    maxWidth: 400,
    fontFamily: Fonts?.sans || 'System',
  },
  newsletterForm: {
    flexDirection: 'row',
    gap: 12,
    flex: 1,
    justifyContent: 'flex-end',
  },
  newsletterInput: {
    flex: 1,
    maxWidth: 300,
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    color: '#FFFFFF',
    fontSize: 14,
    borderWidth: 0,
    outlineWidth: 0,
    outlineColor: 'transparent',
    outlineStyle: 'none',
    fontFamily: Fonts?.sans || 'System',
  },
  newsletterButton: {
    backgroundColor: Colors.light.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  newsletterButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: Fonts?.sans || 'System',
  },
  footerBottom: {
    borderTopWidth: 1,
    borderTopColor: '#2A2A2A',
  },
  footerBottomContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 40,
  },
  copyright: {
    fontSize: 14,
    color: '#B0B0B0',
    fontFamily: Fonts?.sans || 'System',
  },
  bottomLinks: {
    flexDirection: 'row',
    gap: 24,
  },
  bottomLinkText: {
    fontSize: 14,
    color: '#B0B0B0',
    fontFamily: Fonts?.sans || 'System',
  },
});

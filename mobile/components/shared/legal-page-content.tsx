import React from 'react';
import { StyleSheet, View, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { RenderHTML, defaultSystemFonts } from 'react-native-render-html';
import { ThemedText } from '@/components/themed-text';
import { PageLayout } from '@/components/page-layout';
import { Colors, Shadows } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { legalService, platformAdsService } from '@/services';
import type { PlatformAd } from '@/types/api.types';
import { MobilePlatformBanners } from '@/components/mobile-platform-banners';
import { useResponsive } from '@/hooks/use-responsive';

// Custom renderers for better list styling
const renderUl = (props: any) => {
  const { TDefaultRenderer, ...defaultProps } = props;
  return (
    <View style={styles.customUl}>
      <TDefaultRenderer {...defaultProps} />
    </View>
  );
};

const renderOl = (props: any) => {
  const { TDefaultRenderer, ...defaultProps } = props;
  return (
    <View style={styles.customOl}>
      <TDefaultRenderer {...defaultProps} />
    </View>
  );
};

const renderLi = (props: any) => {
  const { TDefaultRenderer, ...defaultProps } = props;
  const tnode = props.tnode;
  const parentTag = tnode.parent?.tagName;
  const isOrdered = parentTag === 'ol';
  
  // Calculate index for ordered lists
  let index = 1;
  if (isOrdered && tnode.parent) {
    const siblings = tnode.parent.children;
    const liSiblings = siblings.filter((c: any) => c.tagName === 'li');
    index = liSiblings.indexOf(tnode) + 1;
  }

  return (
    <View style={styles.customLi}>
      <View style={styles.markerContainer}>
        {isOrdered ? (
          <ThemedText style={styles.number}>{index}.</ThemedText>
        ) : (
          <ThemedText style={styles.bullet}>•</ThemedText>
        )}
      </View>
      <View style={styles.liContent}>
        <TDefaultRenderer {...defaultProps} />
      </View>
    </View>
  );
};

interface LegalPageContentProps {
  title: string;
  subtitle?: string;
  content: string;
  loading?: boolean;
}

export function LegalPageContent({ title, subtitle, content, loading }: LegalPageContentProps) {
  const { isDesktop, screenWidth } = useResponsive();
  const [platformAds, setPlatformAds] = React.useState<PlatformAd[]>([]);
  const [isLoadingPlatformAds, setIsLoadingPlatformAds] = React.useState(true);

  // Fetch platform ads
  React.useEffect(() => {
    const fetchPlatformAds = async () => {
      try {
        setIsLoadingPlatformAds(true);
        const response = await platformAdsService.getPlatformAds();
        if (response.success && response.data) {
          setPlatformAds(response.data);
        }
      } catch (error) {
      } finally {
        setIsLoadingPlatformAds(false);
      }
    };
    fetchPlatformAds();
  }, []);

  // Optimized width for reading on desktop and mobile
  // Using ~65-75 characters per line for optimal readability
  const contentWidth = isDesktop ? Math.min(screenWidth * 0.8, 800) : screenWidth - 48; // 24 padding each side

  return (
    <PageLayout contentContainerStyle={!isDesktop ? styles.contentWrapperMobile : styles.contentWrapper}>
      {/* Header Section - Full Width */}
      <LinearGradient
        colors={[Colors.light.gradientStart, Colors.light.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.headerGradient, isDesktop && styles.headerGradientDesktop]}
      >
        <View style={styles.headerContent}>
          <ThemedText style={styles.title}>{title}</ThemedText>
          {subtitle && (
            <ThemedText style={styles.subtitle}>{subtitle}</ThemedText>
          )}
        </View>
      </LinearGradient>

      {!isDesktop && <MobilePlatformBanners ads={platformAds} position="top" style={{ marginTop: 8, marginBottom: 16, paddingHorizontal: 16 }} />}

      <View style={styles.container}>
        {/* Content Card */}
        <View style={[styles.card, isDesktop && styles.cardDesktop]}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.light.primary} />
              <ThemedText style={styles.loadingText}>Loading document...</ThemedText>
            </View>
          ) : content ? (
            <ScrollView 
              showsVerticalScrollIndicator={Platform.OS === 'web'}
              contentContainerStyle={styles.scrollContent}
              style={{ flex: 1 }}
            >
              <RenderHTML
                contentWidth={contentWidth}
                source={{ html: content }}
                baseStyle={styles.htmlContent}
                tagsStyles={!isDesktop ? mobileTagsStyles : tagsStyles}
                systemFonts={[...defaultSystemFonts]}
                renderers={{
                  ul: renderUl,
                  ol: renderOl,
                  li: renderLi,
                }}
                defaultTextProps={{
                  selectable: true,
                }}
              />
            </ScrollView>
          ) : (
            <View style={styles.emptyContainer}>
              <ThemedText style={styles.emptyText}>This document is currently unavailable.</ThemedText>
            </View>
          )}
        </View>
      </View>

      {!isDesktop && <MobilePlatformBanners ads={platformAds} position="bottom" style={{ marginTop: 4, marginBottom: 24, paddingHorizontal: 16 }} />}
    </PageLayout>
  );
}

const tagsStyles: any = {
  body: {
    color: Colors.light.text,
    fontSize: 16,
    lineHeight: 26,
  },
  p: {
    fontSize: 16,
    lineHeight: 26,
    color: Colors.light.text,
    marginBottom: 12,
    marginTop: 0,
    textAlign: 'left',
  },
  h1: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.light.text,
    marginBottom: 12,
    marginTop: 8,
    letterSpacing: -0.5,
  },
  h2: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 16,
    marginTop: 28,
    letterSpacing: -0.3,
  },
  h3: {
    fontSize: 19,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 12,
    marginTop: 20,
    letterSpacing: -0.2,
  },
  h4: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 10,
    marginTop: 16,
  },
  li: {
    fontSize: 16,
    lineHeight: 26,
    color: Colors.light.text,
    marginBottom: 0, // Removed margin to avoid double margin with customLi
    marginTop: 0,
  },
  ul: {
    marginBottom: 8,
    marginTop: 0,
  },
  ol: {
    marginBottom: 8,
    marginTop: 0,
  },
  strong: {
    fontWeight: '700',
    color: Colors.light.text,
  },
  b: {
    fontWeight: '700',
    color: Colors.light.text,
  },
  em: {
    fontStyle: 'italic',
    color: Colors.light.text,
  },
  i: {
    fontStyle: 'italic',
    color: Colors.light.text,
  },
  a: {
    color: Colors.light.primary,
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
  hr: {
    backgroundColor: Colors.light.border,
    height: 1,
    marginVertical: 24,
  },
};

const mobileTagsStyles: any = {
  body: {
    color: Colors.light.text,
    fontSize: 14,
    lineHeight: 22,
  },
  p: {
    fontSize: 14,
    lineHeight: 22,
    color: Colors.light.text,
    marginBottom: 10,
    marginTop: 0,
    textAlign: 'left',
  },
  h1: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.light.text,
    marginBottom: 10,
    marginTop: 8,
    letterSpacing: -0.5,
  },
  h2: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 12,
    marginTop: 20,
    letterSpacing: -0.3,
  },
  h3: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 10,
    marginTop: 16,
    letterSpacing: -0.2,
  },
  h4: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 8,
    marginTop: 14,
  },
  li: {
    fontSize: 14,
    lineHeight: 22,
    color: Colors.light.text,
    marginBottom: 0,
    marginTop: 0,
  },
  ul: {
    marginBottom: 8,
    marginTop: 0,
  },
  ol: {
    marginBottom: 8,
    marginTop: 0,
  },
  strong: {
    fontWeight: '700',
    color: Colors.light.text,
  },
  b: {
    fontWeight: '700',
    color: Colors.light.text,
  },
  em: {
    fontStyle: 'italic',
    color: Colors.light.text,
  },
  i: {
    fontStyle: 'italic',
    color: Colors.light.text,
  },
  a: {
    color: Colors.light.primary,
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
  hr: {
    backgroundColor: Colors.light.border,
    height: 1,
    marginVertical: 24,
  },
};

const styles = StyleSheet.create({
  contentWrapper: {
    flexGrow: 1,
    backgroundColor: '#F8F9FA',
  },
  contentWrapperMobile: {
    flexGrow: 1,
    backgroundColor: '#F8F9FA',
    paddingTop: 90,
  },
  container: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    paddingBottom: 40,
  },
  headerGradient: {
    width: '100%',
    paddingTop: 50,
    paddingBottom: 40,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  headerGradientDesktop: {
    paddingTop: 40,
    paddingBottom: 100,
  },
  headerContent: {
    maxWidth: 800,
    width: '100%',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    fontWeight: '500',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '92%',
    ...Shadows.soft,
    padding: 24,
    minHeight: 400,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    flex: Platform.OS === 'web' ? undefined : 1, // Allow card to grow on mobile
  },
  cardDesktop: {
    maxWidth: 900,
    padding: 48,
    marginTop: -60,
    flex: undefined,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: Colors.light.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
  htmlContent: {
    color: Colors.light.text,
  },
  customUl: {
    marginBottom: 12,
    marginTop: 4,
  },
  customOl: {
    marginBottom: 12,
    marginTop: 4,
  },
  customLi: {
    flexDirection: 'row',
    marginBottom: 8, // Primary margin for list items
    marginTop: 0,
    alignItems: 'flex-start',
  },
  markerContainer: {
    width: 24,
    alignItems: 'flex-start',
    paddingTop: 2,
  },
  bullet: {
    color: Colors.light.primary,
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 22,
  },
  number: {
    color: Colors.light.primary,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 24,
  },
  liContent: {
    flex: 1,
  },
});


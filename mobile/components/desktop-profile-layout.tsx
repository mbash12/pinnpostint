import React, { useState, useEffect, useMemo } from 'react';
import { Dimensions, Platform, StyleSheet, View, ScrollView } from 'react-native';

import { Footer } from '@/components/footer';
import { ProfileSideMenu } from '@/components/profile-side-menu';
import { platformAdsService } from '@/services';
import { PlatformAd, PlatformAdPosition } from '@/types/api.types';
import { SideBanners } from '@/components/home/side-banners';
import { useResponsive } from '@/hooks/use-responsive';

interface DesktopProfileLayoutProps {
  children: React.ReactNode;
}

export function DesktopProfileLayout({ children }: DesktopProfileLayoutProps) {
  const { isDesktop, screenWidth } = useResponsive();
  const [platformAds, setPlatformAds] = useState<PlatformAd[]>([]);
  const [isLoadingPlatformAds, setIsLoadingPlatformAds] = useState(true);

  // Fetch platform ads
  useEffect(() => {
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

  if (!isDesktop) {
    // On mobile, use View instead of ScrollView to avoid nesting with FlatList/VirtualizedList
    return (
      <View style={styles.mobileWrapper}>
        {children}
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.wrapper}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
    >
      <View style={isDesktop ? styles.desktopHomeWrapper : null}>
        {isDesktop && screenWidth >= 1300 && (
          <SideBanners
            ads={platformAds.filter(ad => ad.position === PlatformAdPosition.LEFT)}
            position={PlatformAdPosition.LEFT}
          />
        )}

        <View style={isDesktop ? styles.desktopMainContent : null}>
          <View style={styles.desktopContainer}>
            {/* Left Side - Profile Menu (Master) */}
            <ProfileSideMenu />
            
            {/* Right Side - Main Content (Child) */}
            <View style={[styles.contentArea, isDesktop && styles.contentAreaDesktop]}>
              {children}
            </View>
          </View>
        </View>

        {isDesktop && screenWidth >= 1300 && (
          <SideBanners
            ads={platformAds.filter(ad => ad.position === PlatformAdPosition.RIGHT)}
            position={PlatformAdPosition.RIGHT}
          />
        )}
      </View>
      {/* Footer at the bottom - outside centered wrapper for full width */}
      <Footer />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  mobileWrapper: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  desktopHomeWrapper: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    width: '100%',
    alignSelf: 'center',
    position: 'relative',
  },
  desktopMainContent: {
    width: '100%',
    maxWidth: 1000,
    position: 'relative',
  },
  desktopContainer: {
    flexDirection: 'row',
    maxWidth: 1000,
    marginHorizontal: 'auto',
    paddingHorizontal: 40,
    width: '100%',
    minHeight: '100%',
  },
  contentArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  contentAreaDesktop: {
    paddingTop: 40, // Increased top padding for better breathing room
    paddingLeft: 40, // Space between sidebar and content
    paddingRight: 0, // Container already has 40px horizontal padding
  },
});
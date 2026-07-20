import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Platform, Dimensions } from 'react-native';

import { SideBanners } from '@/components/home/side-banners';
import { platformAdsService } from '@/services';
import { DESKTOP_MAX_WIDTH, DESKTOP_SIDEBAR_BREAKPOINT } from '@/constants/layout';
import { PlatformAdPosition } from '@/types/api.types';
import type { PlatformAd } from '@/types/api.types';

interface DesktopContentWrapperProps {
  children: React.ReactNode;
}

export function DesktopContentWrapper({ children }: DesktopContentWrapperProps) {
  const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);
  const [platformAds, setPlatformAds] = useState<PlatformAd[]>([]);

  useEffect(() => {
    const onChange = (result: any) => {
      setScreenWidth(result.window.width);
    };
    const handler = Platform.OS === 'web'
      ? Dimensions.addEventListener('change', onChange)
      : null;
    return () => handler?.remove();
  }, []);

  useEffect(() => {
    const fetchAds = async () => {
      try {
        const response = await platformAdsService.getPlatformAds();
        if (response.success && response.data) {
          setPlatformAds(response.data);
        }
      } catch {}
    };
    fetchAds();
  }, []);

  const isDesktop = Platform.OS === 'web' && screenWidth >= 1024;

  if (!isDesktop) {
    return <>{children}</>;
  }

  const showSideBanners = screenWidth >= DESKTOP_SIDEBAR_BREAKPOINT;
  const leftAds = platformAds.filter(ad => ad.position === PlatformAdPosition.LEFT);
  const rightAds = platformAds.filter(ad => ad.position === PlatformAdPosition.RIGHT);

  return (
    <View style={styles.desktopWrapper}>
      {showSideBanners && (
        <SideBanners ads={leftAds} position={PlatformAdPosition.LEFT} />
      )}
      <View style={styles.desktopMainContent}>
        {children}
      </View>
      {showSideBanners && (
        <SideBanners ads={rightAds} position={PlatformAdPosition.RIGHT} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  desktopWrapper: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    width: '100%',
    alignSelf: 'center',
  },
  desktopMainContent: {
    width: '100%',
    maxWidth: DESKTOP_MAX_WIDTH,
  },
});

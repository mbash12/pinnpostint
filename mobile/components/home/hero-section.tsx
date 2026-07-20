import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, TouchableOpacity, View, Dimensions } from 'react-native';
import { NetworkImage } from '@/components/ui/network-image';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { settingsService, HeroSettings } from '@/services/settings.service';
import { Ad } from '@/services/ads.service';

interface HeroSectionProps {
  isDesktop: boolean;
  ads: Ad[];
}

// Standard container max width to match the rest of the page
const CONTAINER_MAX_WIDTH = 1200;

export function HeroSection({ isDesktop, ads }: HeroSectionProps) {
  const router = useRouter();
  const [heroSettings, setHeroSettings] = useState<HeroSettings>({
    title: 'Find Everything You Need',
    subtitle: 'Discover amazing deals on products and services near you',
    image: 'https://placehold.co/1920x500/CC1614/FFFFFF?text=Hero+Banner'
  });

  const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);

  useEffect(() => {
    fetchHeroSettings();

    const onChange = (result: any) => {
      setScreenWidth(result.window.width);
    };

    const dimensionsHandler = Dimensions.addEventListener('change', onChange);

    return () => {
      if (dimensionsHandler) {
        dimensionsHandler.remove();
      }
    };
  }, []);

  const fetchHeroSettings = async () => {
    try {
      const response = await settingsService.getHeroSettings();
      if (response.success && response.data) {
        setHeroSettings(response.data);
      }
    } catch (error) {
    }
  };

  const handleViewAll = () => {
    router.push('/(tabs)/browse');
  };

  if (isDesktop) {
    return (
      <View style={styles.desktopContainer}>
        {/* Top Hero Banner - Full width background */}
        <View style={styles.desktopHeroWrapper}>
          {heroSettings.image ? (
            <NetworkImage source={{ uri: heroSettings.image }} style={styles.desktopHeroImage} contentFit="cover" resizeMode="cover" />
          ) : (
            <View style={styles.desktopHeroImage} />
          )}
          <LinearGradient
            colors={['rgba(0, 0, 0, 0.5)', 'rgba(0, 0, 0, 0.7)']}
            style={styles.desktopHeroOverlay}
          />
          {/* Centered content container */}
          <View style={styles.desktopHeroContentContainer}>
            <View style={styles.desktopHeroContent}>
              <ThemedText style={styles.desktopHeroTitle}>{heroSettings.title}</ThemedText>
              <ThemedText style={styles.desktopHeroSubtitle}>{heroSettings.subtitle}</ThemedText>
              <TouchableOpacity style={styles.exploreButton} onPress={handleViewAll}>
                <ThemedText style={styles.exploreButtonText}>Explore All Listings</ThemedText>
                <MaterialIcons name="arrow-forward" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    );
  }

  // Mobile Layout
  return (
    <View style={styles.mobileContainer}>
      {/* Hero Banner */}
      <View style={styles.mobileHeroWrapper}>
        {heroSettings.image ? (
          <NetworkImage source={{ uri: heroSettings.image }} style={styles.mobileHeroImage} contentFit="cover" resizeMode="cover" />
        ) : (
          <View style={styles.mobileHeroImage} />
        )}
        <LinearGradient
          colors={['rgba(0, 0, 0, 0.3)', 'rgba(0, 0, 0, 0.6)']}
          style={styles.mobileHeroOverlay}
        />
        <View style={styles.mobileHeroContent}>
          <ThemedText style={styles.mobileHeroTitle}>{heroSettings.title}</ThemedText>
          <ThemedText style={styles.mobileHeroSubtitle}>{heroSettings.subtitle}</ThemedText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Desktop Styles
  desktopContainer: {
    width: '100%',
  },
  desktopHeroWrapper: {
    width: '100%',
    height: 420,
    position: 'relative',
  },
  desktopHeroImage: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.light.backgroundSecondary,
    // Additional properties to ensure proper cover behavior on Android
    overflow: 'hidden',
  },
  desktopHeroOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  // Centered container that matches the rest of the page
  desktopHeroContentContainer: {
    position: 'absolute',
    top: 0,
    left: '50%',
    bottom: 0,
    paddingHorizontal: 40,
    maxWidth: CONTAINER_MAX_WIDTH,
    width: '100%',
    transform: [{ translateX: '-50%' }],
  },
  desktopHeroContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  desktopHeroTitle: {
    fontSize: 48,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 16,
    textShadow: '0px 2px 10px rgba(0, 0, 0, 0.5)',
    letterSpacing: -0.5,
    maxWidth: CONTAINER_MAX_WIDTH,
  },
  desktopHeroSubtitle: {
    fontSize: 18,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 32,
    opacity: 0.95,
    textShadow: '0px 1px 4px rgba(0, 0, 0, 0.4)',
    maxWidth: CONTAINER_MAX_WIDTH,
  },
  exploreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.primary,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 30,
    gap: 10,
    boxShadow: '0px 4px 15px rgba(204, 22, 20, 0.4)',
  },
  exploreButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },

  // Mobile Styles
  mobileContainer: {
    width: '100%',
  },
  mobileHeroWrapper: {
    width: '100%',
    height: 160, // Reduced height since header space is now handled by search bar
    position: 'relative',
  },
  mobileHeroImage: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.light.backgroundSecondary,
    // Additional properties to ensure proper cover behavior on Android
    overflow: 'hidden',
  },
  mobileHeroOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  mobileHeroContent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  mobileHeroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
    textShadow: '0px 2px 8px rgba(0, 0, 0, 0.5)',
  },
  mobileHeroSubtitle: {
    fontSize: 12,
    color: '#FFFFFF',
    textAlign: 'center',
    opacity: 0.95,
    textShadow: '0px 1px 4px rgba(0, 0, 0, 0.4)',
  },
});

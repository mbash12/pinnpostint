import React, { useState } from 'react';
import { View, StyleSheet, Pressable, Linking, Platform, Modal, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { NetworkImage } from '@/components/ui/network-image';
import { ThemedText } from '@/components/themed-text';
import { PlatformAd, PlatformAdPosition } from '@/types/api.types';

interface MobilePlatformBannersProps {
  ads: PlatformAd[];
  position: 'top' | 'bottom';
  compact?: boolean;
  style?: object;
}

export function MobilePlatformBanners({ ads, position, compact, style }: MobilePlatformBannersProps) {
  const [selectedAd, setSelectedAd] = useState<PlatformAd | null>(null);
  const [isLightboxVisible, setIsLightboxVisible] = useState(false);

  const targetPosition = position === 'top' ? PlatformAdPosition.LEFT : PlatformAdPosition.RIGHT;
  const filteredAds = ads.filter(ad => ad.position === targetPosition);

  if (filteredAds.length === 0) return null;

  const handleOpenLink = (url: string | undefined) => {
    if (url) {
      if (Platform.OS === 'web') {
        window.open(url, '_blank');
      } else {
        Linking.openURL(url).catch(() => {});
      }
    }
  };

  const handlePress = (ad: PlatformAd) => {
    if (selectedAd?.id === ad.id && isLightboxVisible) {
      handleOpenLink(ad.linkUrl);
      setIsLightboxVisible(false);
      return;
    }
    setSelectedAd(ad);
    setIsLightboxVisible(true);
  };

  const isTop = position === 'top';

  return (
    <>
      <View style={[styles.container, style]}>
        <View style={compact ? styles.compactGrid : styles.grid}>
          {filteredAds.map((ad) => (
            <Pressable
              key={ad.id}
              onPress={() => handlePress(ad)}
              style={compact ? styles.compactAdPressable : styles.adPressable}
            >
              <NetworkImage
                source={{ uri: ad.imageUrl }}
                style={styles.adImage}
                contentFit="contain"
              />
            </Pressable>
          ))}
        </View>
      </View>

      <Modal
        visible={isLightboxVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsLightboxVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsLightboxVisible(false)}
        >
          <View style={styles.modalContent}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setIsLightboxVisible(false)}
            >
              <MaterialIcons name="close" size={28} color="#FFFFFF" />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => handleOpenLink(selectedAd?.linkUrl)}
              style={styles.lightboxImageWrapper}
            >
              {selectedAd && (
                <NetworkImage
                  source={{ uri: selectedAd.imageUrl }}
                  style={styles.lightboxImage}
                  contentFit="contain"
                />
              )}
              {selectedAd?.linkUrl && (
                <View style={styles.visitLinkHint}>
                  <ThemedText style={styles.visitLinkText}>Click to visit link</ThemedText>
                  <MaterialIcons name="open-in-new" size={16} color="#FFFFFF" />
                </View>
              )}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  adPressable: {
    flex: 1,
    minWidth: '45%',
    maxWidth: '48%',
    height: 180,
    overflow: 'hidden',
  },
  compactGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  compactAdPressable: {
    flex: 1,
    minWidth: '45%',
    maxWidth: '48%',
    height: 180,
    overflow: 'hidden',
  },
  adImage: {
    width: '100%',
    height: '100%',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    height: '90%',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    zIndex: 20,
    padding: 10,
  },
  lightboxImageWrapper: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lightboxImage: {
    width: '100%',
    height: '100%',
  },
  visitLinkHint: {
    position: 'absolute',
    bottom: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  visitLinkText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

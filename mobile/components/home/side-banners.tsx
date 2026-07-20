import React, { useState } from 'react';
import { View, StyleSheet, Pressable, Linking, Platform, Modal, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { NetworkImage } from '@/components/ui/network-image';
import { PlatformAd, PlatformAdPosition } from '@/types/api.types';
import { ThemedText } from '@/components/themed-text';

interface SideBannersProps {
  ads: PlatformAd[];
  position: PlatformAdPosition;
}

export function SideBanners({ ads, position }: SideBannersProps) {
  const [selectedAd, setSelectedAd] = useState<PlatformAd | null>(null);
  const [isLightboxVisible, setIsLightboxVisible] = useState(false);

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
    // If this ad is already the selected one and lightbox is open, open the link
    if (selectedAd?.id === ad.id && isLightboxVisible) {
      handleOpenLink(ad.linkUrl);
      setIsLightboxVisible(false);
      return;
    }

    // Otherwise, first click opens the lightbox
    setSelectedAd(ad);
    setIsLightboxVisible(true);
  };

  return (
    <>
      <View style={[
        styles.bannerContainer,
        position === PlatformAdPosition.LEFT ? styles.leftBanner : styles.rightBanner
      ]}>
        {ads && ads.map((ad) => (
          <Pressable
            key={ad.id}
            onPress={() => handlePress(ad)}
            style={styles.adWrapper}
          >
            <NetworkImage
              source={{ uri: ad.imageUrl }}
              style={styles.bannerImage}
              contentFit="contain"
            />
          </Pressable>
        ))}
      </View>

      {/* Lightbox Modal */}
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
            {/* Close Button */}
            <TouchableOpacity 
              style={styles.closeButton} 
              onPress={() => setIsLightboxVisible(false)}
            >
              <MaterialIcons name="close" size={28} color="#FFFFFF" />
            </TouchableOpacity>

            {/* Large Image - Click to open link */}
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
  bannerContainer: {
    width: 150,
    gap: 12,
    display: Platform.OS === 'web' ? 'flex' : 'none',
    zIndex: 10,
    ...Platform.select({
      web: {
        position: 'sticky' as any,
        top: 0,
        alignSelf: 'flex-start',
      }
    })
  },
  leftBanner: {
    marginRight: 8,
  },
  rightBanner: {
    marginLeft: 8,
  },
  adWrapper: {
    width: '100%',
    aspectRatio: 9 / 16,
    borderRadius: 8,
    overflow: 'hidden',
    cursor: 'pointer',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  // Lightbox Styles
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
    maxWidth: 800,
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

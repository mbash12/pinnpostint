import React, { useState, useRef } from 'react';
import { View, StyleSheet, Dimensions, TouchableOpacity, ScrollView, NativeSyntheticEvent, NativeScrollEvent, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { NetworkImage } from '@/components/ui/network-image';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';

const { width: screenWidth } = Dimensions.get('window');

interface DotProps {
  index: number;
  currentIndex: number;
  scrollX: any;
  imageWidth: number;
  onPress: () => void;
}

function Dot({ index, currentIndex, scrollX, imageWidth, onPress }: DotProps) {
  const animatedStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      scrollX.value,
      [
        (index - 1) * imageWidth,
        index * imageWidth,
        (index + 1) * imageWidth,
      ],
      [0.8, 1.2, 0.8],
      Extrapolation.CLAMP
    );

    const opacity = interpolate(
      scrollX.value,
      [
        (index - 1) * imageWidth,
        index * imageWidth,
        (index + 1) * imageWidth,
      ],
      [0.5, 1, 0.5],
      Extrapolation.CLAMP
    );

    return {
      transform: [{ scale }],
      opacity,
    };
  });

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Animated.View
        style={[
          styles.dot,
          index === currentIndex && styles.dotActive,
          animatedStyle,
        ]}
      />
    </TouchableOpacity>
  );
}

interface ImageCarouselProps {
  images: string[];
  imageWidth?: number;
  imageHeight?: number;
  onIndexChange?: (index: number) => void;
  showThumbnails?: boolean; // For desktop gallery view
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center' | 'repeat';
}

export function ImageCarousel({
  images,
  imageWidth = screenWidth,
  imageHeight = screenWidth * 0.8,
  onIndexChange,
  showThumbnails = false,
  resizeMode = 'cover',
}: ImageCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [containerWidth, setContainerWidth] = useState(imageWidth);
  const scrollX = useSharedValue(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const thumbnailsScrollRef = useRef<ScrollView>(null);
  const [thumbnailsOffset, setThumbnailsOffset] = useState(0);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  // Show arrows if more than 6 images
  const showArrows = images.length > 6;

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    scrollX.value = offsetX;
    
    // Update current index in real-time for better thumbnail tracking
    const index = Math.round(offsetX / containerWidth);
    if (index !== currentIndex && index >= 0 && index < images.length) {
      setCurrentIndex(index);
      if (onIndexChange) {
        onIndexChange(index);
      }
    }
  };

  const handleMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / containerWidth);
    setCurrentIndex(index);
    if (onIndexChange) {
      onIndexChange(index);
    }
  };

  const scrollToIndex = (index: number) => {
    setCurrentIndex(index);
    if (onIndexChange) {
      onIndexChange(index);
    }
    scrollViewRef.current?.scrollTo({
      x: index * containerWidth,
      animated: true,
    });
  };

  const handleThumbnailPress = (index: number) => {
    scrollToIndex(index);
  };

  const handleThumbnailsScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const offsetX = contentOffset.x;
    setThumbnailsOffset(offsetX);

    const isAtStart = offsetX <= 0;
    const isAtEnd = offsetX + layoutMeasurement.width >= contentSize.width - 1;

    setCanScrollLeft(!isAtStart);
    setCanScrollRight(!isAtEnd);
  };

  const scrollThumbnails = (direction: 'left' | 'right') => {
    const scrollAmount = 300; // Adjust scroll distance as needed
    const newOffset = direction === 'left'
      ? Math.max(0, thumbnailsOffset - scrollAmount)
      : thumbnailsOffset + scrollAmount;

    thumbnailsScrollRef.current?.scrollTo({
      x: newOffset,
      animated: true,
    });
  };

  // Mobile view with dots
  if (!showThumbnails) {
    // Show a single static image when there's only one (e.g. placeholder)
    if (images.length === 1) {
      return (
        <View style={[styles.container, { height: imageHeight }]}>
          <NetworkImage
            source={{ uri: images[0] }}
            style={{ width: '100%', height: imageHeight }}
            contentFit="cover"
            resizeMode="cover"
          />
        </View>
      );
    }

    return (
      <View style={[styles.container, { height: imageHeight }]} onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}>
        <ScrollView
          ref={scrollViewRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          onMomentumScrollEnd={handleMomentumScrollEnd}
          scrollEventThrottle={16}
          style={{ width: '100%', height: imageHeight }}
          contentContainerStyle={{ height: imageHeight }}
          decelerationRate="fast"
        >
          {images.map((image, index) => (
            <View key={index} style={{ width: containerWidth || imageWidth, height: imageHeight }}>
              <NetworkImage
                source={{ uri: image }}
                style={{ width: containerWidth || imageWidth, height: imageHeight }}
                contentFit="cover"
                resizeMode="cover"
              />
            </View>
          ))}
        </ScrollView>

        {/* Dots Indicator */}
        <View style={styles.dotsContainer}>
          {images.map((_, index) => (
            <Dot
              key={index}
              index={index}
              currentIndex={currentIndex}
              scrollX={scrollX}
              imageWidth={containerWidth || imageWidth}
              onPress={() => scrollToIndex(index)}
            />
          ))}
        </View>
      </View>
    );
  }

  // Desktop view with thumbnails
  return (
    <View style={styles.desktopContainer}>
      {/* Main Image */}
      <View style={[styles.mainImageContainer, { height: imageHeight }]}>
        {/* Show current image as static */}
        <NetworkImage
          source={{ uri: images[currentIndex] }}
          style={[
            styles.desktopImage,
            {
              height: imageHeight,
            },
          ]}
          contentFit={resizeMode}
          resizeMode={resizeMode}
        />
      </View>

      {/* Thumbnails with scroll */}
      <View style={styles.thumbnailsWrapper}>
        {/* Scrollable Thumbnails */}
        <ScrollView
          ref={thumbnailsScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.thumbnailsScrollContent}
          onScroll={handleThumbnailsScroll}
          scrollEventThrottle={16}
        >
          {images.map((image, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.thumbnail,
                index === currentIndex && styles.thumbnailActive,
              ]}
              onPress={() => handleThumbnailPress(index)}
              activeOpacity={0.8}
            >
              <NetworkImage
                source={{ uri: image }}
                style={styles.thumbnailImage}
                contentFit="cover"
                resizeMode="cover"

              />
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Absolute Left Arrow */}
        {showArrows && (
          <TouchableOpacity
            style={[styles.arrowButton, styles.arrowButtonLeft, !canScrollLeft && styles.arrowButtonDisabled]}
            onPress={() => scrollThumbnails('left')}
            disabled={!canScrollLeft}
            activeOpacity={0.7}
          >
            <MaterialIcons
              name="chevron-left"
              size={24}
              color={canScrollLeft ? '#333' : '#ccc'}
            />
          </TouchableOpacity>
        )}

        {/* Absolute Right Arrow */}
        {showArrows && (
          <TouchableOpacity
            style={[styles.arrowButton, styles.arrowButtonRight, !canScrollRight && styles.arrowButtonDisabled]}
            onPress={() => scrollThumbnails('right')}
            disabled={!canScrollRight}
            activeOpacity={0.7}
          >
            <MaterialIcons
              name="chevron-right"
              size={24}
              color={canScrollRight ? '#333' : '#ccc'}
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    width: '100%',
    overflow: 'hidden',
  },
  scrollView: {
    flex: 1,
  },
  image: {
    flex: 1,
    // Additional properties to ensure proper cover behavior on Android
    overflow: 'hidden',
  },
  dotsContainer: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  dotActive: {
    backgroundColor: '#FFFFFF',
    width: 8,
    height: 8,
  },
  // Desktop styles
  desktopContainer: {
    flexDirection: 'column',
    gap: 16,
  },
  mainImageContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  desktopImage: {
    width: '100%',
    height: '100%',
  },
  thumbnailsWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    position: 'relative',
  },
  thumbnailsScrollContent: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 4,
  },
  arrowButton: {
    position: 'absolute',
    top: '50%',
    marginTop: -18,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    zIndex: 10,
  },
  arrowButtonLeft: {
    left: 4,
  },
  arrowButtonRight: {
    right: 4,
  },
  arrowButtonDisabled: {
    opacity: 0.4,
  },
  thumbnailsContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 4,
  },
  thumbnail: {
    width: 80,
    height: 60,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  thumbnailActive: {
    borderColor: '#007AFF',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
});
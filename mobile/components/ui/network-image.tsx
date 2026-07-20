/**
 * Network Image Component
 * Automatically transforms localhost URLs for Android emulators
 * Wraps expo-image with device-specific URL handling for network images
 */

import { Image as ExpoImage, ImageProps as ExpoImageProps } from 'expo-image';
import { transformImageUrl } from '@/utils';

export interface NetworkImageProps extends ExpoImageProps {
  // Inherits all expo-image props
}

export function NetworkImage({ source, ...props }: NetworkImageProps) {
  // Transform the source URL if it's a string
  let transformedSource = source;

  if (source && typeof source === 'object' && 'uri' in source) {
    transformedSource = {
      ...source,
      uri: transformImageUrl(source.uri),
    };
  } else if (typeof source === 'string') {
    transformedSource = transformImageUrl(source);
  }

  return <ExpoImage source={transformedSource} {...props} />;
}

export default NetworkImage;

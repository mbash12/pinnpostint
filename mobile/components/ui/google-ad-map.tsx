import React from 'react';
import { GoogleMap } from './google-map';

interface GoogleAdMapProps {
  latitude: number;
  longitude: number;
  height?: number;
}

export function GoogleAdMap({
  latitude,
  longitude,
  height = 200,
}: GoogleAdMapProps) {
  return (
    <GoogleMap
      latitude={latitude}
      longitude={longitude}
      height={height}
      interactive={false}
    />
  );
}

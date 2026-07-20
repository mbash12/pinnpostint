"use client";

import React from 'react';
import { LeafletMapView } from '../forms/leaflet-map-view';

interface DynamicMapViewProps {
  latitude: number;
  longitude: number;
  height?: number | string;
  interactive?: boolean;
  onLocationSelect?: (location: {
    latitude: number;
    longitude: number;
    address?: any;
    displayName?: string;
  }) => void;
  onMapReady?: () => void;
  zoom?: number;
}

/**
 * Dynamic map view component that switches between Google Maps and Leaflet (OSM)
 * based on the MAP_PROVIDER environment variable.
 * Wraps LeafletMapView which now handles the provider switching internally.
 */
export function DynamicMapView(props: DynamicMapViewProps) {
  return <LeafletMapView {...props} />;
}

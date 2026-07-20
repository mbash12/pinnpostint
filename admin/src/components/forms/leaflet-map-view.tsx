"use client";

import React from 'react';
import { GoogleMapView } from './google-map-view';
import dynamic from 'next/dynamic';
import config from '../../config/environment';

// Dynamically import Leaflet components with SSR disabled
const LeafletMapViewImpl = dynamic(
  () => import('./leaflet-map-view-impl').then((mod) => mod.LeafletMapViewImpl),
  { ssr: false }
);

interface LeafletMapViewProps {
    latitude: number;
    longitude: number;
    height?: number | string;
    zoom?: number;
}

/**
 * Dynamic map component that switches between Google Maps and Leaflet (OSM)
 * based on the MAP_PROVIDER environment variable.
 */
export function LeafletMapView(props: LeafletMapViewProps) {
    if (config.external.mapProvider === 'google') {
        return <GoogleMapView {...props} />;
    } else {
        return <LeafletMapViewImpl {...props} />;
    }
}

"use client";

import React from 'react';
import { GoogleLocationPicker } from './google-location-picker';
import dynamic from 'next/dynamic';
import config from '../../config/environment';

// Dynamically import Leaflet components with SSR disabled
const LeafletLocationPickerImpl = dynamic(
    () => import('./leaflet-location-picker-impl').then((mod) => mod.LeafletLocationPickerImpl),
    { ssr: false }
);

export interface AdLocation {
    latitude: number;
    longitude: number;
    address: {
        road?: string;
        house_number?: string;
        city?: string;
        state?: string;
        country: string;
        postalCode?: string;
        formatted: string;
    };
    displayName: string;
}

interface LeafletLocationPickerProps {
    value?: AdLocation;
    onChange: (location: AdLocation) => void;
    error?: string;
    height?: number;
    label?: string;
    isRequired?: boolean;
}

/**
 * Dynamic location picker component that switches between Google Maps and Leaflet (OSM)
 * based on the MAP_PROVIDER environment variable.
 */
export function LeafletLocationPicker(props: LeafletLocationPickerProps) {
    if (config.external.mapProvider === 'google') {
        return <GoogleLocationPicker {...props} />;
    } else {
        return <LeafletLocationPickerImpl {...props} />;
    }
}

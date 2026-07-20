"use client";

import React from 'react';
import { LeafletLocationPicker, AdLocation } from '../forms/leaflet-location-picker';

export type { AdLocation };

interface DynamicLocationPickerProps {
    value?: AdLocation;
    onChange: (location: AdLocation) => void;
    error?: string;
    height?: number;
    label?: string;
    isRequired?: boolean;
    showSearch?: boolean;
}

/**
 * Dynamic location picker component that switches between Google Maps and Leaflet (OSM)
 * based on the MAP_PROVIDER environment variable.
 * Wraps LeafletLocationPicker which now handles the provider switching internally.
 */
export function DynamicLocationPicker(props: DynamicLocationPickerProps) {
    return <LeafletLocationPicker {...props} />;
}

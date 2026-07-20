"use client";

import React from 'react';
import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api';
import { Loader2 } from 'lucide-react';
import { GOOGLE_MAPS_LOADER_CONFIG } from '@/config/google-maps';

interface GoogleMapViewProps {
    latitude: number;
    longitude: number;
    height?: number | string;
    zoom?: number;
}

const containerStyle = {
    width: '100%',
    height: '100%'
};

export function GoogleMapView({
    latitude,
    longitude,
    height = 300,
    zoom = 13,
}: GoogleMapViewProps) {
    const { isLoaded } = useJsApiLoader(GOOGLE_MAPS_LOADER_CONFIG);

    const center = {
        lat: latitude,
        lng: longitude
    };

    return (
        <div className="relative z-0 w-full rounded-xl border border-secondary bg-secondary overflow-hidden shadow-sm" style={{ height }}>
            {!isLoaded ? (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-secondary/50 backdrop-blur-sm">
                    <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
                </div>
            ) : (
                <GoogleMap
                    mapContainerStyle={containerStyle}
                    center={center}
                    zoom={zoom}
                    options={{
                        zoomControl: true,
                        streetViewControl: false,
                        mapTypeControl: false,
                        fullscreenControl: false,
                    }}
                >
                    <Marker position={center} />
                </GoogleMap>
            )}
        </div>
    );
}

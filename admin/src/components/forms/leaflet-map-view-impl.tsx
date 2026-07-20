"use client";

import React, { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';

interface LeafletMapViewImplProps {
    latitude: number;
    longitude: number;
    height?: number | string;
    zoom?: number;
}

export function LeafletMapViewImpl({
    latitude,
    longitude,
    height = 300,
    zoom = 13,
}: LeafletMapViewImplProps) {
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstance = useRef<any>(null);
    const markerInstance = useRef<any>(null);
    const [leaflet, setLeaflet] = useState<any>(null);

    useEffect(() => {
        // Load leaflet only on client
        import('leaflet').then((L) => {
            setLeaflet(L);
        });
    }, []);

    useEffect(() => {
        if (!mapRef.current || !leaflet) return;

        const L = leaflet;

        // Initialize map if it doesn't exist
        if (!mapInstance.current) {
            mapInstance.current = L.map(mapRef.current).setView([latitude, longitude], zoom);

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(mapInstance.current);

            // Create custom icon to avoid 404 errors with default paths
            const defaultIcon = L.icon({
                iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
                iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
                shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
                shadowSize: [41, 41]
            });

            markerInstance.current = L.marker([latitude, longitude], { icon: defaultIcon }).addTo(mapInstance.current);

            // Force map to recalculate size to fix "single square" loading issue
            // Using multiple delays to ensure it works across different network/render speeds
            [100, 500, 1000].forEach(delay => {
                setTimeout(() => {
                    if (mapInstance.current) {
                        mapInstance.current.invalidateSize();
                    }
                }, delay);
            });
        } else {
            // Update existing map
            mapInstance.current.setView([latitude, longitude], zoom);
            if (markerInstance.current) {
                markerInstance.current.setLatLng([latitude, longitude]);
            }
            // Also invalidate on updates
            mapInstance.current.invalidateSize();
        }

        // Cleanup on unmount
        return () => {
            if (mapInstance.current) {
                mapInstance.current.remove();
                mapInstance.current = null;
            }
        };
    }, [latitude, longitude, zoom, leaflet]);

    return (
        <div 
            ref={mapRef} 
            className="relative z-0 w-full rounded-xl border border-secondary bg-secondary overflow-hidden shadow-sm" 
            style={{ height }}
        />
    );
}

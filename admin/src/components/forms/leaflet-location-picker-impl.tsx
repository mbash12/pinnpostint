"use client";

import React, { useState, useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import { Search, MapPin, X, Loader2, Navigation } from 'lucide-react';
import { nominatimService } from '@/utils/nominatim';
import { cx } from '@/utils/cx';

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

interface LeafletLocationPickerImplProps {
    value?: AdLocation;
    onChange: (location: AdLocation) => void;
    error?: string;
    height?: number;
    label?: string;
    isRequired?: boolean;
}

export function LeafletLocationPickerImpl({
    value,
    onChange,
    error,
    height = 400,
    label = "Location",
    isRequired = false,
}: LeafletLocationPickerImplProps) {
    const [searchQuery, setSearchQuery] = useState(value?.displayName ?? '');
    const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [showResults, setShowResults] = useState(false);

    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstance = useRef<any>(null);
    const markerInstance = useRef<any>(null);
    const [leaflet, setLeaflet] = useState<any>(null);

    const lat = value?.latitude || 28.6139;
    const lng = value?.longitude || 77.2090;

    useEffect(() => {
        // Load leaflet only on client
        import('leaflet').then((L) => {
            setLeaflet(L);
        });
    }, []);

    // Initialize map
    useEffect(() => {
        if (!mapRef.current || !leaflet) return;

        const L = leaflet;

        if (!mapInstance.current) {
            mapInstance.current = L.map(mapRef.current).setView([lat, lng], 13);

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

            markerInstance.current = L.marker([lat, lng], { draggable: true, icon: defaultIcon }).addTo(mapInstance.current);

            // Force map to recalculate size to fix "single square" loading issue
            [100, 500, 1000].forEach(delay => {
                setTimeout(() => {
                    if (mapInstance.current) {
                        mapInstance.current.invalidateSize();
                    }
                }, delay);
            });

            // Click on map to select location
            mapInstance.current.on('click', (e: any) => {
                const { lat, lng } = e.latlng;
                handleLocationUpdate(lat, lng);
            });

            // Drag marker to select location
            markerInstance.current.on('dragend', (e: any) => {
                const marker = e.target;
                const position = marker.getLatLng();
                handleLocationUpdate(position.lat, position.lng);
            });
        }

        return () => {
            if (mapInstance.current) {
                mapInstance.current.remove();
                mapInstance.current = null;
            }
        };
    }, [leaflet]);

    // Update map when value changes
    useEffect(() => {
        if (mapInstance.current && markerInstance.current) {
            mapInstance.current.setView([lat, lng]);
            markerInstance.current.setLatLng([lat, lng]);
            mapInstance.current.invalidateSize();
        }
    }, [lat, lng]);

    const handleLocationUpdate = async (lat: number, lng: number) => {
        setIsReverseGeocoding(true);
        try {
            const result = await nominatimService.reverseGeocode(lat, lng);
            if (result) {
                const newLocation: AdLocation = {
                    latitude: lat,
                    longitude: lng,
                    address: {
                        road: result.address.road,
                        house_number: result.address.house_number,
                        city: result.address.city,
                        state: result.address.state,
                        country: result.address.country,
                        postalCode: result.address.postalCode,
                        formatted: result.displayName,
                    },
                    displayName: result.displayName ?? '',
                };
                onChange(newLocation);
                setSearchQuery(result.displayName ?? '');
            }
        } catch (err) {
            console.error('Error updating location:', err);
        } finally {
            setIsReverseGeocoding(false);
            setShowResults(false);
        }
    };

    const handleSearch = async (query: string) => {
        const safeQuery = query ?? '';
        setSearchQuery(safeQuery);
        if (safeQuery.length < 3) {
            setSearchResults([]);
            setShowResults(false);
            return;
        }

        setIsSearching(true);
        try {
            const results = await nominatimService.searchLocations(safeQuery, 5);
            setSearchResults(results ?? []);
            setShowResults(true);
        } catch (err) {
            console.error('Error searching:', err);
            setSearchResults([]);
        } finally {
            setIsSearching(false);
        }
    };

    const useCurrentLocation = () => {
        if (typeof window === 'undefined' || !navigator.geolocation) return;

        setIsReverseGeocoding(true);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                handleLocationUpdate(position.coords.latitude, position.coords.longitude);
            },
            (err) => {
                setIsReverseGeocoding(false);
            }
        );
    };

    const selectSearchResult = (result: any) => {
        const lat = parseFloat(result.lat);
        const lon = parseFloat(result.lon);
        
        const newLocation: AdLocation = {
            latitude: lat,
            longitude: lon,
            address: {
                road: result.address?.road,
                house_number: result.address?.house_number,
                city: result.address?.city || result.address?.town || result.address?.village,
                state: result.address?.state,
                country: result.address?.country || 'India',
                postalCode: result.address?.postcode,
                formatted: result.display_name,
            },
            displayName: result.display_name ?? '',
        };
        
        onChange(newLocation);
        setSearchQuery(result.display_name ?? '');
        setShowResults(false);
        
        if (mapInstance.current) {
            mapInstance.current.setView([lat, lon], 13);
        }
    };

    return (
        <div className="flex flex-col gap-2 w-full">
            {label && (
                <label className="text-sm font-medium text-primary">
                    {label} {(isRequired || error) && <span className="text-error ml-1">*</span>}
                </label>
            )}

            <div className="relative z-50">
                <div className={cx(
                    "relative flex items-center rounded-lg border bg-primary px-3 py-2 shadow-sm transition-all focus-within:ring-2 focus-within:ring-brand-500",
                    error ? "border-error" : "border-secondary focus-within:border-brand-500"
                )}>
                    <Search className="mr-2 h-4 w-4 text-tertiary" />
                    <input
                        type="text"
                        className="flex-1 bg-transparent text-sm outline-none placeholder:text-tertiary"
                        placeholder="Search for an address (OSM)..."
                        value={searchQuery || ''}
                        onChange={(e) => handleSearch(e.target.value)}
                        onFocus={() => { if ((searchResults?.length ?? 0) > 0) setShowResults(true); }}
                    />
                    {isSearching && <Loader2 className="h-4 w-4 animate-spin text-tertiary" />}
                    {(searchQuery?.length ?? 0) > 0 && !isSearching && (
                        <button
                            type="button"
                            onClick={() => { setSearchQuery(''); setSearchResults([]); setShowResults(false); }}
                            className="ml-2 hover:text-primary text-tertiary"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>

                {showResults && (searchResults?.length ?? 0) > 0 && (
                    <div className="absolute top-full left-0 right-0 z-[1001] mt-1 max-h-60 overflow-auto rounded-lg border border-secondary bg-white shadow-xl">
                        {(searchResults ?? []).map((result, index) => (
                            <button
                                key={index}
                                type="button"
                                onClick={() => selectSearchResult(result)}
                                className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-none"
                            >
                                <MapPin className="mt-1 h-4 w-4 shrink-0 text-tertiary" />
                                <span className="text-sm text-primary">{result.display_name}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Map Container */}
            <div className="relative z-0 w-full rounded-xl border border-secondary bg-secondary overflow-hidden shadow-inner" style={{ height }}>
                <div ref={mapRef} style={{ height: '100%', width: '100%' }} />
                
                {isReverseGeocoding && (
                    <div className="absolute top-4 left-1/2 z-[1000] -translate-x-1/2 flex items-center gap-2 rounded-full bg-white/95 px-4 py-2 shadow-lg border border-secondary transition-all animate-in fade-in slide-in-from-top-2">
                        <Loader2 className="h-3 w-3 animate-spin text-brand-500" />
                        <span className="text-xs font-semibold text-brand-500">Updating location...</span>
                    </div>
                )}

                <button
                    type="button"
                    onClick={useCurrentLocation}
                    className="absolute bottom-6 right-6 z-[1000] flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-xl hover:bg-gray-50 active:scale-95 transition-all text-brand-500"
                    title="Use current location"
                >
                    <Navigation className="h-5 w-5" />
                </button>
            </div>

            {error && <p className="text-xs font-medium text-error mt-1">{error}</p>}
        </div>
    );
}

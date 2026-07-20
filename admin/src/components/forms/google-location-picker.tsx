"use client";

import React, { useState, useCallback } from 'react';
import { GoogleMap, useJsApiLoader, Marker, Autocomplete } from '@react-google-maps/api';
import { Search, MapPin, X, Loader2, Navigation } from 'lucide-react';
import { googleMapsService } from '@/utils/google-maps';
import { cx } from '@/utils/cx';
import { GOOGLE_MAPS_LOADER_CONFIG } from '@/config/google-maps';

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

interface GoogleLocationPickerProps {
    value?: AdLocation;
    onChange: (location: AdLocation) => void;
    error?: string;
    height?: number;
    label?: string;
    isRequired?: boolean;
}

const containerStyle = {
    width: '100%',
    height: '100%'
};

export function GoogleLocationPicker({
    value,
    onChange,
    error,
    height = 400,
    label = "Location",
    isRequired = false,
}: GoogleLocationPickerProps) {
    const [searchQuery, setSearchQuery] = useState(value?.displayName || '');
    const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
    const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);

    const { isLoaded } = useJsApiLoader(GOOGLE_MAPS_LOADER_CONFIG);

    const center = {
        lat: value?.latitude || 28.6139,
        lng: value?.longitude || 77.2090
    };

    const onLoad = useCallback((autocompleteInstance: google.maps.places.Autocomplete) => {
        setAutocomplete(autocompleteInstance);
    }, []);

    const onPlaceChanged = () => {
        if (autocomplete !== null) {
            const place = autocomplete.getPlace();
            if (place.geometry && place.geometry.location) {
                const lat = place.geometry.location.lat();
                const lng = place.geometry.location.lng();
                handleLocationUpdate(lat, lng, true);
            }
        }
    };

    const handleLocationUpdate = async (lat: number, lng: number, shouldGeocode: boolean) => {
        setIsReverseGeocoding(true);
        try {
            const result = await googleMapsService.reverseGeocode(lat, lng);
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
                    displayName: result.displayName,
                };
                onChange(newLocation);
                setSearchQuery(result.displayName);
            }
        } catch (err) {
            console.error('Error updating location:', err);
        } finally {
            setIsReverseGeocoding(false);
        }
    };

    const useCurrentLocation = () => {
        if (!navigator.geolocation) return;

        setIsReverseGeocoding(true);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                handleLocationUpdate(position.coords.latitude, position.coords.longitude, true);
            },
            (err) => {
                setIsReverseGeocoding(false);
            }
        );
    };

    return (
        <div className="flex flex-col gap-2 w-full">
            {label && (
                <label className="text-sm font-medium text-primary">
                    {label} {(isRequired || error) && <span className="text-error ml-1">*</span>}
                </label>
            )}

            <div className="relative z-50">
                {isLoaded && (
                    <Autocomplete
                        onLoad={onLoad}
                        onPlaceChanged={onPlaceChanged}
                        options={{ componentRestrictions: { country: 'in' } }}
                    >
                        <div className={cx(
                            "relative flex items-center rounded-lg border bg-primary px-3 py-2 shadow-sm transition-all focus-within:ring-2 focus-within:ring-brand-500",
                            error ? "border-error" : "border-secondary focus-within:border-brand-500"
                        )}>
                            <Search className="mr-2 h-4 w-4 text-tertiary" />
                            <input
                                type="text"
                                className="flex-1 bg-transparent text-sm outline-none placeholder:text-tertiary"
                                placeholder="Search for an address..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            {searchQuery.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => { setSearchQuery(''); }}
                                    className="ml-2 hover:text-primary text-tertiary"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                    </Autocomplete>
                )}
            </div>

            {/* Map Container */}
            <div className="relative z-0 w-full rounded-xl border border-secondary bg-secondary overflow-hidden shadow-inner" style={{ height }}>
                {!isLoaded ? (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-secondary/50 backdrop-blur-sm">
                        <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
                        <span className="mt-2 text-sm font-medium text-tertiary">Loading Google Maps...</span>
                    </div>
                ) : (
                    <>
                        {isReverseGeocoding && (
                            <div className="absolute top-4 left-1/2 z-[1000] -translate-x-1/2 flex items-center gap-2 rounded-full bg-white/95 px-4 py-2 shadow-lg border border-secondary transition-all animate-in fade-in slide-in-from-top-2">
                                <Loader2 className="h-3 w-3 animate-spin text-brand-500" />
                                <span className="text-xs font-semibold text-brand-500">Updating location...</span>
                            </div>
                        )}

                        <GoogleMap
                            mapContainerStyle={containerStyle}
                            center={center}
                            zoom={13}
                            onClick={(e) => {
                                if (e.latLng) {
                                    handleLocationUpdate(e.latLng.lat(), e.latLng.lng(), true);
                                }
                            }}
                            options={{
                                zoomControl: true,
                                streetViewControl: false,
                                mapTypeControl: false,
                                fullscreenControl: false,
                            }}
                        >
                            <Marker
                                position={center}
                                draggable={true}
                                onDragEnd={(e) => {
                                    if (e.latLng) {
                                        handleLocationUpdate(e.latLng.lat(), e.latLng.lng(), true);
                                    }
                                }}
                            />
                        </GoogleMap>

                        <button
                            type="button"
                            onClick={useCurrentLocation}
                            className="absolute bottom-6 right-6 z-[1000] flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-xl hover:bg-gray-50 active:scale-95 transition-all text-brand-500"
                            title="Use current location"
                        >
                            <Navigation className="h-5 w-5" />
                        </button>
                    </>
                )}
            </div>

            {error && <p className="text-xs font-medium text-error mt-1">{error}</p>}
        </div>
    );
}

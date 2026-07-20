import { LocationSuggestion } from './nominatim';

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

/**
 * Search locations using Google Places API (Text Search)
 */
export async function searchLocations(
    query: string,
    limit: number = 5
): Promise<LocationSuggestion[]> {
    if (!query || query.trim().length < 2) {
        return [];
    }

    if (!GOOGLE_MAPS_API_KEY || GOOGLE_MAPS_API_KEY === 'your_google_maps_api_key') {
        console.warn('Google Maps API Key not configured');
        return [];
    }

    try {
        const params = new URLSearchParams({
            query: query,
            key: GOOGLE_MAPS_API_KEY,
            language: 'en',
            region: 'in', // Limit to India
        });

        const response = await fetch(
            `https://maps.googleapis.com/maps/api/place/textsearch/json?${params.toString()}`
        );

        if (!response.ok) {
            throw new Error(`Google Places API error: ${response.status}`);
        }

        const data = await response.json();

        if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
            throw new Error(`Google Places API status: ${data.status}`);
        }

        const results = data.results.slice(0, limit);

        return results.map((item: any) => {
            const addressComponents = parseFormattedAddress(item.formatted_address);

            return {
                id: `google_${item.place_id}`,
                name: item.name,
                displayName: item.formatted_address,
                latitude: item.geometry.location.lat,
                longitude: item.geometry.location.lng,
                address: {
                    city: addressComponents.city,
                    state: addressComponents.state,
                    country: 'IN',
                    postalCode: addressComponents.postalCode,
                    formatted: item.formatted_address,
                },
                type: item.types?.[0],
            };
        });
    } catch (error) {
        console.error('Error searching Google Places:', error);
        return [];
    }
}

/**
 * Reverse geocode to get location name from coordinates using Google Geocoding API
 */
export async function reverseGeocode(
    lat: number,
    lon: number
): Promise<LocationSuggestion | null> {
    if (!GOOGLE_MAPS_API_KEY || GOOGLE_MAPS_API_KEY === 'your_google_maps_api_key') {
        console.warn('Google Maps API Key not configured');
        return null;
    }

    try {
        const params = new URLSearchParams({
            latlng: `${lat},${lon}`,
            key: GOOGLE_MAPS_API_KEY,
            language: 'en',
        });

        const response = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`
        );

        if (!response.ok) {
            throw new Error(`Google Geocoding API error: ${response.status}`);
        }

        const data = await response.json();

        if (data.status !== 'OK') {
            throw new Error(`Google Geocoding API status: ${data.status}`);
        }

        const item = data.results[0];
        const addressDetails = extractAddressComponents(item.address_components);

        return {
            id: `google_${item.place_id}`,
            name: addressDetails.name || item.formatted_address.split(',')[0],
            displayName: item.formatted_address,
            latitude: item.geometry.location.lat,
            longitude: item.geometry.location.lng,
            address: {
                city: addressDetails.city,
                state: addressDetails.state,
                country: addressDetails.country || 'IN',
                postalCode: addressDetails.postalCode,
                formatted: item.formatted_address,
                road: addressDetails.road,
                house_number: addressDetails.houseNumber,
            },
            type: item.types?.[0],
        };
    } catch (error) {
        console.error('Error reverse geocoding Google:', error);
        return null;
    }
}

function extractAddressComponents(components: any[]) {
    const result: any = {};

    for (const component of components) {
        const types = component.types;

        if (types.includes('locality')) {
            result.city = component.long_name;
        } else if (types.includes('administrative_area_level_1')) {
            result.state = component.long_name;
        } else if (types.includes('country')) {
            result.country = component.short_name;
        } else if (types.includes('postal_code')) {
            result.postalCode = component.long_name;
        } else if (types.includes('route')) {
            result.road = component.long_name;
        } else if (types.includes('street_number')) {
            result.houseNumber = component.long_name;
        } else if (types.includes('point_of_interest') || types.includes('establishment')) {
            result.name = component.long_name;
        }
    }

    return result;
}

function parseFormattedAddress(formatted: string) {
    const parts = formatted.split(',').map(p => p.trim());
    const result: any = {
        city: '',
        state: '',
        postalCode: '',
    };

    if (parts.length >= 3) {
        result.city = parts[parts.length - 3];
        const stateZip = parts[parts.length - 2].split(' ');
        if (stateZip.length >= 2) {
            result.postalCode = stateZip[stateZip.length - 1];
            result.state = stateZip.slice(0, -1).join(' ');
        } else {
            result.state = stateZip[0];
        }
    }

    return result;
}

export const googleMapsService = {
    searchLocations,
    reverseGeocode,
};

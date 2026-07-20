import config from '../config/environment';

export interface LocationSuggestion {
    id: string;
    name: string;
    displayName: string;
    latitude: number;
    longitude: number;
    address: {
        city?: string;
        state?: string;
        country: string;
        postalCode?: string;
        formatted: string;
        road?: string;
        house_number?: string;
    };
    type: string;
    osmType?: string;
    osmId?: number;
}

/**
 * Search locations using Nominatim (OpenStreetMap)
 */
export async function searchLocations(
    query: string,
    limit: number = 5
): Promise<LocationSuggestion[]> {
    if (!query || query.trim().length < 2) {
        return [];
    }

    try {
        const params = new URLSearchParams({
            q: query,
            format: 'json',
            addressdetails: '1',
            limit: limit.toString(),
            countrycodes: 'in', // Limit to India
        });

        const response = await fetch(
            `${config.external.osm.nominatimBaseUrl}/search?${params.toString()}`,
            {
                headers: {
                    'User-Agent': 'PinNPost/1.0',
                },
            }
        );

        if (!response.ok) {
            throw new Error(`Nominatim API error: ${response.status}`);
        }

        const data = await response.json();

        return data.map((item: any) => ({
            id: `osm_${item.osm_type}${item.osm_id}`,
            name: item.display_name.split(',')[0] || item.display_name,
            displayName: item.display_name,
            latitude: parseFloat(item.lat),
            longitude: parseFloat(item.lon),
            address: {
                city: item.address?.city || item.address?.town || item.address?.village || '',
                state: item.address?.state || '',
                country: item.address?.country_code || 'IN',
                postalCode: item.address?.postcode || '',
                formatted: item.display_name,
                road: item.address?.road,
                house_number: item.address?.house_number,
            },
            type: item.type,
            osmType: item.osm_type,
            osmId: item.osm_id,
        }));
    } catch (error) {
        console.error('Error searching Nominatim:', error);
        return [];
    }
}

/**
 * Reverse geocode to get location name from coordinates using Nominatim
 */
export async function reverseGeocode(
    lat: number,
    lon: number
): Promise<LocationSuggestion | null> {
    try {
        const params = new URLSearchParams({
            format: 'json',
            lat: lat.toString(),
            lon: lon.toString(),
            addressdetails: '1',
        });

        const response = await fetch(
            `${config.external.osm.nominatimBaseUrl}/reverse?${params.toString()}`,
            {
                headers: {
                    'User-Agent': 'PinNPost/1.0',
                },
            }
        );

        if (!response.ok) {
            throw new Error(`Nominatim API error: ${response.status}`);
        }

        const data = await response.json();

        if (!data || data.error) {
            return null;
        }

        return {
            id: `osm_${data.osm_type}${data.osm_id}`,
            name: data.display_name.split(',')[0] || data.display_name,
            displayName: data.display_name,
            latitude: parseFloat(data.lat),
            longitude: parseFloat(data.lon),
            address: {
                city: data.address?.city || data.address?.town || data.address?.village || '',
                state: data.address?.state || '',
                country: data.address?.country_code || 'IN',
                postalCode: data.address?.postcode || '',
                formatted: data.display_name,
                road: data.address?.road,
                house_number: data.address?.house_number,
            },
            type: data.type,
            osmType: data.osm_type,
            osmId: data.osm_id,
        };
    } catch (error) {
        console.error('Error reverse geocoding Nominatim:', error);
        return null;
    }
}

export const nominatimService = {
    searchLocations,
    reverseGeocode,
};

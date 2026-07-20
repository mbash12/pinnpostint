import { LocationSuggestion } from '@/types/location.types';
import config from '@/config/environment';

/**
 * Search locations using Google Places API via Backend Proxy (Avoids CORS on Web)
 */
export async function searchLocations(
  query: string,
  limit: number = 5
): Promise<LocationSuggestion[]> {
  if (!query || query.trim().length < 2) {
    return [];
  }

  try {
    const response = await fetch(
      `${config.api.baseUrl}/public/places/autocomplete?input=${encodeURIComponent(query)}`
    );

    if (!response.ok) {
      throw new Error(`Proxy API error: ${response.status}`);
    }

    const json = await response.json();
    const results = json.data || [];

    return results.slice(0, limit).map((item: any) => ({
      id: `google_${item.place_id}`,
      name: item.structured_formatting.main_text,
      displayName: item.description,
      latitude: 0, 
      longitude: 0,
      address: {
        formatted: item.description,
        country: 'IN',
      },
      type: item.types?.[0],
      placeId: item.place_id,
    }));
  } catch (error) {
    console.error('Error searching Google Places via Proxy:', error);
    return [];
  }
}

/**
 * Get full place details including coordinates via Backend Proxy
 */
export async function getPlaceDetails(placeId: string): Promise<LocationSuggestion | null> {
  try {
    const response = await fetch(
      `${config.api.baseUrl}/public/places/details?placeId=${encodeURIComponent(placeId)}`
    );

    if (!response.ok) {
      throw new Error(`Proxy API error: ${response.status}`);
    }

    const json = await response.json();
    const result = json.data;

    if (!result) return null;

    const addressDetails = extractAddressComponents(result.address_components);

    return {
      id: `google_${placeId}`,
      name: result.formatted_address || result.name || '',
      displayName: result.formatted_address,
      latitude: result.geometry.location.lat,
      longitude: result.geometry.location.lng,
      address: {
        city: addressDetails.city,
        state: addressDetails.state,
        country: addressDetails.country || 'IN',
        postalCode: addressDetails.postalCode,
        formatted: result.formatted_address,
        road: addressDetails.road,
        house_number: addressDetails.houseNumber,
      },
      type: result.types?.[0],
    };
  } catch (error) {
    console.error('Error fetching place details via Proxy:', error);
    return null;
  }
}

/**
 * Reverse geocode via Backend Proxy
 */
export async function reverseGeocode(
  lat: number,
  lon: number
): Promise<LocationSuggestion | null> {
  try {
    const response = await fetch(
      `${config.api.baseUrl}/public/places/reverse-geocode?lat=${lat}&lng=${lon}`
    );

    if (!response.ok) {
      throw new Error(`Proxy API error: ${response.status}`);
    }

    const json = await response.json();
    const results = json.data || [];

    if (results.length === 0) return null;

    const item = pickBestReverseGeocodeResult(results);
    if (!item) return null;
    const addressDetails = extractAddressComponents(item.address_components);

    return {
      id: `google_${item.place_id}`,
      name: item.formatted_address || addressDetails.name || '',
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
    console.error('Error reverse geocoding via Proxy:', error);
    return null;
  }
}

function pickBestReverseGeocodeResult(results: any[]): any | null {
  if (!Array.isArray(results) || results.length === 0) {
    return null;
  }

  const scoreResult = (result: any): number => {
    const types: string[] = Array.isArray(result?.types) ? result.types : [];
    const addressComponents: any[] = Array.isArray(result?.address_components) ? result.address_components : [];

    let score = 0;

    // Prefer human-friendly, mappable results.
    if (types.includes('street_address')) score += 120;
    if (types.includes('premise')) score += 110;
    if (types.includes('subpremise')) score += 105;
    if (types.includes('route')) score += 100;
    if (types.includes('neighborhood')) score += 90;
    if (types.includes('sublocality') || types.includes('sublocality_level_1')) score += 85;
    if (types.includes('locality')) score += 80;
    if (types.includes('administrative_area_level_4')) score += 70;
    if (types.includes('administrative_area_level_3')) score += 60;
    if (types.includes('administrative_area_level_2')) score += 40;

    // De-prioritize coarse or machine-oriented results.
    if (types.includes('plus_code')) score -= 300;
    if (types.includes('postal_code')) score -= 80;
    if (types.includes('country')) score -= 120;

    // Penalize formatted addresses that still start with a plus code.
    const formattedAddress = String(result?.formatted_address || '').trim();
    if (/^[A-Z0-9]{4,}\+[A-Z0-9]{2,}/i.test(formattedAddress)) {
      score -= 120;
    }

    // Reward entries with route/street_number components.
    const hasRoute = addressComponents.some(component => component?.types?.includes('route'));
    const hasStreetNumber = addressComponents.some(component => component?.types?.includes('street_number'));
    if (hasRoute) score += 40;
    if (hasStreetNumber) score += 30;

    return score;
  };

  const sorted = [...results].sort((a, b) => scoreResult(b) - scoreResult(a));
  return sorted[0] || null;
}

/**
 * Enrich location with coordinates from place details
 * This should be called when user selects a place from autocomplete
 */
export async function enrichPlaceDetails(
  location: LocationSuggestion
): Promise<LocationSuggestion> {
  // If it's a Google place and has a placeId, fetch full details
  if (location.placeId && location.placeId.startsWith('google_')) {
    const placeId = location.placeId.replace('google_', '');
    const details = await getPlaceDetails(placeId);
    if (details) {
      return details;
    }
  }

  return location;
}

/**
 * Extract structured address components from Google response
 */
function extractAddressComponents(components: any[]) {
  const result: any = {};
  
  if (!components) return result;

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

export const googleMapsService = {
  searchLocations,
  reverseGeocode,
  getPlaceDetails,
  enrichPlaceDetails, // Export the enrichment function
};

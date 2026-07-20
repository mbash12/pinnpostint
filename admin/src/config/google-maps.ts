import { Library } from '@googlemaps/js-api-loader';

export const GOOGLE_MAPS_LIBRARIES: Library[] = ['places'];

export const GOOGLE_MAPS_LOADER_CONFIG = {
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries: GOOGLE_MAPS_LIBRARIES,
};

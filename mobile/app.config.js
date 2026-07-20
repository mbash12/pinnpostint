const path = require('path');
const dotenv = require('dotenv');

// Per-app: only mobile/.env + mobile/.env.local (from ./pinn env:sync)
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '.env.local'), override: true });

// Helper to get env var with fallback
const getEnv = (key, fallback) => process.env[key] || fallback;

module.exports = function ({ config }) {
  const googleMapsApiKey = getEnv('EXPO_PUBLIC_GOOGLE_MAPS_API_KEY', '');
  
  if (googleMapsApiKey) {
    config.android = {
      ...config.android,
      config: {
        ...config.android?.config,
        googleMaps: {
          apiKey: googleMapsApiKey
        }
      }
    };

    config.ios = {
      ...config.ios,
      config: {
        ...config.ios?.config,
        googleMapsApiKey: googleMapsApiKey
      }
    };
  }

  config.extra = {
    ...config.extra,
    EXPO_PUBLIC_API_BASE_URL: getEnv('EXPO_PUBLIC_API_BASE_URL', 'http://localhost:3001/api/v1'),
    EXPO_PUBLIC_ENV: getEnv('EXPO_PUBLIC_ENV', 'development'),
    EXPO_PUBLIC_GOOGLE_MAPS_API_KEY: googleMapsApiKey,
  };

  return config;
};

const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add resolver for Firebase Service Worker and path aliases
config.resolver.alias = {
  ...config.resolver.alias,
  'firebase-messaging-sw.js': './firebase-messaging-sw.js',
  '@': path.resolve(__dirname),
  'ws': './polyfills/ws.js',
};

// Resolve ws module to React Native's WebSocket for Socket.IO compatibility
config.resolver.resolverMainFields = ['react-native', 'browser', 'main'];
config.resolver.platforms = ['ios', 'android', 'native', 'web'];

// Extra options for Metro to handle Node.js polyfills
config.resolver.sourceExts = [...config.resolver.sourceExts, 'mjs'];

module.exports = config;
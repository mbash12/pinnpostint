// Polyfill for ws module to work with React Native's WebSocket
// React Native has built-in WebSocket support, so we don't need the ws package

module.exports = {
  WebSocket: global.WebSocket || global.webkitWebSocket,
  Server: undefined, // Not supported in React Native
};

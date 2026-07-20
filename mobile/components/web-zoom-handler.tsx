import { useEffect } from 'react';
import { Platform } from 'react-native';

export function WebZoomHandler() {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const handleResize = () => {
      // Use window.outerWidth or window.innerWidth.
      // Note: when zoom changes, window.innerWidth may change depending on browser.
      // window.outerWidth / window.devicePixelRatio is a stable measure of screen width in CSS pixels

      // We will check the actual width of the viewport before zoom is applied
      // Reset zoom to measure
      const previousZoom = document.body.style.zoom;
      document.body.style.zoom = '1';

      const width = window.innerWidth;

      // If between 1024 (desktop breakpoint) and 1366, apply zoom
      if (width >= 1024 && width < 1366) {
        const zoomLevel = width / 1366;
        document.body.style.zoom = zoomLevel.toString();
      } else {
        document.body.style.zoom = '1';
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Initial call

    return () => {
      window.removeEventListener('resize', handleResize);
      document.body.style.zoom = '1';
    };
  }, []);

  return null;
}

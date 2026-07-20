/**
 * Convert a backend image URL to a proxied URL through Next.js API route
 * This solves CORS issues when loading images from a different origin
 */
export function getProxiedImageUrl(imageUrl: string | undefined | null): string | undefined {
  if (!imageUrl) return undefined;

  // If it's already a relative URL or from the same origin, return as-is
  if (imageUrl.startsWith('/') || imageUrl.startsWith(window.location.origin)) {
    return imageUrl;
  }

  // If it's an external URL (like from localhost:3001), proxy it
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return `/api/proxy-image?url=${encodeURIComponent(imageUrl)}`;
  }

  return imageUrl;
}

/**
 * Image URL Utility
 * Converts raw Garage S3 URLs to proxy URLs served through the backend.
 * Garage doesn't support anonymous access, so all images must be proxied.
 */

const GARAGE_ENDPOINT = process.env['GARAGE_ENDPOINT'] || 'https://request.storage.mec.welocalhost.com';
const GARAGE_BUCKET = process.env['GARAGE_BUCKET'] || 'mecfoodmenu';
const GARAGE_AVATAR_BUCKET = process.env['GARAGE_AVATAR_BUCKET'] || 'mecavatars';
const API_BASE_URL = process.env['API_BASE_URL'] || 'https://backend.mec.welocalhost.com';

/**
 * Convert a Garage S3 URL to an image proxy URL.
 *
 * Menu images:
 *   From: https://request.storage.mec.welocalhost.com/mecfoodmenu/meccanteen/idly.png
 *   To:   {API_BASE_URL}/api/v1/images/meccanteen/idly.png
 *
 * Avatars (separate bucket):
 *   From: https://request.storage.mec.welocalhost.com/mecavatars/avatars/123-abc-photo.jpg
 *   To:   {API_BASE_URL}/api/v1/images/avatars/123-abc-photo.jpg
 *
 * Returns the URL unchanged if it's not a Garage URL (e.g. already a proxy URL).
 */
export function convertToProxyUrl(garageUrl: string | undefined | null): string {
  if (!garageUrl) return '/placeholder.svg';

  // Check avatar bucket first
  const avatarPrefix = `${GARAGE_ENDPOINT}/${GARAGE_AVATAR_BUCKET}/`;
  if (garageUrl.startsWith(avatarPrefix)) {
    const path = garageUrl.substring(avatarPrefix.length);
    return `${API_BASE_URL}/api/v1/images/${path}`;
  }

  // Check main food menu bucket
  const garagePrefix = `${GARAGE_ENDPOINT}/${GARAGE_BUCKET}/`;
  if (garageUrl.startsWith(garagePrefix)) {
    const path = garageUrl.substring(garagePrefix.length);
    return `${API_BASE_URL}/api/v1/images/${path}`;
  }

  // Already a proxy URL or external URL — return as-is
  return garageUrl;
}

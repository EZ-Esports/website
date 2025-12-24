import { SOCIAL_ICON_INITIALS } from '@/app/lib/constants';

/**
 * Gets the initial character for a social media platform.
 * First checks SOCIAL_ICON_INITIALS for a predefined initial,
 * otherwise returns the first character of the platform name (uppercased),
 * or '?' if the platform name is empty.
 */
export function getSocialIconInitial(platform: string): string {
  const normalizedPlatform = platform.toLowerCase();
  return SOCIAL_ICON_INITIALS[normalizedPlatform] || (platform.length > 0 ? platform[0].toUpperCase() : '?');
}


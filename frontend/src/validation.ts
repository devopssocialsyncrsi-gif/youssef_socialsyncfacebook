import type { Platform } from './api';

export const PLATFORM_LIMITS: Record<Platform, number> = { linkedin: 3000, facebook: 63206, instagram: 2200, youtube: 5000 };
export const PLATFORMS: Platform[] = ['linkedin', 'facebook', 'instagram', 'youtube'];
export const PLATFORM_NAMES: Record<Platform, string> = { linkedin: 'LinkedIn', facebook: 'Facebook', instagram: 'Instagram', youtube: 'YouTube' };

export function fileWarning(file: File | null): string | null {
  if (!file) return null;
  const ext = file.name.split('.').pop()?.toLowerCase();
  const expected: Record<string, string> = { png: 'image/png', mp4: 'video/mp4', mp3: 'audio/mpeg' };
  if (!ext || !expected[ext] || (file.type && file.type !== expected[ext])) return 'Please choose a PNG, MP4, or MP3 file.';
  if (file.size > 200 * 1024 * 1024) return 'Files must be 200 MB or smaller.';
  return null;
}

export function platformWarning(platform: Platform, file: Pick<File, 'name'> | null, caption: string): string | null {
  if (caption.length > PLATFORM_LIMITS[platform]) return `Caption exceeds ${PLATFORM_LIMITS[platform].toLocaleString()} characters.`;
  if (platform === 'youtube' && file?.name.toLowerCase().endsWith('.png')) return 'YouTube requires a video or audio file.';
  return null;
}

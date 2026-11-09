import { describe, expect, it } from 'vitest';
import { platformWarning } from './validation';

describe('platform rules', () => {
  it('rejects images for YouTube', () => expect(platformWarning('youtube', { name: 'image.png' }, 'hello')).toContain('requires'));
  it('allows audio to be converted for YouTube', () => expect(platformWarning('youtube', { name: 'audio.mp3' }, 'hello')).toBeNull());
  it('checks the Instagram caption limit', () => expect(platformWarning('instagram', null, 'x'.repeat(2201))).toContain('2,200'));
});

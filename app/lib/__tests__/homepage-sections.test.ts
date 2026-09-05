import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Homepage Section Ordering', () => {
  const source = readFileSync(resolve(process.cwd(), 'app/(marketing)/page.tsx'), 'utf8');

  it('renders Photo Gallery #1 (MediaGrid) above Student Organization (StudentOrgSection)', () => {
    const mediaGridIndex = source.indexOf('<MediaGrid');
    const studentOrgIndex = source.indexOf('<StudentOrgSection');
    const homeHeroIndex = source.indexOf('<HomeHero');
    const videoShowcaseIndex = source.indexOf('<VideoShowcase');

    expect(homeHeroIndex).toBeGreaterThan(-1);
    expect(mediaGridIndex).toBeGreaterThan(-1);
    expect(studentOrgIndex).toBeGreaterThan(-1);
    expect(videoShowcaseIndex).toBeGreaterThan(-1);

    // Hero -> MediaGrid -> StudentOrgSection -> VideoShowcase
    expect(homeHeroIndex).toBeLessThan(mediaGridIndex);
    expect(mediaGridIndex).toBeLessThan(studentOrgIndex);
    expect(studentOrgIndex).toBeLessThan(videoShowcaseIndex);
  });

  it('maintains expected section order and comments', () => {
    const heroComment = source.indexOf('1. Hero Section');
    const galleryComment = source.indexOf('2. Photo Gallery #1 (Community in Action)');
    const studentOrgComment = source.indexOf('3. Student Organization Section (A Five-Borough League, Student-Founded)');
    const videoComment = source.indexOf('4. Video Showcase');
    const gamesComment = source.indexOf('5. Competition Games');
    const pulseComment = source.indexOf('6. League Pulse');
    const schoolWallComment = source.indexOf('7. School Wall');
    const storyComment = source.indexOf('8. Our Story');

    expect(heroComment).toBeGreaterThan(-1);
    expect(galleryComment).toBeGreaterThan(heroComment);
    expect(studentOrgComment).toBeGreaterThan(galleryComment);
    expect(videoComment).toBeGreaterThan(studentOrgComment);
    expect(gamesComment).toBeGreaterThan(videoComment);
    expect(pulseComment).toBeGreaterThan(gamesComment);
    expect(schoolWallComment).toBeGreaterThan(pulseComment);
    expect(storyComment).toBeGreaterThan(schoolWallComment);
  });
});

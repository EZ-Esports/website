import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Homepage Section Ordering and Architecture', () => {
  const source = readFileSync(resolve(__dirname, '../../(marketing)/page.tsx'), 'utf8');

  it('renders all 8 homepage sections in exact sequential order in JSX', () => {
    const heroIndex = source.indexOf('<HomeHero');
    const mediaGridIndex = source.indexOf('<MediaGrid');
    const studentOrgIndex = source.indexOf('<StudentOrgSection');
    const videoShowcaseIndex = source.indexOf('<VideoShowcase');
    const gameShowcaseIndex = source.indexOf('<GameShowcase');
    const leaguePulseIndex = source.indexOf('<LeaguePulse');
    const schoolWallIndex = source.indexOf('<SchoolWall');
    const ourStoryIndex = source.indexOf('Our Story');

    expect(heroIndex).toBeGreaterThan(-1);
    expect(mediaGridIndex).toBeGreaterThan(-1);
    expect(studentOrgIndex).toBeGreaterThan(-1);
    expect(videoShowcaseIndex).toBeGreaterThan(-1);
    expect(gameShowcaseIndex).toBeGreaterThan(-1);
    expect(leaguePulseIndex).toBeGreaterThan(-1);
    expect(schoolWallIndex).toBeGreaterThan(-1);
    expect(ourStoryIndex).toBeGreaterThan(-1);

    // Exact sequential chain: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8
    expect(heroIndex).toBeLessThan(mediaGridIndex);
    expect(mediaGridIndex).toBeLessThan(studentOrgIndex);
    expect(studentOrgIndex).toBeLessThan(videoShowcaseIndex);
    expect(videoShowcaseIndex).toBeLessThan(gameShowcaseIndex);
    expect(gameShowcaseIndex).toBeLessThan(leaguePulseIndex);
    expect(leaguePulseIndex).toBeLessThan(schoolWallIndex);
    expect(schoolWallIndex).toBeLessThan(ourStoryIndex);
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

  it('configures MediaGrid props and conditional rendering correctly', () => {
    expect(source).toContain('{primaryGallery.length > 0 && (');
    expect(source).toContain('eyebrow="Gallery"');
    expect(source).toContain('heading="Community in Action"');
    expect(source).toContain('items={primaryGallery}');
    expect(source).toContain('columns={3}');
  });

  it('wraps sections with ScrollReveal for smooth entrance animations', () => {
    // Gallery #1 and StudentOrgSection must both be enclosed in ScrollReveal
    const gallerySectionRegex = /<ScrollReveal>\s*<MediaGrid[\s\S]*?\/>\s*<\/ScrollReveal>/;
    const studentOrgRegex = /<ScrollReveal>\s*<StudentOrgSection\s*\/>\s*<\/ScrollReveal>/;

    expect(gallerySectionRegex.test(source)).toBe(true);
    expect(studentOrgRegex.test(source)).toBe(true);
  });

  it('exports page metadata and dynamic rendering config', () => {
    expect(source).toContain("export const dynamic = 'force-dynamic';");
    expect(source).toContain("title: 'EZ Esports — NYC High School Esports League'");
  });

  it('includes robust try/catch fallback data fetching for gallery and content', () => {
    expect(source).toContain('let primaryGallery = galleryImages1;');
    expect(source).toContain('await getCachedHomepageGallery()');
    expect(source).toContain('await getCachedHomepageContent()');
  });
});

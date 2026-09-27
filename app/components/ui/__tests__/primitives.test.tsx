import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import Button from '@/app/components/ui/Button';
import { Field } from '@/app/components/ui/form';
import { hasHeroRoute, HERO_ROUTES } from '@/app/lib/constants';

describe('UI Primitives and Architectural Refactors (Issue #158)', () => {
  describe('Button Primitive', () => {
    it('renders a button with type="button" by default when no href is supplied', () => {
      const html = renderToStaticMarkup(<Button>Click me</Button>);
      expect(html).toContain('<button');
      expect(html).toContain('type="button"');
      expect(html).toContain('Click me');
    });

    it('renders a link (anchor) when href is supplied, preventing nested <a><button>', () => {
      const html = renderToStaticMarkup(<Button href="/test-url">Link CTA</Button>);
      expect(html).toContain('<a');
      expect(html).toContain('href="/test-url"');
      expect(html).not.toContain('<button');
      expect(html).toContain('Link CTA');
    });

    it('respects explicit type="submit" when provided', () => {
      const html = renderToStaticMarkup(<Button type="submit">Submit Form</Button>);
      expect(html).toContain('<button');
      expect(html).toContain('type="submit"');
    });
  });

  describe('Form Field Primitive', () => {
    it('wraps inputs with accessible label and Field structure', () => {
      const html = renderToStaticMarkup(
        <Field label="Test Label" htmlFor="test-input" error="Invalid input">
          <input id="test-input" name="test-input" />
        </Field>
      );
      expect(html).toContain('Test Label');
      expect(html).toContain('Invalid input');
      expect(html).toContain('for="test-input"');
    });
  });

  describe('Single Source of Truth: hasHeroRoute', () => {
    it('correctly identifies routes with hero headers', () => {
      expect(hasHeroRoute('/')).toBe(true);
      expect(hasHeroRoute('/about')).toBe(true);
      expect(hasHeroRoute('/gallery')).toBe(true);
      expect(hasHeroRoute('/news/post-123')).toBe(true);
      expect(hasHeroRoute('/valorant')).toBe(false);
      expect(hasHeroRoute('/league-of-legends/schedule')).toBe(false);
    });

    it('includes all expected hero routes in HERO_ROUTES array', () => {
      expect(HERO_ROUTES).toContain('/');
      expect(HERO_ROUTES).toContain('/about');
      expect(HERO_ROUTES).toContain('/gallery');
      expect(HERO_ROUTES).toContain('/news');
      expect(HERO_ROUTES).toContain('/sponsors');
      expect(HERO_ROUTES).toContain('/privacy');
      expect(HERO_ROUTES).toContain('/rules');
    });
  });
});

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import Markdown, { isSafeMarkdownUrl } from '../Markdown';

describe('Markdown URL sanitization', () => {
  describe('external links', () => {
    it('renders https://ezesports.org as an external link with target="_blank" and rel="noopener noreferrer"', () => {
      const html = renderToStaticMarkup(
        <Markdown content="Visit [EZ Esports](https://ezesports.org) for details." />
      );
      expect(html).toContain('href="https://ezesports.org"');
      expect(html).toContain('target="_blank"');
      expect(html).toContain('rel="noopener noreferrer"');
      expect(html).toContain('EZ Esports');
      expect(html).toMatch(/<a[^>]*href="https:\/\/ezesports\.org"[^>]*>EZ Esports<\/a>/);
    });

    it('renders http://example.com as an external link with target="_blank" and rel="noopener noreferrer"', () => {
      const html = renderToStaticMarkup(
        <Markdown content="Check [Example](http://example.com) out." />
      );
      expect(html).toContain('href="http://example.com"');
      expect(html).toContain('target="_blank"');
      expect(html).toContain('rel="noopener noreferrer"');
      expect(html).toContain('Example');
      expect(html).toMatch(/<a[^>]*href="http:\/\/example\.com"[^>]*>Example<\/a>/);
    });

    it('renders mailto:contact@ezesports.org as an external link with target="_blank" and rel="noopener noreferrer"', () => {
      const html = renderToStaticMarkup(
        <Markdown content="Email us at [Contact Us](mailto:contact@ezesports.org)." />
      );
      expect(html).toContain('href="mailto:contact@ezesports.org"');
      expect(html).toContain('target="_blank"');
      expect(html).toContain('rel="noopener noreferrer"');
      expect(html).toContain('Contact Us');
      expect(html).toMatch(/<a[^>]*href="mailto:contact@ezesports\.org"[^>]*>Contact Us<\/a>/);
    });

    it('handles uppercase external protocols case-insensitively', () => {
      const html = renderToStaticMarkup(
        <Markdown content="[Uppercase HTTPS](HTTPS://EZESPORTS.ORG) and [Uppercase Mailto](MAILTO:TEST@EXAMPLE.COM)" />
      );
      expect(html).toContain('href="HTTPS://EZESPORTS.ORG"');
      expect(html).toContain('href="MAILTO:TEST@EXAMPLE.COM"');
      expect(html).toContain('target="_blank"');
    });

    it('trims whitespace around external URLs', () => {
      const html = renderToStaticMarkup(
        <Markdown content="[Trimmed](  https://ezesports.org  )" />
      );
      expect(html).toContain('href="https://ezesports.org"');
    });
  });

  describe('internal links', () => {
    it('renders /about as an internal link without target="_blank" or rel', () => {
      const html = renderToStaticMarkup(
        <Markdown content="Learn more on our [About Page](/about)." />
      );
      expect(html).toContain('href="/about"');
      expect(html).toContain('About Page');
      expect(html).not.toContain('target="_blank"');
      expect(html).not.toContain('rel="noopener noreferrer"');
      expect(html).toMatch(/<a[^>]*href="\/about"[^>]*>About Page<\/a>/);
    });

    it('renders /rules as an internal link without target="_blank" or rel', () => {
      const html = renderToStaticMarkup(
        <Markdown content="Read the [Tournament Rules](/rules) before competing." />
      );
      expect(html).toContain('href="/rules"');
      expect(html).toContain('Tournament Rules');
      expect(html).not.toContain('target="_blank"');
      expect(html).not.toContain('rel="noopener noreferrer"');
      expect(html).toMatch(/<a[^>]*href="\/rules"[^>]*>Tournament Rules<\/a>/);
    });

    it('renders #section-1 as an in-page hash anchor without target="_blank" or rel', () => {
      const html = renderToStaticMarkup(
        <Markdown content="Jump to [Section 1](#section-1) directly." />
      );
      expect(html).toContain('href="#section-1"');
      expect(html).toContain('Section 1');
      expect(html).not.toContain('target="_blank"');
      expect(html).not.toContain('rel="noopener noreferrer"');
      expect(html).toMatch(/<a[^>]*href="#section-1"[^>]*>Section 1<\/a>/);
    });

    it('renders internal routes with query params and fragments', () => {
      const html = renderToStaticMarkup(
        <Markdown content="See [Filtered Rules](/rules?category=smash#stage-list)." />
      );
      expect(html).toContain('href="/rules?category=smash#stage-list"');
      expect(html).not.toContain('target="_blank"');
    });
  });

  describe('unsafe and disallowed links (prevent stored XSS)', () => {
    it('neutralizes javascript:alert(1) and produces no clickable link', () => {
      const html = renderToStaticMarkup(
        <Markdown content="Click [Exploit Alert](javascript:alert(1)) now." />
      );
      expect(html).not.toContain('<a');
      expect(html).not.toContain('href');
      expect(html).not.toContain('javascript:');
      expect(html).toContain('Exploit Alert');
      expect(html).toContain('<p class="text-foreground-secondary leading-relaxed">Click Exploit Alert now.</p>');
    });

    it('neutralizes javascript:void(0) and produces no clickable link', () => {
      const html = renderToStaticMarkup(
        <Markdown content="Do not click [Void Link](javascript:void(0))." />
      );
      expect(html).not.toContain('<a');
      expect(html).not.toContain('href');
      expect(html).not.toContain('javascript:');
      expect(html).toContain('Void Link');
      expect(html).toContain('<p class="text-foreground-secondary leading-relaxed">Do not click Void Link.</p>');
    });

    it('neutralizes data: URIs and produces no clickable link', () => {
      const html = renderToStaticMarkup(
        <Markdown content="Download [HTML Payload](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==) here." />
      );
      expect(html).not.toContain('<a');
      expect(html).not.toContain('href');
      expect(html).not.toContain('data:text/html');
      expect(html).toContain('HTML Payload');
    });

    it('neutralizes vbscript: URIs and produces no clickable link', () => {
      const html = renderToStaticMarkup(
        <Markdown content="Test [VBScript Link](vbscript:msgbox(1)) payload." />
      );
      expect(html).not.toContain('<a');
      expect(html).not.toContain('href');
      expect(html).not.toContain('vbscript:');
      expect(html).toContain('VBScript Link');
    });

    it('neutralizes mixed-case and whitespace-padded javascript URLs', () => {
      const html = renderToStaticMarkup(
        <Markdown content="Test [Padded](  JaVaScRiPt:alert(1)  )." />
      );
      expect(html).not.toContain('<a');
      expect(html).not.toContain('href');
      expect(html).toContain('Padded');
    });

    it('neutralizes protocol-relative URLs (//evil.com)', () => {
      const html = renderToStaticMarkup(
        <Markdown content="Check [Protocol Relative](//evil.com/xss)." />
      );
      expect(html).not.toContain('<a');
      expect(html).not.toContain('href');
      expect(html).toContain('Protocol Relative');
    });

    it('neutralizes backslash protocol-relative URLs (/\\evil.com)', () => {
      const html = renderToStaticMarkup(
        <Markdown content="Check [Backslash Relative](/\\evil.com)." />
      );
      expect(html).not.toContain('<a');
      expect(html).not.toContain('href');
      expect(html).toContain('Backslash Relative');
    });

    it('neutralizes file: and ftp: URIs', () => {
      const html = renderToStaticMarkup(
        <Markdown content="Read [Local File](file:///etc/passwd) or [FTP](ftp://ftp.example.com)." />
      );
      expect(html).not.toContain('<a');
      expect(html).not.toContain('href');
      expect(html).toContain('Local File');
      expect(html).toContain('FTP');
    });

    it('evaluates unclosed links in under 5ms without catastrophic backtracking (ReDoS prevention)', () => {
      const unclosedPayload = '[click](' + 'a'.repeat(1000);
      // Warm up
      renderToStaticMarkup(<Markdown content="[warmup](https://example.com)" />);

      const start = performance.now();
      const html = renderToStaticMarkup(<Markdown content={unclosedPayload} />);
      const durationMs = performance.now() - start;

      expect(durationMs).toBeLessThan(5);
      expect(html).not.toContain('<a');
      expect(html).toContain(unclosedPayload);
    });
  });

  describe('Markdown block elements containing links', () => {
    it('sanitizes links inside headings', () => {
      const html = renderToStaticMarkup(
        <Markdown content="# Heading with [Safe](/safe) and [Unsafe](javascript:alert(1))" />
      );
      expect(html).toContain('<h1');
      expect(html).toContain('<a');
      expect(html).toContain('href="/safe"');
      expect(html).not.toContain('javascript:');
      expect(html).toContain('Unsafe');
    });

    it('sanitizes links inside list items', () => {
      const content = [
        '- Safe: [EZ Esports](https://ezesports.org)',
        '- Internal: [About](/about)',
        '- Malicious: [Bad](javascript:alert(1))',
      ].join('\n');
      const html = renderToStaticMarkup(<Markdown content={content} />);
      expect(html).toContain('href="https://ezesports.org"');
      expect(html).toContain('href="/about"');
      expect(html).not.toContain('javascript:');
      expect(html).toContain('Bad');
      // Only 2 anchor tags should be rendered in the list
      const anchorMatches = html.match(/<a /g) || [];
      expect(anchorMatches.length).toBe(2);
    });

    it('handles mixed safe and unsafe links in the same paragraph', () => {
      const html = renderToStaticMarkup(
        <Markdown content="Visit [EZ Esports](https://ezesports.org) but avoid [XSS](javascript:alert(1))." />
      );
      const anchorMatches = html.match(/<a /g) || [];
      expect(anchorMatches.length).toBe(1);
      expect(html).toContain('href="https://ezesports.org"');
      expect(html).toContain('XSS');
      expect(html).not.toContain('javascript:');
    });

    it('renders null when content is empty', () => {
      const html = renderToStaticMarkup(<Markdown content="" />);
      expect(html).toBe('');
    });
  });

  describe('isSafeMarkdownUrl helper', () => {
    it('accepts safe external URLs', () => {
      expect(isSafeMarkdownUrl('https://ezesports.org')).toEqual({
        isSafe: true,
        isExternal: true,
        sanitizedUrl: 'https://ezesports.org',
      });
      expect(isSafeMarkdownUrl('http://example.com')).toEqual({
        isSafe: true,
        isExternal: true,
        sanitizedUrl: 'http://example.com',
      });
      expect(isSafeMarkdownUrl('mailto:contact@ezesports.org')).toEqual({
        isSafe: true,
        isExternal: true,
        sanitizedUrl: 'mailto:contact@ezesports.org',
      });
    });

    it('accepts safe internal paths and anchors', () => {
      expect(isSafeMarkdownUrl('/about')).toEqual({
        isSafe: true,
        isExternal: false,
        sanitizedUrl: '/about',
      });
      expect(isSafeMarkdownUrl('/rules')).toEqual({
        isSafe: true,
        isExternal: false,
        sanitizedUrl: '/rules',
      });
      expect(isSafeMarkdownUrl('#section-1')).toEqual({
        isSafe: true,
        isExternal: false,
        sanitizedUrl: '#section-1',
      });
    });

    it('rejects unsafe schemes and formats', () => {
      expect(isSafeMarkdownUrl('javascript:alert(1)').isSafe).toBe(false);
      expect(isSafeMarkdownUrl('javascript:void(0)').isSafe).toBe(false);
      expect(isSafeMarkdownUrl('data:text/html;base64,abc').isSafe).toBe(false);
      expect(isSafeMarkdownUrl('vbscript:msgbox(1)').isSafe).toBe(false);
      expect(isSafeMarkdownUrl('file:///etc/passwd').isSafe).toBe(false);
      expect(isSafeMarkdownUrl('//evil.com').isSafe).toBe(false);
      expect(isSafeMarkdownUrl('/\\evil.com').isSafe).toBe(false);
      expect(isSafeMarkdownUrl('   ').isSafe).toBe(false);
      expect(isSafeMarkdownUrl('').isSafe).toBe(false);
    });
  });
});

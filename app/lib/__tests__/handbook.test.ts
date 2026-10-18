import { describe, it, expect } from 'vitest';
import {
  HANDBOOK_MAX_BYTES,
  buildHandbookStorageKey,
  checkHandbookFile,
  isHandbookStorageKey,
  validateHandbookUpload,
} from '../handbook';
import { HANDBOOK_SECTIONS } from '../handbook-content';
import { FOOTER_LINKS, ROUTES } from '../constants';

const pdfBytes = new TextEncoder().encode('%PDF-1.7\n...');

describe('handbook upload validation', () => {
  it('accepts a real PDF', () => {
    expect(validateHandbookUpload({ name: 'h.pdf', size: pdfBytes.length, type: 'application/pdf' }, pdfBytes)).toBeNull();
  });

  it('rejects non-PDF names and types before reading bytes', () => {
    expect(checkHandbookFile({ name: 'h.png', size: 10, type: 'image/png' })).toMatch(/PDF/);
    expect(checkHandbookFile(null)).toMatch(/Choose/);
  });

  it('rejects empty and oversized files', () => {
    expect(checkHandbookFile({ name: 'h.pdf', size: 0, type: 'application/pdf' })).toMatch(/empty/);
    expect(checkHandbookFile({ name: 'h.pdf', size: HANDBOOK_MAX_BYTES + 1, type: 'application/pdf' })).toMatch(/4 MB/);
  });

  it('rejects a spoofed PDF whose bytes are not a PDF', () => {
    const html = new TextEncoder().encode('<html><script>alert(1)</script>');
    expect(validateHandbookUpload({ name: 'h.pdf', size: html.length, type: 'application/pdf' }, html)).toMatch(/not a valid PDF/);
  });
});

describe('handbook storage keys', () => {
  it('only trusts keys shaped like the ones the uploader generates', () => {
    expect(isHandbookStorageKey(buildHandbookStorageKey(1760000000000))).toBe(true);
    for (const bad of ['handbook/../x.pdf', 'gallery/1760000000000.pdf', 'handbook/abc.pdf', 'handbook/1760000000000.pdf/x', '', null, 42]) {
      expect(isHandbookStorageKey(bad)).toBe(false);
    }
  });
});

describe('handbook site wiring', () => {
  it('is linked from the footer', () => {
    expect(FOOTER_LINKS.some((l) => l.href === ROUTES.handbook)).toBe(true);
  });

  it('ships the pamphlet sections as fallback content', () => {
    const titles = HANDBOOK_SECTIONS.map((s) => s.title).join('|');
    expect(titles).toContain('Key Links');
    expect(titles).toContain('Key Dates');
    expect(titles).toContain('#1 Rule');
    expect(new Set(HANDBOOK_SECTIONS.map((s) => s.id)).size).toBe(HANDBOOK_SECTIONS.length);
  });
});

import { describe, it, expect } from 'vitest';
import { joinPdfTextItems, normalizeLigatures } from '../handbook-viewer';

describe('joinPdfTextItems', () => {
  const item = (str: string, x: number, width: number, y = 700) => ({
    str,
    transform: [10, 0, 0, 10, x, y],
    width,
    height: 10,
  });

  it('does not split a word across ligature runs', () => {
    expect(joinPdfTextItems([item('modi', 0, 20), item('ﬁ', 20, 5), item('ed', 25, 10)])).toBe('modified');
    expect(joinPdfTextItems([item('modi', 0, 20), item('fi', 20, 5), item('ed', 25, 10)])).toBe('modified');
  });

  it('inserts a space at a real gap and on a new line', () => {
    expect(joinPdfTextItems([item('Last', 0, 20), item('Modified', 25, 40)])).toBe('Last Modified');
    expect(joinPdfTextItems([item('end', 0, 15, 700), item('start', 0, 20, 686)])).toBe('end start');
  });

  it('honours hasEOL, empty EOL markers and items without geometry', () => {
    expect(joinPdfTextItems([{ str: 'a', hasEOL: true }, { str: 'b' }])).toBe('a b');
    expect(joinPdfTextItems([{ str: 'a' }, { str: '', hasEOL: true }, { str: 'b' }])).toBe('a b');
    expect(joinPdfTextItems([{ str: 'a' }, { str: 'b' }])).toBe('a b');
  });
});

describe('normalizeLigatures', () => {
  it('expands U+FB00-FB06', () => {
    expect(normalizeLigatures('ﬁnal ﬂow oﬃce ﬀ')).toBe('final flow office ff');
  });
});

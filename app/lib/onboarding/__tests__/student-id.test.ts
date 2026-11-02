import { describe, expect, it } from 'vitest';
import {
  STUDENT_ID_MAX_BYTES,
  buildStudentIdStorageKey,
  checkStudentIdFile,
  detectImageType,
  isStudentIdStorageKey,
  validateStudentIdBytes,
} from '../student-id';

const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0];
const WEBP = [0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50];
const bytes = (arr: number[], pad = 0) => new Uint8Array([...arr, ...new Array(pad).fill(0)]);
const text = (s: string) => new TextEncoder().encode(s);

describe('student ID image rules (spec-056)', () => {
  it('detects JPEG, PNG and WebP from magic bytes', () => {
    expect(detectImageType(bytes(JPEG))).toBe('image/jpeg');
    expect(detectImageType(bytes(PNG))).toBe('image/png');
    expect(detectImageType(bytes(WEBP))).toBe('image/webp');
  });

  it('rejects content that only claims to be an image (wrong magic bytes)', () => {
    const html = text('<html><script>alert(1)</script></html>');
    expect(detectImageType(html)).toBeNull();
    expect(validateStudentIdBytes(html)).toMatchObject({ ok: false });
    // A PDF, a GIF and an SVG are not accepted even if renamed to .jpg
    expect(detectImageType(text('%PDF-1.7 ...'))).toBeNull();
    expect(detectImageType(text('GIF89a......'))).toBeNull();
    expect(detectImageType(text('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull();
    // RIFF container that is not WebP (e.g. WAV)
    expect(detectImageType(bytes([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x41, 0x56, 0x45]))).toBeNull();
  });

  it('rejects empty and truncated input without throwing', () => {
    expect(validateStudentIdBytes(new Uint8Array())).toMatchObject({ ok: false });
    expect(detectImageType(bytes([0xff, 0xd8]))).toBeNull();
    expect(detectImageType(bytes(PNG.slice(0, 4)))).toBeNull();
  });

  it('enforces the size cap on the actual byte count', () => {
    expect(validateStudentIdBytes(bytes(JPEG, STUDENT_ID_MAX_BYTES - JPEG.length))).toMatchObject({ ok: true, type: 'image/jpeg' });
    expect(validateStudentIdBytes(bytes(JPEG, STUDENT_ID_MAX_BYTES))).toMatchObject({ ok: false });
  });

  it('builds a key from the uuid and the DETECTED type only', () => {
    const uuid = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
    expect(buildStudentIdStorageKey(uuid, 'image/png')).toBe(`${uuid}.png`);
    expect(isStudentIdStorageKey(`${uuid}.png`)).toBe(true);
    expect(isStudentIdStorageKey(`${uuid}.jpg`)).toBe(true);
  });

  it.each(['../secret.jpg', 'a/b.jpg', 'student-ids/x.jpg', 'my name.jpg', '', null, undefined, 42])(
    'does not treat %j as one of our storage keys',
    (key) => {
      expect(isStudentIdStorageKey(key)).toBe(false);
    },
  );

  it('gives early browser feedback on type and size', () => {
    expect(checkStudentIdFile(null)).not.toBeNull();
    expect(checkStudentIdFile({ size: 0, type: 'image/jpeg' })).not.toBeNull();
    expect(checkStudentIdFile({ size: 10, type: 'application/pdf' })).not.toBeNull();
    expect(checkStudentIdFile({ size: STUDENT_ID_MAX_BYTES + 1, type: 'image/png' })).not.toBeNull();
    expect(checkStudentIdFile({ size: 1000, type: 'image/webp' })).toBeNull();
  });
});

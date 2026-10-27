import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

// Backstop for the no-restricted-globals / no-restricted-properties lint rule in
// eslint.config.mjs, since the pre-push hook runs vitest and tsc but not eslint.
const APP_DIR = path.resolve(__dirname, '../..');
const NATIVE_CONFIRM = /(?<![\w$.])(?:(?:window|globalThis|self)\s*\.\s*)?confirm\s*\(/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      return name === '__tests__' || name === 'node_modules' ? [] : sourceFiles(full);
    }
    return /\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

function stripComments(src: string) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

describe('native confirm()', () => {
  it('is not used anywhere in app/ (use ConfirmActionDialog)', () => {
    const offenders = sourceFiles(APP_DIR).filter((file) => NATIVE_CONFIRM.test(stripComments(readFileSync(file, 'utf8'))));
    expect(offenders.map((f) => path.relative(APP_DIR, f))).toEqual([]);
  });

  it('the pattern catches the forms it exists to forbid', () => {
    expect(NATIVE_CONFIRM.test("if (!confirm('x')) return;")).toBe(true);
    expect(NATIVE_CONFIRM.test("if (!window.confirm('x')) return;")).toBe(true);
    expect(NATIVE_CONFIRM.test('onConfirm()')).toBe(false);
    expect(NATIVE_CONFIRM.test('flow.confirm()')).toBe(false);
  });
});

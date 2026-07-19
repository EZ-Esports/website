import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const protectedPages = [
  'league/page.tsx',
  'matches/page.tsx',
  'standings/page.tsx',
  'roster/page.tsx',
  'news/page.tsx',
  'news/new/page.tsx',
  'news/[id]/page.tsx',
  'leadership/page.tsx',
  'gallery/page.tsx',
  'sponsors/page.tsx',
  'schools/page.tsx',
  'applications/page.tsx',
  'content/page.tsx',
  'team/page.tsx',
];

describe('protected admin pages', () => {
  it.each(protectedPages)('%s denies before entering its data-loading block', (relativePath) => {
    const source = readFileSync(resolve(process.cwd(), 'app/(admin)/admin', relativePath), 'utf8');
    const componentStart = source.indexOf('export default');
    const guard = source.indexOf('getStaffForAdminSection(', componentStart);
    const dataBlock = source.indexOf('try {', componentStart);

    expect(guard).toBeGreaterThan(componentStart);
    if (dataBlock !== -1) expect(guard).toBeLessThan(dataBlock);
    expect(source.slice(guard, guard + 180)).toContain('PermissionDenied');
  });

  it('guards the upload API before parsing or uploading a file', () => {
    const source = readFileSync(resolve(process.cwd(), 'app/api/upload/route.ts'), 'utf8');
    expect(source.indexOf('requireAnyPermission(')).toBeLessThan(source.indexOf('req.formData()'));
    expect(source).toContain("{ status: 403 }");
  });
});

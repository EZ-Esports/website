import { describe, it, expect } from 'vitest';
import { formatGoldDiffTable, type GoldDiffRow } from '../seed-gold';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('formatGoldDiffTable', () => {
  it('formats rows into a clean, aligned summary table', () => {
    const rows: GoldDiffRow[] = [
      {
        entity: 'games',
        incoming: 3,
        toInsert: 0,
        toUpdate: 0,
        unchanged: 3,
        toPrune: null,
      },
      {
        entity: 'matches',
        incoming: 719,
        toInsert: 10,
        toUpdate: 5,
        unchanged: 704,
        toPrune: 2,
      },
    ];

    const output = formatGoldDiffTable(rows);

    expect(output).toContain('📋 Ingestion Plan (--dry-run):');
    expect(output).toContain('Entity');
    expect(output).toContain('Total CSV');
    expect(output).toContain('To Insert');
    expect(output).toContain('To Update');
    expect(output).toContain('Unchanged');
    expect(output).toContain('To Prune');
    expect(output).toContain('games');
    expect(output).toContain('matches');
    expect(output).toContain('0 mutations executed');
    expect(output).toContain('run without --dry-run');
  });

  it('handles null toPrune with a dash', () => {
    const rows: GoldDiffRow[] = [
      {
        entity: 'schools',
        incoming: 27,
        toInsert: 1,
        toUpdate: 2,
        unchanged: 24,
        toPrune: null,
      },
    ];

    const output = formatGoldDiffTable(rows);
    expect(output).toMatch(/schools\s+27\s+1\s+2\s+24\s+-/);
  });
});

describe('structural invariants for ingestion and backfill dry-run', () => {
  it('seed-gold.ts supports --dry-run without requiring seed target permissions', () => {
    const src = readFileSync(resolve(__dirname, '../seed-gold.ts'), 'utf8');
    expect(src).toContain("process.argv.includes('--dry-run')");
    expect(src).toContain('if (!dryRun)');
    expect(src).toContain('assertSeedTargetAllowed();');
    expect(src).toContain('requireFreshBackup(GOLD_SEED_TABLES);');
    expect(src).toContain('formatGoldDiffTable');
  });

  it('seed-gold.ts coalesces player bios on conflict to protect human edits', () => {
    const src = readFileSync(resolve(__dirname, '../seed-gold.ts'), 'utf8');
    expect(src).toMatch(/bio:\s*sql`coalesce\(\$\{schema\.players\.bio\},\s*excluded\.bio\)`/);
  });

  it('backfill-leadership.ts supports --dry-run without throwing non-loopback error', () => {
    const src = readFileSync(resolve(__dirname, '../backfill-leadership.ts'), 'utf8');
    expect(src).toContain("process.argv.includes('--dry-run')");
    expect(src).toContain('if (!dryRun)');
    expect(src).toContain('assertSeedTargetAllowed();');
    expect(src).toContain('Leadership Backfill Plan (--dry-run)');
  });

  it('package.json defines canonical db:ingest:* and db:backfill:leadership scripts', () => {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf8'));
    expect(pkg.scripts['db:ingest:gold']).toBe('npx tsx --env-file-if-exists=.env db/seed-gold.ts');
    expect(pkg.scripts['db:ingest:leadership']).toBe('npx tsx --env-file-if-exists=.env db/seed-leadership.ts');
    expect(pkg.scripts['db:backfill:leadership']).toBe('npx tsx --env-file-if-exists=.env db/backfill-leadership.ts');
  });
});

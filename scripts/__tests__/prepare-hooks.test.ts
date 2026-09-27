import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { resolveGitDir, setupGitHooks } from '../prepare-hooks.mjs';

describe('prepare-hooks worktree-safe detection', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'git-prepare-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('resolves git dir when .git is a directory (standard clone)', () => {
    const gitDir = join(tempDir, '.git');
    mkdirSync(gitDir);

    expect(resolveGitDir(tempDir)).toBe(gitDir);
  });

  it('resolves git dir when .git is a file with an absolute path (worktree)', () => {
    const realGitDir = join(tempDir, 'actual-git-dir');
    mkdirSync(realGitDir);

    const dotGitFile = join(tempDir, '.git');
    writeFileSync(dotGitFile, `gitdir: ${realGitDir}\n`);

    expect(resolveGitDir(tempDir)).toBe(realGitDir);
  });

  it('resolves git dir when .git is a file with a relative path (worktree)', () => {
    const parentDir = join(tempDir, 'repo');
    const worktreeDir = join(parentDir, 'worktree');
    const commonGitDir = join(parentDir, '.git', 'worktrees', 'worktree-1');
    mkdirSync(join(parentDir, '.git', 'worktrees', 'worktree-1'), { recursive: true });
    mkdirSync(worktreeDir, { recursive: true });

    writeFileSync(
      join(worktreeDir, '.git'),
      'gitdir: ../.git/worktrees/worktree-1\n'
    );

    expect(resolveGitDir(worktreeDir)).toBe(commonGitDir);
  });

  it('returns null when .git does not exist', () => {
    expect(resolveGitDir(tempDir)).toBe(null);
  });

  it('returns null when .git is a file pointing to a non-existent directory', () => {
    writeFileSync(join(tempDir, '.git'), 'gitdir: /nonexistent/path/nowhere\n');
    expect(resolveGitDir(tempDir)).toBe(null);
  });

  it('returns null when .git is a malformed file', () => {
    writeFileSync(join(tempDir, '.git'), 'invalid content without gitdir prefix\n');
    expect(resolveGitDir(tempDir)).toBe(null);
  });

  it('returns false from setupGitHooks when outside git', () => {
    expect(setupGitHooks(tempDir)).toBe(false);
  });
});

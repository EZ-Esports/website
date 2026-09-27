import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/**
 * Resolves the real git directory, handling both standard repositories (where
 * .git is a directory) and git worktrees (where .git is a file containing
 * `gitdir: <path>`).
 */
export function resolveGitDir(repoRoot = process.cwd()) {
  const dotGitPath = path.resolve(repoRoot, '.git');
  if (!fs.existsSync(dotGitPath)) {
    return null;
  }

  const stat = fs.statSync(dotGitPath);
  if (stat.isDirectory()) {
    return dotGitPath;
  }

  if (stat.isFile()) {
    const content = fs.readFileSync(dotGitPath, 'utf8').trim();
    const match = content.match(/^gitdir:\s*(.+)$/m);
    if (!match) {
      return null;
    }
    const targetPath = match[1].trim();
    const resolved = path.isAbsolute(targetPath)
      ? targetPath
      : path.resolve(repoRoot, targetPath);

    if (fs.existsSync(resolved)) {
      return resolved;
    }
  }

  return null;
}

/**
 * Configures core.hooksPath to .githooks in a worktree-safe manner.
 */
export function setupGitHooks(repoRoot = process.cwd()) {
  const gitDir = resolveGitDir(repoRoot);
  if (!gitDir) {
    return false;
  }

  try {
    execSync('git config core.hooksPath .githooks', {
      cwd: repoRoot,
      stdio: 'ignore',
    });
    return true;
  } catch (error) {
    console.warn('Failed to configure git core.hooksPath:', error);
    return false;
  }
}

const isMain =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMain) {
  setupGitHooks();
}

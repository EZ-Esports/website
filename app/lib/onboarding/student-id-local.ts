import 'server-only';
import fs from 'node:fs/promises';
import path from 'node:path';
import { seedTargetHost } from '@/db/seed-target';
import { isStudentIdStorageKey, type StudentIdType } from './student-id';

/**
 * DEV-ONLY local storage driver for student ID images (spec-056), so the whole onboarding flow can be
 * tried on a laptop with no Supabase Storage. Production always uses the private bucket; this driver can
 * only be selected when EVERY guard below holds, and asking for it while one fails is an error, never a
 * quiet fall back to the bucket.
 */

export type StudentIdDriver = 'bucket' | 'local';

export interface DriverEnv {
  STUDENT_ID_STORAGE?: string;
  STUDENT_ID_LOCAL_DIR?: string;
  NODE_ENV?: string;
  DATABASE_URL?: string;
}

function isLoopbackHost(host: string | undefined): boolean {
  if (!host) return false;
  const h = host.replace(/^\[|\]$/g, '').toLowerCase();
  return h === 'localhost' || h === '::1' || /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h);
}

/**
 * Chooses the driver. `bucket` unless STUDENT_ID_STORAGE=local. For `local`, all of these must hold or
 * this throws: NODE_ENV is not production, DATABASE_URL points at a loopback host, and
 * STUDENT_ID_LOCAL_DIR is set to an absolute path.
 */
export function resolveStudentIdDriver(env: DriverEnv = process.env as DriverEnv): { driver: StudentIdDriver; dir?: string } {
  if (env.STUDENT_ID_STORAGE !== 'local') return { driver: 'bucket' };

  const failures: string[] = [];
  if (env.NODE_ENV === 'production') failures.push('NODE_ENV is production');
  if (!env.DATABASE_URL || !isLoopbackHost(seedTargetHost(env.DATABASE_URL))) {
    failures.push('DATABASE_URL does not point at a loopback host (localhost, 127.x.x.x or ::1)');
  }
  const dir = env.STUDENT_ID_LOCAL_DIR?.trim();
  if (!dir) failures.push('STUDENT_ID_LOCAL_DIR is not set');
  else if (!path.isAbsolute(dir)) failures.push('STUDENT_ID_LOCAL_DIR is not an absolute path');

  if (failures.length > 0) {
    throw new Error(
      `STUDENT_ID_STORAGE=local is a development-only setting and cannot be used here: ${failures.join('; ')}. ` +
        'Unset STUDENT_ID_STORAGE to use the private bucket.'
    );
  }
  return { driver: 'local', dir: path.resolve(dir as string) };
}

/** The file for `key` inside `dir`, or null when the key is not one of ours or the path would leave `dir`. */
export function localPathFor(dir: string, key: string): string | null {
  if (!isStudentIdStorageKey(key)) return null;
  const root = path.resolve(dir);
  const full = path.resolve(root, key);
  return full.startsWith(root + path.sep) ? full : null;
}

const TYPE_BY_EXTENSION: Record<string, StudentIdType> = {
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

export async function localPut(dir: string, key: string, bytes: Uint8Array): Promise<{ error: string | null }> {
  const file = localPathFor(dir, key);
  if (!file) return { error: 'invalid key' };
  try {
    await fs.mkdir(path.dirname(file), { recursive: true });
    // 'wx': never overwrite, like the bucket's upsert: false.
    await fs.writeFile(file, bytes, { flag: 'wx' });
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'write failed' };
  }
}

/** The stored bytes and the content type implied by the key (set from the verified magic bytes at upload). */
export async function localRead(dir: string, key: string): Promise<{ bytes: Uint8Array; contentType: StudentIdType } | null> {
  const file = localPathFor(dir, key);
  if (!file) return null;
  try {
    const bytes = new Uint8Array(await fs.readFile(file));
    return { bytes, contentType: TYPE_BY_EXTENSION[path.extname(key)] };
  } catch {
    return null;
  }
}

/** Removes the files; a file that is already gone counts as removed. Returns whether every removal succeeded. */
export async function localRemove(dir: string, keys: string[]): Promise<boolean> {
  let ok = true;
  for (const key of keys) {
    const file = localPathFor(dir, key);
    if (!file) continue;
    try {
      await fs.rm(file, { force: true });
    } catch (err) {
      console.error('Could not remove local student ID file:', err instanceof Error ? err.message : 'unexpected error');
      ok = false;
    }
  }
  return ok;
}

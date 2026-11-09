import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  localPathFor,
  localPut,
  localRead,
  localRemove,
  resolveStudentIdDriver,
  type DriverEnv,
} from '../student-id-local';

const KEY = '3f2504e0-4f89-41d3-9a0c-0305e82c3301.jpg';
const OK_DIR = path.resolve(os.tmpdir(), 'ez-student-ids-guard');
const okEnv = (over: DriverEnv = {}): DriverEnv => ({
  STUDENT_ID_STORAGE: 'local',
  STUDENT_ID_LOCAL_DIR: OK_DIR,
  NODE_ENV: 'development',
  DATABASE_URL: 'postgres://postgres:pw@localhost:5432/ez',
  ...over,
});

describe('driver selection guards', () => {
  it('defaults to the bucket driver, whatever else is set', () => {
    expect(resolveStudentIdDriver({})).toEqual({ driver: 'bucket' });
    expect(resolveStudentIdDriver({ STUDENT_ID_LOCAL_DIR: OK_DIR, NODE_ENV: 'development' })).toEqual({ driver: 'bucket' });
    expect(resolveStudentIdDriver({ STUDENT_ID_STORAGE: 'bucket' })).toEqual({ driver: 'bucket' });
  });

  it.each([
    'postgres://u:p@localhost:5432/db',
    'postgres://u:p@127.0.0.1:5432/db',
    'postgres://u:p@127.0.1.5:5432/db',
    'postgres://u:p@[::1]:5432/db',
    'postgresql:///db',
  ])('activates only when every guard holds (%s)', (url) => {
    expect(resolveStudentIdDriver(okEnv({ DATABASE_URL: url }))).toEqual({ driver: 'local', dir: OK_DIR });
  });

  it.each([
    ['production', { NODE_ENV: 'production' }, /NODE_ENV is production/],
    ['a remote database', { DATABASE_URL: 'postgres://u:p@aws-1-us-east-1.pooler.supabase.com:6543/postgres' }, /loopback/],
    ['a look-alike host', { DATABASE_URL: 'postgres://u:p@localhost.evil.com:5432/db' }, /loopback/],
    ['an unparseable database url', { DATABASE_URL: 'not a url' }, /loopback/],
    ['no database url', { DATABASE_URL: undefined }, /loopback/],
    ['no directory', { STUDENT_ID_LOCAL_DIR: undefined }, /STUDENT_ID_LOCAL_DIR is not set/],
    ['a blank directory', { STUDENT_ID_LOCAL_DIR: '   ' }, /STUDENT_ID_LOCAL_DIR is not set/],
    ['a relative directory', { STUDENT_ID_LOCAL_DIR: 'student-ids' }, /absolute/],
  ])('throws instead of using the bucket when %s', (_label, over, message) => {
    expect(() => resolveStudentIdDriver(okEnv(over as DriverEnv))).toThrow(message);
  });
});

describe('path safety', () => {
  const dir = path.resolve(os.tmpdir(), 'ez-student-ids-paths');

  it('maps only our own keys to a file inside the directory', () => {
    expect(localPathFor(dir, KEY)).toBe(path.join(dir, KEY));
  });

  it.each(['../evil.jpg', '..\\evil.jpg', 'a/b.jpg', '/etc/passwd', 'C:\\x.jpg', `${KEY}/../x`, 'name.jpg', '', `${KEY}\u0000.png`])(
    'rejects %j',
    (key) => {
      expect(localPathFor(dir, key)).toBeNull();
    },
  );
});

describe('local put / read / remove', () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ez-student-ids-'));
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('round trips bytes and derives the content type from the key', async () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3]);
    expect(await localPut(dir, KEY, bytes)).toEqual({ error: null });
    const read = await localRead(dir, KEY);
    expect(read?.contentType).toBe('image/jpeg');
    expect(Array.from(read!.bytes)).toEqual(Array.from(bytes));
    expect(fs.readdirSync(dir)).toEqual([KEY]);
  });

  it('never overwrites an existing file', async () => {
    await localPut(dir, KEY, new Uint8Array([1]));
    expect((await localPut(dir, KEY, new Uint8Array([2]))).error).not.toBeNull();
    expect(Array.from((await localRead(dir, KEY))!.bytes)).toEqual([1]);
  });

  it('removes files, treats a missing file as removed, and ignores foreign keys', async () => {
    await localPut(dir, KEY, new Uint8Array([1]));
    expect(await localRemove(dir, [KEY, '3f2504e0-4f89-41d3-9a0c-0305e82c3302.png', '../x'])).toBe(true);
    expect(await localRead(dir, KEY)).toBeNull();
  });

  it('refuses to write or read outside the directory', async () => {
    expect((await localPut(dir, '../evil.jpg', new Uint8Array([1]))).error).toBe('invalid key');
    expect(await localRead(dir, '../evil.jpg')).toBeNull();
    expect(fs.existsSync(path.join(path.dirname(dir), 'evil.jpg'))).toBe(false);
  });
});

describe('the facade picks the driver from the environment', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('uses the bucket (a Supabase call) by default and throws when local is requested but unsafe', async () => {
    vi.resetModules();
    const upload = vi.fn().mockResolvedValue({ error: null });
    vi.doMock('@/app/lib/supabase/service', () => ({
      createServiceClient: () => ({ storage: { from: () => ({ upload, remove: vi.fn(), createSignedUrl: vi.fn() }) } }),
    }));
    const storage = await import('../student-id-storage');

    vi.stubEnv('STUDENT_ID_STORAGE', '');
    expect(storage.isLocalStudentIdStorage()).toBe(false);
    await storage.putStudentId(KEY, new Uint8Array([1]), 'image/jpeg');
    expect(upload).toHaveBeenCalledTimes(1);

    vi.stubEnv('STUDENT_ID_STORAGE', 'local');
    vi.stubEnv('STUDENT_ID_LOCAL_DIR', OK_DIR);
    vi.stubEnv('DATABASE_URL', 'postgres://u:p@db.example.com:5432/x');
    await expect(storage.putStudentId(KEY, new Uint8Array([1]), 'image/jpeg')).rejects.toThrow(/development-only/);
    expect(upload).toHaveBeenCalledTimes(1);
  });

  it('writes to the local directory, never to Supabase, when every guard holds', async () => {
    vi.resetModules();
    const upload = vi.fn();
    vi.doMock('@/app/lib/supabase/service', () => ({
      createServiceClient: () => ({ storage: { from: () => ({ upload }) } }),
    }));
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ez-student-ids-facade-'));
    try {
      vi.stubEnv('STUDENT_ID_STORAGE', 'local');
      vi.stubEnv('STUDENT_ID_LOCAL_DIR', dir);
      vi.stubEnv('DATABASE_URL', 'postgres://u:p@127.0.0.1:5432/x');
      const storage = await import('../student-id-storage');
      expect(storage.isLocalStudentIdStorage()).toBe(true);
      expect(await storage.putStudentId(KEY, new Uint8Array([9]), 'image/jpeg')).toEqual({ error: null });
      expect(upload).not.toHaveBeenCalled();
      expect((await storage.readLocalStudentId(KEY))?.contentType).toBe('image/jpeg');
      expect(await storage.signStudentIdUrl(KEY)).toBeNull();
      expect(await storage.removeStudentIds([KEY])).toBe(true);
      expect(await storage.readLocalStudentId(KEY)).toBeNull();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

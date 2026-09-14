import { describe, it, expect, beforeEach, vi } from 'vitest';
import { _resetRateLimitStore } from '@/app/lib/rate-limit';

const mockRedirect = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});
const mockRevalidatePath = vi.fn();
const mockHeaders = vi.fn();
const mockSignInWithPassword = vi.fn();
const mockCreateClient = vi.fn().mockResolvedValue({
  auth: {
    signInWithPassword: mockSignInWithPassword,
  },
});

vi.mock('next/navigation', () => ({
  redirect: (url: string) => mockRedirect(url),
}));

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

vi.mock('next/headers', () => ({
  headers: () => mockHeaders(),
}));

vi.mock('@/app/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}));

import { login } from '../actions';

function createFormData(data: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, val] of Object.entries(data)) {
    fd.append(key, val);
  }
  return fd;
}

function mockHeaderValues(headersMap: Record<string, string>) {
  const normalized: Record<string, string> = {};
  for (const [k, v] of Object.entries(headersMap)) {
    normalized[k.toLowerCase()] = v;
  }
  mockHeaders.mockResolvedValue({
    get: (key: string) => normalized[key.toLowerCase()] ?? null,
  });
}

describe('login server action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetRateLimitStore();
    mockSignInWithPassword.mockResolvedValue({ error: null });
    mockHeaderValues({ 'x-forwarded-for': '203.0.113.195' });
  });

  describe('validation', () => {
    it('redirects with error if email is missing', async () => {
      const fd = createFormData({ password: 'secretpassword' });
      await expect(login(fd)).rejects.toThrow(
        `REDIRECT:/login?error=${encodeURIComponent('Email and password are required.')}`
      );
      expect(mockSignInWithPassword).not.toHaveBeenCalled();
    });

    it('redirects with error if password is missing', async () => {
      const fd = createFormData({ email: 'staff@example.com' });
      await expect(login(fd)).rejects.toThrow(
        `REDIRECT:/login?error=${encodeURIComponent('Email and password are required.')}`
      );
      expect(mockSignInWithPassword).not.toHaveBeenCalled();
    });
  });

  describe('successful login', () => {
    it('allows a legitimate login attempt, revalidates cache, and redirects to /admin', async () => {
      const fd = createFormData({
        email: 'staff@example.com',
        password: 'correctpassword',
      });

      await expect(login(fd)).rejects.toThrow('REDIRECT:/admin');
      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: 'staff@example.com',
        password: 'correctpassword',
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith('/', 'layout');
      expect(mockRedirect).toHaveBeenCalledWith('/admin');
    });
  });

  describe('supabase auth error', () => {
    it('redirects back to login with supabase error message', async () => {
      mockSignInWithPassword.mockResolvedValueOnce({
        error: { message: 'Invalid login credentials' },
      });

      const fd = createFormData({
        email: 'staff@example.com',
        password: 'wrongpassword',
      });

      await expect(login(fd)).rejects.toThrow(
        `REDIRECT:/login?error=${encodeURIComponent('Invalid login credentials')}`
      );
      expect(mockRevalidatePath).not.toHaveBeenCalled();
    });

    it('falls back to generic error message if error has no message', async () => {
      mockSignInWithPassword.mockResolvedValueOnce({
        error: {},
      });

      const fd = createFormData({
        email: 'staff@example.com',
        password: 'wrongpassword',
      });

      await expect(login(fd)).rejects.toThrow(
        `REDIRECT:/login?error=${encodeURIComponent('Sign-in failed. Please try again.')}`
      );
    });
  });

  describe('rate limiting per account (IP + email)', () => {
    it('allows 5 attempts and blocks the 6th attempt within 15 minutes', async () => {
      mockSignInWithPassword.mockResolvedValue({
        error: { message: 'Invalid login credentials' },
      });

      const fd = createFormData({
        email: 'target@example.com',
        password: 'badpassword',
      });

      // 5 attempts should pass through to Supabase
      for (let i = 1; i <= 5; i++) {
        await expect(login(fd)).rejects.toThrow(
          `REDIRECT:/login?error=${encodeURIComponent('Invalid login credentials')}`
        );
      }
      expect(mockSignInWithPassword).toHaveBeenCalledTimes(5);

      // 6th attempt must be rate limited WITHOUT calling Supabase
      await expect(login(fd)).rejects.toThrow(
        `REDIRECT:/login?error=${encodeURIComponent(
          'Too many login attempts. Please try again in 15 minutes.'
        )}`
      );
      // Ensure supabase auth is not called for the blocked attempt
      expect(mockSignInWithPassword).toHaveBeenCalledTimes(5);
    });

    it('normalizes email (case and whitespace) for rate limiting key', async () => {
      mockSignInWithPassword.mockResolvedValue({
        error: { message: 'Invalid login credentials' },
      });

      const variations = [
        'user@example.com',
        'USER@EXAMPLE.COM',
        '  user@example.com  ',
        'User@Example.Com',
        ' USER@example.com ',
      ];

      for (const email of variations) {
        const fd = createFormData({ email, password: 'wrong' });
        await expect(login(fd)).rejects.toThrow('Invalid%20login%20credentials');
      }

      // 6th attempt with another variation of the same email should be locked out
      const blockedFd = createFormData({
        email: '  uSeR@eXaMpLe.CoM  ',
        password: 'wrong',
      });
      await expect(login(blockedFd)).rejects.toThrow(
        `REDIRECT:/login?error=${encodeURIComponent(
          'Too many login attempts. Please try again in 15 minutes.'
        )}`
      );
      expect(mockSignInWithPassword).toHaveBeenCalledTimes(5);
    });
  });

  describe('rate limiting per IP (credential stuffing defense)', () => {
    it('blocks more than 20 login attempts from the same IP across different accounts', async () => {
      mockSignInWithPassword.mockResolvedValue({
        error: { message: 'Invalid login credentials' },
      });

      // Attempt 20 different emails from the same IP
      for (let i = 1; i <= 20; i++) {
        const fd = createFormData({
          email: `user${i}@example.com`,
          password: 'password',
        });
        await expect(login(fd)).rejects.toThrow('Invalid%20login%20credentials');
      }
      expect(mockSignInWithPassword).toHaveBeenCalledTimes(20);

      // 21st attempt from the same IP with a brand new email must be blocked
      const blockedFd = createFormData({
        email: 'brand-new-user@example.com',
        password: 'password',
      });
      await expect(login(blockedFd)).rejects.toThrow(
        `REDIRECT:/login?error=${encodeURIComponent(
          'Too many login attempts. Please try again in 15 minutes.'
        )}`
      );
      expect(mockSignInWithPassword).toHaveBeenCalledTimes(20);
    });

    it('allows logins from another IP when one IP is rate limited', async () => {
      mockSignInWithPassword.mockResolvedValue({
        error: { message: 'Invalid login credentials' },
      });

      // Exhaust limit for IP 1
      mockHeaderValues({ 'x-forwarded-for': '198.51.100.1' });
      for (let i = 1; i <= 5; i++) {
        const fd = createFormData({
          email: 'admin@example.com',
          password: 'pass',
        });
        await expect(login(fd)).rejects.toThrow('Invalid%20login%20credentials');
      }

      // 6th attempt from IP 1 is blocked
      const blockedFd = createFormData({
        email: 'admin@example.com',
        password: 'pass',
      });
      await expect(login(blockedFd)).rejects.toThrow(
        encodeURIComponent('Too many login attempts. Please try again in 15 minutes.')
      );

      // Same account attempted from IP 2 is allowed
      mockHeaderValues({ 'x-forwarded-for': '198.51.100.2' });
      mockSignInWithPassword.mockResolvedValueOnce({ error: null });
      const allowedFd = createFormData({
        email: 'admin@example.com',
        password: 'correct-pass',
      });
      await expect(login(allowedFd)).rejects.toThrow('REDIRECT:/admin');
    });
  });

  describe('IP extraction headers', () => {
    it('parses the first IP from comma-separated x-forwarded-for header', async () => {
      mockHeaderValues({ 'x-forwarded-for': '10.0.0.1, 10.0.0.2, 10.0.0.3' });
      const fd = createFormData({
        email: 'user@example.com',
        password: 'pass',
      });
      await expect(login(fd)).rejects.toThrow('REDIRECT:/admin');
    });

    it('falls back to x-real-ip if x-forwarded-for is not present', async () => {
      mockHeaderValues({ 'x-real-ip': '172.16.0.1' });
      const fd = createFormData({
        email: 'user@example.com',
        password: 'pass',
      });
      await expect(login(fd)).rejects.toThrow('REDIRECT:/admin');
    });

    it('falls back to unknown if no IP headers are present', async () => {
      mockHeaderValues({});
      const fd = createFormData({
        email: 'user@example.com',
        password: 'pass',
      });
      await expect(login(fd)).rejects.toThrow('REDIRECT:/admin');
    });
  });
});

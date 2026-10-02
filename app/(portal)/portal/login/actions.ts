'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { rateLimit } from '@/app/lib/rate-limit';
import { createClient } from '@/app/lib/supabase/server';

const LOGIN_WINDOW_MS = 15 * 60_000;
const LOGIN_ACCOUNT_LIMIT = 5;
const LOGIN_IP_LIMIT = 20;

export type LoginState = {
  error?: string;
} | null;

export async function portalLogin(
  prevStateOrFormData: LoginState | FormData,
  formDataMaybe?: FormData
): Promise<LoginState> {
  const formData =
    formDataMaybe instanceof FormData
      ? formDataMaybe
      : prevStateOrFormData instanceof FormData
      ? prevStateOrFormData
      : null;

  if (!formData) {
    return { error: 'Invalid form submission.' };
  }

  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  if (!email || !password) {
    return { error: 'Email and password are required.' };
  }

  const headerList = await headers();
  const forwardedFor = headerList.get('x-forwarded-for');
  const realIp = headerList.get('x-real-ip');
  const ip = forwardedFor?.split(',')[0]?.trim() || realIp || 'unknown';

  const normalizedEmail = email.toLowerCase().trim();

  // Rate limit on IP alone to prevent distributed credential stuffing
  const ipLimit = rateLimit(`portal-login:ip:${ip}`, LOGIN_IP_LIMIT, LOGIN_WINDOW_MS);
  if (!ipLimit.allowed) {
    return {
      error: 'Too many login attempts. Please try again in 15 minutes.',
    };
  }

  // Rate limit per IP + account
  const accountLimit = rateLimit(
    `portal-login:${ip}:${normalizedEmail}`,
    LOGIN_ACCOUNT_LIMIT,
    LOGIN_WINDOW_MS
  );
  if (!accountLimit.allowed) {
    return {
      error: 'Too many login attempts. Please try again in 15 minutes.',
    };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return {
      error: error.message || 'Sign in failed. Please check your credentials.',
    };
  }

  // Clear caches and enter the school manager portal
  revalidatePath('/', 'layout');
  return redirect('/portal');
}

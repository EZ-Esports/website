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

  const { data: authData, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return {
      error: error.message || 'Sign in failed. Please check your credentials.',
    };
  }

  const userId = authData.user?.id;
  if (!userId) {
    return { error: 'Authentication failed.' };
  }

  // Verify that this user is registered as an active school manager
  const { db } = await import('@/app/lib/db');
  const schema = await import('@/app/lib/db/schema');
  const { eq, and, sql } = await import('drizzle-orm');

  const [managerRow] = await db
    .select({ id: schema.schoolManagers.id })
    .from(schema.schoolManagers)
    .where(
      and(
        eq(schema.schoolManagers.userId, userId),
        eq(schema.schoolManagers.isActive, true)
      )
    )
    .limit(1);

  if (!managerRow) {
    const [member] = await db
      .select({ id: schema.members.id })
      .from(schema.members)
      .where(sql`lower(${schema.members.email}) = ${normalizedEmail}`)
      .limit(1);

    const [managerByMember] = member
      ? await db
          .select({ id: schema.schoolManagers.id })
          .from(schema.schoolManagers)
          .where(
            and(
              eq(schema.schoolManagers.memberId, member.id),
              eq(schema.schoolManagers.isActive, true)
            )
          )
          .limit(1)
      : [null];

    if (!managerByMember) {
      const { getSchoolManagerContext } = await import('@/app/lib/onboarding/manager-auth');
      const staffContext = await getSchoolManagerContext(undefined, { allowStaffAdmin: true });
      if (!staffContext?.isStaffAdmin) {
        await supabase.auth.signOut();
        return {
          error:
            'This account does not have access to the School Manager Portal. If you are a league staff member, please use the Staff CMS login.',
        };
      }
    }
  }

  // Clear caches and enter the school manager portal
  revalidatePath('/', 'layout');
  return redirect('/portal');
}

export async function portalLogout(): Promise<never> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/portal/login');
}

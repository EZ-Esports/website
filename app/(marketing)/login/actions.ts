'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/app/lib/supabase/server';

export async function login(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  if (!email || !password) {
    return redirect('/login?error=' + encodeURIComponent('Email and password are required.'));
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    // Supabase auth messages are user-facing by design; pass them through.
    // Fall back to a generic message if the error somehow has no message.
    const msg = error.message || 'Sign-in failed. Please try again.';
    return redirect('/login?error=' + encodeURIComponent(msg));
  }

  // Clear caches and redirect to admin dashboard
  revalidatePath('/', 'layout');
  return redirect('/admin');
}

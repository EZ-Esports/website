'use client';

import { useFormStatus } from 'react-dom';

export default function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="w-full py-3 bg-ez-pink hover:bg-ez-pink/80 text-ez-black font-semibold rounded-lg shadow-lg hover:shadow-ez-pink/20 active:bg-ez-pink/70 focus:outline-none focus:ring-2 focus:ring-ez-pink focus:ring-offset-2 focus:ring-offset-background-secondary transition-all cursor-pointer mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {pending ? 'Signing in…' : 'Sign In'}
    </button>
  );
}

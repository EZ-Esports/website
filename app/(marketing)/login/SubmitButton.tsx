'use client';

import { useFormStatus } from 'react-dom';
import Button from '@/app/components/ui/Button';

export default function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant="primary"
      disabled={pending}
      aria-busy={pending}
      className="w-full mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {pending ? 'Signing in…' : 'Sign In'}
    </Button>
  );
}

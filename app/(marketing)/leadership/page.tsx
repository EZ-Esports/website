// app/(marketing)/leadership/page.tsx
import { redirect } from 'next/navigation';

export default function LeadershipIndex() {
  const currentYear = new Date().getFullYear().toString();
  redirect(`/leadership/${currentYear}`);
}
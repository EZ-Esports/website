import { getCachedLeadership } from '@/app/lib/db/queries';
import { redirect } from 'next/navigation';

export default async function LeadershipIndex() {
  // No try/catch here: a failed query should surface as a real error, not
  // silently redirect to a guessed (and possibly nonexistent) year. The
  // marketing route's error boundary (`app/(marketing)/error.tsx`) handles
  // it instead.
  let latestYear = new Date().getFullYear().toString();
  const allLeaders = await getCachedLeadership();
  if (allLeaders.length > 0) {
    const years = allLeaders.map((l) => parseInt(l.year, 10));
    latestYear = Math.max(...years).toString();
  }

  redirect(`/leadership/${latestYear}`);
}


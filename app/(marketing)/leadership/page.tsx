import { getCachedLeadership } from '@/app/lib/db/queries';
import { redirect } from 'next/navigation';

export default async function LeadershipIndex() {
  let latestYear = new Date().getFullYear().toString();
  try {
    const allLeaders = await getCachedLeadership();
    if (allLeaders.length > 0) {
      const years = allLeaders.map((l) => parseInt(l.year, 10));
      latestYear = Math.max(...years).toString();
    }
  } catch (error) {
    console.error('Failed to resolve latest leadership year', error);
  }

  redirect(`/leadership/${latestYear}`);
}


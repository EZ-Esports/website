import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { GAMES, GAME_SLUGS } from '@/app/lib/constants';
import type { GameSlug } from '@/app/types';
import Section from '@/app/components/ui/Section';
import { slugify } from '@/app/lib/text-utils';
import { getCachedSchools, getSchoolGameTeamsPageData } from '@/app/lib/db/queries';
import SchoolSnapshotsClient from './SchoolSnapshotsClient';

interface SchoolPageProps {
  params: Promise<{ game: string; school: string }>;
}

export async function generateMetadata({ params }: SchoolPageProps): Promise<Metadata> {
  const { game, school } = await params;
  if (!GAME_SLUGS.includes(game as GameSlug)) return {};
  const gameConfig = GAMES[game as GameSlug];

  try {
    const schoolRows = await getCachedSchools();
    const matchedSchool = schoolRows.find(
      (s) => s.slug === school || slugify(s.name) === school || s.id === school
    );

    const schoolName = matchedSchool ? matchedSchool.name : 'School';
    return {
      title: `${schoolName} - ${gameConfig.displayName} Teams & Rosters | EZ Esports`,
      description: `View ${schoolName} team snapshots, division rosters, and registered player profiles for EZ Esports ${gameConfig.displayName}.`,
    };
  } catch {
    return {
      title: `${gameConfig.displayName} School Teams & Rosters | EZ Esports`,
    };
  }
}

export default async function SchoolPage({ params }: SchoolPageProps) {
  const { game, school: schoolSlugParam } = await params;

  if (!GAME_SLUGS.includes(game as GameSlug)) {
    notFound();
  }

  const gameConfig = GAMES[game as GameSlug];
  const schoolData = await getSchoolGameTeamsPageData(game, schoolSlugParam);

  if (!schoolData) {
    notFound();
  }

  return (
    <main>
      <Section className="pt-20 md:pt-24">
        {/* Navigation Breadcrumb */}
        <div className="mb-6">
          <Link
            href={`/${game}/teams`}
            className="inline-flex items-center gap-2 text-xs font-bold text-accent hover:underline transition-colors group"
          >
            <span className="group-hover:-translate-x-0.5 transition-transform">←</span>
            <span>Back to All {gameConfig.displayName} Schools</span>
          </Link>
        </div>

        <SchoolSnapshotsClient school={schoolData} gameDisplayName={gameConfig.displayName} />
      </Section>
    </main>
  );
}

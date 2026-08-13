import { getCachedSchools } from '@/app/lib/db/queries';
import Section from '@/app/components/ui/Section';
import { SectionHeader } from '@/app/components/ui/SectionHeader';

type School = Awaited<ReturnType<typeof getCachedSchools>>[number];

/** Logo tile for a school that has a logo image: square artwork, name below. */
function SchoolLogoTile({ school }: { school: School }) {
  return (
    <div className="flex h-32 w-full flex-col items-center justify-center gap-2 p-3 rounded-2xl bg-surface-raised border border-line hover:border-accent/40 transition-all duration-200 group hover:scale-105 shadow-sm">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={school.logoUrl!}
        alt={`${school.name} logo`}
        loading="lazy"
        className="w-12 h-12 object-contain rounded-lg shrink-0"
      />
      <span className="text-xs text-foreground-secondary text-center font-medium group-hover:text-foreground transition-colors leading-tight line-clamp-2">
        {school.name}
      </span>
    </div>
  );
}

/** Name-first tile for a school with no logo on file. Matches SchoolLogoTile footprint for clean grid alignment. */
function SchoolNameChip({ school }: { school: School }) {
  return (
    <div className="flex h-32 w-full flex-col items-center justify-center p-4 rounded-2xl bg-surface-raised border border-line hover:border-accent/40 transition-all duration-200 group hover:scale-105 shadow-sm">
      <span className="text-xs sm:text-sm text-foreground text-center font-semibold leading-snug group-hover:text-accent transition-colors line-clamp-3">
        {school.name}
      </span>
    </div>
  );
}

export default async function SchoolWall() {
  let schools: Awaited<ReturnType<typeof getCachedSchools>> = [];
  try {
    schools = await getCachedSchools();
  } catch (error) {
    console.error('Failed to load schools for homepage', error);
  }

  if (!schools || schools.length === 0) return null;

  return (
    <Section tone="sunken" className="border-t border-line">
      <SectionHeader eyebrow="Member Schools" title="Our Schools" />

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 max-w-6xl mx-auto">
        {schools.map((school) => {
          const hasLogo = Boolean(school.logoUrl);
          const tile = hasLogo ? (
            <SchoolLogoTile school={school} />
          ) : (
            <SchoolNameChip school={school} />
          );

          if (school.websiteUrl) {
            return (
              <a
                key={school.id}
                href={school.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full h-32"
              >
                {tile}
              </a>
            );
          }

          return (
            <div key={school.id} className="block w-full h-32">
              {tile}
            </div>
          );
        })}
      </div>
    </Section>
  );
}

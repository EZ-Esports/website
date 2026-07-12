import { getCachedSchools } from '@/app/lib/db/queries';
import { SectionHeader } from '@/app/components/ui/SectionHeader';

type School = Awaited<ReturnType<typeof getCachedSchools>>[number];

/** Logo tile for a school that has a logo image: square artwork, name below. */
function SchoolLogoTile({ school }: { school: School }) {
  return (
    <div className="flex h-full flex-col items-center gap-3 p-4 rounded-xl bg-surface-raised border border-line hover:border-accent/40 transition-all duration-200 group hover:scale-105">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={school.logoUrl!}
        alt={`${school.name} logo`}
        loading="lazy"
        className="w-16 h-16 object-contain rounded-lg"
      />
      <span className="text-sm text-foreground-secondary text-center font-medium group-hover:text-foreground transition-colors leading-tight">
        {school.name}
      </span>
    </div>
  );
}

/**
 * Name-first chip for a school with no logo on file. Rather than a generated
 * monogram square (which collided/looked repetitive across ~27 schools with no
 * artwork), this reads as a bordered pill sized to its text so school names
 * stay on one line instead of being squeezed into a fixed logo-tile square.
 */
function SchoolNameChip({ school }: { school: School }) {
  return (
    <div className="flex items-center px-5 py-3 rounded-full bg-surface-raised border border-line hover:border-accent/40 transition-all duration-200 group hover:scale-105">
      <span className="text-sm text-foreground text-center font-semibold whitespace-nowrap group-hover:text-accent transition-colors">
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
    <section className="bg-surface-sunken py-16 md:py-24 border-t border-line">
      <div className="container mx-auto px-4">
        <SectionHeader eyebrow="Member Schools" title="Our Schools" />

        <div className="flex flex-wrap justify-center items-start gap-4 max-w-5xl mx-auto">
          {schools.map((school) => {
            const hasLogo = Boolean(school.logoUrl);
            const tile = hasLogo ? (
              <SchoolLogoTile school={school} />
            ) : (
              <SchoolNameChip school={school} />
            );
            // Logo tiles share a fixed square footprint so the artwork grid stays
            // even; name chips size to their own text instead.
            const wrapperClassName = hasLogo ? 'block h-full w-32 sm:w-36' : 'block';

            if (school.websiteUrl) {
              return (
                <a
                  key={school.id}
                  href={school.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={wrapperClassName}
                >
                  {tile}
                </a>
              );
            }

            return (
              <div key={school.id} className={wrapperClassName}>
                {tile}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

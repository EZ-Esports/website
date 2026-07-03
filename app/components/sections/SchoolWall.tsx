import { getCachedSchools } from '@/app/lib/db/queries';

export default async function SchoolWall() {
  let schools: Awaited<ReturnType<typeof getCachedSchools>> = [];
  try {
    schools = await getCachedSchools();
  } catch (error) {
    console.error('Failed to load schools for homepage', error);
  }

  if (!schools || schools.length === 0) return null;

  return (
    <section className="bg-[#0a0a0a] py-16 md:py-24 border-t border-zinc-900">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <span className="text-ez-pink uppercase tracking-widest text-xs font-bold text-center mb-3 block">
            Member Schools
          </span>
          <h2 className="text-white font-black tracking-tight text-3xl sm:text-4xl md:text-5xl text-center">
            Our Schools
          </h2>
          <div className="w-12 h-0.5 bg-gradient-to-r from-ez-pink to-ez-purple mx-auto mt-4" />
        </div>

        <div className="flex flex-wrap justify-center gap-4 max-w-5xl mx-auto">
          {schools.map((school) => {
            const initials = school.name
              .split(' ')
              .map((w) => w[0])
              .join('')
              .slice(0, 3)
              .toUpperCase();

            const cardContent = (
              <div className="flex h-full flex-col items-center gap-3 p-4 rounded-xl bg-[#111111] border border-zinc-800 hover:border-ez-pink/40 transition-all duration-200 group hover:scale-105">
                {school.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={school.logoUrl}
                    alt={`${school.name} logo`}
                    loading="lazy"
                    className="w-16 h-16 object-contain rounded-lg"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400 font-bold text-lg">
                    {initials}
                  </div>
                )}
                <span className="text-sm text-zinc-300 text-center font-medium group-hover:text-white transition-colors leading-tight">
                  {school.name}
                </span>
              </div>
            );

            if (school.websiteUrl) {
              return (
                <a
                  key={school.id}
                  href={school.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-32 sm:w-36"
                >
                  {cardContent}
                </a>
              );
            }

            return (
              <div key={school.id} className="w-32 sm:w-36">
                {cardContent}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

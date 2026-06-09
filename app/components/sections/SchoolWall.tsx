import { getCachedSchools } from '@/app/lib/db/queries';

export default async function SchoolWall() {
  const schools = await getCachedSchools();

  if (!schools || schools.length === 0) return null;

  return (
    <section className="bg-[#0a0a0a] py-16 md:py-24 border-t border-zinc-900">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <span className="text-ez-pink uppercase tracking-widest text-xs font-bold text-center mb-3 block">
            Member Schools
          </span>
          <h2 className="text-white font-bold text-3xl md:text-4xl text-center">
            Our Schools
          </h2>
          <div className="w-12 h-0.5 bg-ez-pink mx-auto mt-4" />
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-4 max-w-5xl mx-auto">
          {schools.map((school) => {
            const initials = school.name
              .split(' ')
              .map((w) => w[0])
              .join('')
              .slice(0, 3)
              .toUpperCase();

            const cardContent = (
              <div className="flex flex-col items-center gap-3 p-4 rounded-xl bg-[#111111] border border-zinc-800 hover:border-ez-pink/40 transition-all duration-200 group hover:scale-105">
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
                  className="block"
                >
                  {cardContent}
                </a>
              );
            }

            return (
              <div key={school.id}>
                {cardContent}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

import type { Metadata } from 'next';
import Image from 'next/image';
import { Eyebrow, SectionHeader } from '@/app/components/ui/SectionHeader';
import Button from '@/app/components/ui/Button';
import { getCachedSponsors } from '@/app/lib/db/queries';
import SponsorMarquee from './SponsorMarquee';

export const metadata: Metadata = {
  title: 'Sponsors & Partners | EZ Esports',
  description:
    'Partner with EZ Esports, NYC\'s premier high-school esports league. View sponsorship tiers and get in touch to build something great together.',
};

const CONTACT_EMAIL = 'mailto:info@ezesports.org';

const TIER_FEATURES = [
  { label: 'Logo on website', platinum: true, gold: true, community: true },
  { label: 'Social media recognition', platinum: true, gold: true, community: true },
  { label: 'Brand presence at events', platinum: true, gold: true, community: false },
  { label: 'Broadcast overlay placement', platinum: true, gold: false, community: false },
  { label: 'Featured in all social posts', platinum: true, gold: false, community: false },
  { label: 'Tournament naming rights', platinum: true, gold: false, community: false },
];

export default async function SponsorsPage() {
  let sponsors: Awaited<ReturnType<typeof getCachedSponsors>> = [];
  try {
    sponsors = await getCachedSponsors();
  } catch (err) {
    console.error('Failed to load sponsors', err);
  }

  return (
    <>
      <div className="flex flex-col lg:min-h-screen">
        <section className="relative overflow-hidden border-b border-line lg:flex lg:flex-1 lg:flex-col">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse at 15% 10%, color-mix(in srgb, var(--color-accent) 9%, transparent), transparent 55%)',
            }}
            aria-hidden="true"
          />
          <div className="relative grid gap-10 pt-28 sm:pt-32 md:pt-36 lg:flex-1 lg:grid-cols-2 lg:gap-0">
            <div className="flex flex-col justify-center pb-20 pl-8 pr-6 text-left sm:pb-24 sm:pl-12 sm:pr-10 md:pl-16 md:pr-12 lg:pl-24 lg:pr-16">
              <Eyebrow>Partner with EZ Esports</Eyebrow>
              <h1 className="mt-5 text-4xl font-black uppercase leading-[0.98] tracking-tight text-foreground sm:text-5xl md:text-6xl lg:text-7xl">
                Reach &amp; Inspire
                <br />
                <span className="text-accent drop-shadow-[0_4px_26px_color-mix(in_srgb,var(--color-accent)_40%,transparent)]">
                  the Future
                </span>
              </h1>
              <p className="mt-8 max-w-lg text-lg leading-relaxed text-foreground-secondary sm:text-xl">
                EZ Esports is NYC&apos;s premier high-school esports league. Every match, broadcast, and
                tournament puts your brand in front of the students, families, and schools shaping the
                city&apos;s next generation of competitive gaming.
              </p>
              {sponsors.length > 0 && (
                <p className="mt-8 text-sm font-extrabold uppercase tracking-widest text-foreground-muted sm:text-base">
                  — Join others in supporting EZ Esports
                </p>
              )}
            </div>

            <div className="flex min-h-[160px] items-center justify-center px-6 pb-20 sm:min-h-[200px] sm:px-10 md:pb-24 lg:min-h-0 lg:px-16">
              <Image
                src="/images/logos/wordmark.png"
                alt="EZ Esports"
                width={747}
                height={228}
                className="h-auto w-full max-w-sm opacity-95 sm:max-w-md md:max-w-lg lg:max-w-xl xl:max-w-2xl"
              />
            </div>
          </div>
        </section>

        {sponsors.length > 0 ? (
          <SponsorMarquee
            sponsors={sponsors.map((s) => ({ id: s.id, name: s.name, logoUrl: s.logoUrl }))}
          />
        ) : (
          <div className="border-y border-line bg-surface-raised py-6 text-center">
            <p className="text-sm font-medium text-foreground-secondary">
              Partner announcements coming soon.
            </p>
            <p className="mt-1 text-xs text-foreground-muted">
              Interested in supporting NYC&apos;s high-school esports scene?{' '}
              <a href={CONTACT_EMAIL} className="text-accent hover:underline">
                Get in touch.
              </a>
            </p>
          </div>
        )}
      </div>

      <section className="relative flex flex-col justify-center border-t border-line bg-surface-raised py-16 md:py-24 lg:min-h-screen lg:py-20">
        <div className="container mx-auto max-w-6xl px-4">
          <SectionHeader
            title="Become a Sponsor"
            lead="Interested in partnering with NYC's premier high school esports league? Compare tiers below and let's build something together."
          />
          <Eyebrow className="mb-4 block text-center">Sponsorship Tiers</Eyebrow>
          <div className="overflow-hidden rounded-2xl border border-line shadow-2xl shadow-black/20">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] table-fixed border-collapse bg-surface-raised/60 text-sm">
                <colgroup>
                  <col className="w-[34%]" />
                  <col className="w-[22%]" />
                  <col className="w-[22%]" />
                  <col className="w-[22%]" />
                </colgroup>
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 bg-surface-raised px-4 py-6 text-left" scope="col">
                      <span className="sr-only">Feature</span>
                    </th>
                    <th className="border-l border-accent/20 bg-accent/10 px-4 py-6 text-center" scope="col">
                      <span className="inline-flex items-center justify-center gap-1.5 text-lg font-black text-accent">
                        <svg className="h-4 w-4 fill-current shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M12 2L2 12l10 10 10-10L12 2z" />
                        </svg>
                        Platinum
                      </span>
                    </th>
                    <th className="px-4 py-6 text-center" scope="col">
                      <span className="inline-flex items-center justify-center gap-1.5 text-lg font-black text-warning">
                        <svg className="h-3.5 w-3.5 fill-current shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                          <circle cx="12" cy="12" r="10" />
                        </svg>
                        Gold
                      </span>
                    </th>
                    <th className="px-4 py-6 text-center" scope="col">
                      <span className="inline-flex items-center justify-center gap-1.5 text-lg font-black text-foreground-muted">
                        <svg className="h-4 w-4 fill-current shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M12 3L2 21h20L12 3z" />
                        </svg>
                        Community
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {TIER_FEATURES.map((row) => (
                    <tr key={row.label} className="border-t border-line">
                      <th
                        scope="row"
                        className="sticky left-0 z-10 bg-surface-raised px-4 py-4 text-left font-semibold text-foreground-secondary"
                      >
                        {row.label}
                      </th>
                      <td className="border-l border-accent/20 bg-accent/10 px-4 py-4 text-center text-base font-black">
                        {row.platinum ? (
                          <span className="text-accent" aria-label="Included">✓</span>
                        ) : (
                          <span className="text-foreground-muted" aria-label="Not included">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-center text-base font-black">
                        {row.gold ? (
                          <span className="text-accent" aria-label="Included">✓</span>
                        ) : (
                          <span className="text-foreground-muted" aria-label="Not included">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-center text-base font-black">
                        {row.community ? (
                          <span className="text-accent" aria-label="Included">✓</span>
                        ) : (
                          <span className="text-foreground-muted" aria-label="Not included">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="mt-3 text-center text-xs text-foreground-muted lg:hidden">
            ← Swipe to compare tiers →
          </p>

          <div className="mt-12 flex justify-center md:mt-16">
            <Button href={CONTACT_EMAIL} variant="primary" size="md" className="lg:px-10 lg:py-3.5 lg:text-lg">
              Get in Touch
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}

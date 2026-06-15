import type { Metadata } from 'next';
import Image from 'next/image';
import Hero from '@/app/components/sections/Hero';
import ContentSection from '@/app/components/sections/ContentSection';
import Card from '@/app/components/ui/Card';
import Button from '@/app/components/ui/Button';
import { getCachedSponsors } from '@/app/lib/db/queries';

export const metadata: Metadata = {
  title: 'Sponsors & Partners | EZ Esports',
  description:
    'Partner with EZ Esports, NYC\'s premier high-school esports league. View sponsorship tiers and get in touch to build something great together.',
};

const CONTACT_EMAIL = 'mailto:info@ezesports.org';

export default async function SponsorsPage() {
  let sponsors: Awaited<ReturnType<typeof getCachedSponsors>> = [];
  try {
    sponsors = await getCachedSponsors();
  } catch (err) {
    console.error('Failed to load sponsors', err);
  }

  return (
    <>
      <Hero
        title="Partner with EZ Esports"
        backgroundImage="/images/hero-background.png"
        size="medium"
      />

      <ContentSection heading="OUR PARTNERS" description="" theme="dark">
        {sponsors.length === 0 ? (
          <div className="text-center py-12 text-foreground-secondary">
            <div className="w-16 h-16 rounded-full bg-background-secondary border border-custom-border/60 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-foreground-secondary/40" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <p className="text-base font-medium">Partner announcements coming soon.</p>
            <p className="text-sm mt-2 text-foreground-secondary/70">
              Interested in supporting NYC&apos;s high-school esports scene?{' '}
              <a href={CONTACT_EMAIL} className="text-ez-pink hover:underline">Get in touch.</a>
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap justify-center gap-6">
              {sponsors.map((sponsor) => (
                <div
                  key={sponsor.id}
                  className="w-[calc(50%_-_0.75rem)] md:w-[calc(25%_-_1.125rem)] rounded-xl border border-custom-border/60 bg-background-secondary/40 aspect-video flex flex-col items-center justify-center gap-2 p-4"
                >
                  {sponsor.logoUrl ? (
                    <Image
                      src={sponsor.logoUrl}
                      alt={`${sponsor.name} logo`}
                      width={120}
                      height={60}
                      className="object-contain max-h-16 w-auto"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-foreground-secondary/20" aria-hidden="true" />
                  )}
                  <span className="text-foreground-secondary text-sm font-semibold text-center">{sponsor.name}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </ContentSection>

      <ContentSection heading="SPONSORSHIP TIERS" description="" theme="light">
        <div className="grid md:grid-cols-3 gap-6">
          {/* Platinum */}
          <Card className="border-2 border-ez-pink/60 flex flex-col gap-4">
            <h3 className="text-foreground font-bold text-xl">Platinum</h3>
            <ul className="space-y-2 flex-1">
              {[
                'Premier visibility across all EZ Esports events',
                'Logo on broadcast overlays',
                'Featured in all social media',
                'Naming rights for a tournament',
              ].map((benefit) => (
                <li key={benefit} className="flex items-start gap-2 text-foreground-secondary text-sm">
                  <span className="text-ez-pink mt-0.5 shrink-0" aria-hidden="true">✓</span>
                  {benefit}
                </li>
              ))}
            </ul>
            <Button href={CONTACT_EMAIL} variant="primary" className="w-full">
              Get in Touch
            </Button>
          </Card>

          {/* Gold */}
          <Card className="flex flex-col gap-4">
            <h3 className="text-foreground font-bold text-xl">Gold</h3>
            <ul className="space-y-2 flex-1">
              {[
                'Brand presence at events',
                'Logo on website and materials',
                'Social media mention package',
              ].map((benefit) => (
                <li key={benefit} className="flex items-start gap-2 text-foreground-secondary text-sm">
                  <span className="text-ez-pink mt-0.5 shrink-0" aria-hidden="true">✓</span>
                  {benefit}
                </li>
              ))}
            </ul>
            <Button href={CONTACT_EMAIL} variant="secondary" className="w-full">
              Get in Touch
            </Button>
          </Card>

          {/* Community */}
          <Card className="flex flex-col gap-4">
            <h3 className="text-foreground font-bold text-xl">Community</h3>
            <ul className="space-y-2 flex-1">
              {[
                'Logo on website',
                'Social media recognition',
                'Newsletter feature',
              ].map((benefit) => (
                <li key={benefit} className="flex items-start gap-2 text-foreground-secondary text-sm">
                  <span className="text-ez-pink mt-0.5 shrink-0" aria-hidden="true">✓</span>
                  {benefit}
                </li>
              ))}
            </ul>
            <Button href={CONTACT_EMAIL} variant="secondary" className="w-full">
              Get in Touch
            </Button>
          </Card>
        </div>
      </ContentSection>

      <ContentSection heading="GET IN TOUCH" description="" theme="dark">
        <div className="flex flex-col items-center gap-6 text-center max-w-2xl mx-auto">
          <p className="text-foreground-secondary text-lg leading-relaxed">
            Interested in partnering with NYC&apos;s premier high school esports league? Reach out and let&apos;s build something together.
          </p>
          <Button href={CONTACT_EMAIL} variant="primary">
            Contact Us
          </Button>
        </div>
      </ContentSection>
    </>
  );
}

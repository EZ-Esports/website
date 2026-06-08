import Hero from '@/app/components/sections/Hero';
import ContentSection from '@/app/components/sections/ContentSection';
import Card from '@/app/components/ui/Card';
import Button from '@/app/components/ui/Button';

const CONTACT_EMAIL = 'mailto:ezesports@placeholder.com';

const PARTNERS = [
  { name: 'Nike' },
  { name: 'Roc Nation' },
  { name: 'Gen.G' },
  { name: 'ByteDance' },
];

export default function SponsorsPage() {
  return (
    <>
      <Hero
        title="Partner with EZ Esports"
        backgroundImage="/images/hero-background.png"
        size="medium"
      />

      <ContentSection heading="OUR PARTNERS" description="" theme="dark">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {PARTNERS.map((partner) => (
            <div
              key={partner.name}
              className="rounded-xl border border-custom-border/60 bg-background-secondary/40 aspect-video flex flex-col items-center justify-center gap-2"
            >
              <div className="w-12 h-12 rounded-lg bg-foreground-secondary/20" />
              <span className="text-foreground-secondary text-sm font-semibold">{partner.name}</span>
            </div>
          ))}
        </div>
        <p className="text-foreground-secondary text-sm text-center italic mt-6">
          Partner logos coming soon.
        </p>
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
                  <span className="text-ez-pink mt-0.5 shrink-0">✓</span>
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
                  <span className="text-ez-pink mt-0.5 shrink-0">✓</span>
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
                  <span className="text-ez-pink mt-0.5 shrink-0">✓</span>
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

import type { Metadata } from 'next';
import Link from 'next/link';
import Hero from '@/app/components/sections/Hero';
import Section from '@/app/components/ui/Section';

export const metadata: Metadata = {
  title: 'League Rulebook & Code of Conduct | EZ Esports',
  description:
    'The League Rulebook & Code of Conduct is being finalized with league leadership and is not yet published.',
};

export default function RulesPage() {
  return (
    <main>
      <Hero
        title="League Rulebook & Code of Conduct"
        backgroundImage="/images/hero-background.jpg"
        size="medium"
      />

      <Section width="narrow">
        <div className="max-w-3xl mx-auto space-y-6 text-foreground-secondary text-sm sm:text-base leading-relaxed">
          <p>
            The official League Rulebook &amp; Code of Conduct is currently being finalized with
            league leadership and is not yet published.
          </p>
          <p>
            Competition eligibility, conduct, and match-procedure rules will be published on this
            page before they are required of participants. Preliminary interest does not require
            acceptance of the Rulebook; that will come later, at final player or team
            registration.
          </p>
          <p>
            In the meantime, our{' '}
            <Link href="/terms" className="text-accent hover:underline">
              Terms of Use
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="text-accent hover:underline">
              Privacy Policy
            </Link>{' '}
            are fully published. If you have questions, contact us at{' '}
            <a href="mailto:info@ezesports.org" className="text-accent hover:underline">
              info@ezesports.org
            </a>
            .
          </p>
        </div>
      </Section>
    </main>
  );
}

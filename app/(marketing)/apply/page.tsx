import type { Metadata } from 'next';
import Hero from '@/app/components/sections/Hero';
import ContentSection from '@/app/components/sections/ContentSection';
import Card from '@/app/components/ui/Card';
import ApplyForm from './ApplyForm';

export const metadata: Metadata = {
  title: 'Apply to Join | EZ Esports',
  description:
    'Bring EZ Esports to your NYC high school. Apply to join the league and give your students competitive esports opportunities in Valorant, League of Legends, and TFT.',
};

export default function ApplyPage() {
  return (
    <>
      <Hero
        title="Bring EZ Esports to Your School"
        backgroundImage="/images/hero-background.png"
        size="medium"
      />

      <ContentSection heading="WHY JOIN EZ ESPORTS" description="" theme="dark">
        <div className="grid md:grid-cols-3 gap-6">
          <Card>
            <h3 className="text-foreground font-bold text-lg mb-3">Organized Competition</h3>
            <p className="text-foreground-secondary text-sm leading-relaxed">
              Structured leagues across League of Legends, Valorant, and Teamfight Tactics with real standings and match schedules.
            </p>
          </Card>
          <Card>
            <h3 className="text-foreground font-bold text-lg mb-3">Live Streaming</h3>
            <p className="text-foreground-secondary text-sm leading-relaxed">
              Professional broadcast infrastructure that showcases your students to audiences across NYC.
            </p>
          </Card>
          <Card>
            <h3 className="text-foreground font-bold text-lg mb-3">Community &amp; Career Paths</h3>
            <p className="text-foreground-secondary text-sm leading-relaxed">
              Connect students with the broader esports ecosystem and pathways into gaming and technology careers.
            </p>
          </Card>
        </div>
      </ContentSection>

      <ApplyForm />
    </>
  );
}

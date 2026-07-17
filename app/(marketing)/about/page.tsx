import type { Metadata } from 'next';
import Hero from '@/app/components/sections/Hero';
import Section from '@/app/components/ui/Section';
import { SectionHeader } from '@/app/components/ui/SectionHeader';
import Card from '@/app/components/ui/Card';
import StatTile from '@/app/components/ui/StatTile';
import { getCachedSchools, getCachedPlayers, getCachedGames } from '@/app/lib/db/queries';

export const metadata: Metadata = {
  title: 'About EZ Esports | NYC High School Esports League',
  description:
    'Learn about EZ Esports — founded in 2021 by NYC high school students, building community and competitive esports pathways across the five boroughs.',
};

export default async function AboutPage() {
  let schoolCount = 0;
  let playerCount = 0;
  let gameCount = 0;
  try {
    const [schools, players, games] = await Promise.all([
      getCachedSchools(),
      getCachedPlayers(),
      getCachedGames(),
    ]);
    schoolCount = schools.length;
    playerCount = players.length;
    gameCount = games.length;
  } catch (error) {
    console.error('Failed to load About page stats', error);
  }

  return (
    <main>
      <Hero
        title="About EZ Esports"
        backgroundImage="/images/hero-background.jpg"
      />

      <Section>
        <SectionHeader title="Our Mission" />
        <div className="max-w-4xl mx-auto space-y-6 text-base sm:text-lg leading-relaxed text-center text-foreground-secondary">
          <p>
            EZ Esports was founded in November 2021 and developed by various NYC high school student club officers to provide their club members opportunity to compete in an accessible and organized esports league.
          </p>
          <p>
            Our mission is to provide competitive esports opportunities to NYC high school students, building community, developing skills, and creating pathways to careers in gaming and technology. We believe that esports can be a powerful tool for student engagement, skill development, and career preparation.
          </p>
          <p>
            Through our organized leagues, live streaming infrastructure, and community events, we bring together students from across New York City to compete, learn, and grow together. Our platform showcases student talent and builds lasting connections between schools, students, and the broader esports community.
          </p>
        </div>
      </Section>

      <Section tone="raised">
        <SectionHeader
          title="What We Do"
          lead="High schools from across New York City competing in live-streamed leagues with varsity and JV divisions"
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <StatTile value={schoolCount > 0 ? schoolCount : '—'} label="Participating Schools" />
          <StatTile value={playerCount > 0 ? playerCount : '—'} label="Registered Players" />
          <StatTile value={gameCount > 0 ? gameCount : '—'} label="Competition Titles" />
        </div>
      </Section>

      <Section>
        <SectionHeader title="Our Values" />
        <div className="max-w-4xl mx-auto space-y-6">
          <Card interactive>
            <h3 className="text-2xl font-black text-foreground mb-3">Accessibility</h3>
            <p className="text-foreground-secondary leading-relaxed text-sm sm:text-base">
              We believe esports should be accessible to all students, regardless of skill level or background. Our league structure accommodates both varsity and junior varsity divisions.
            </p>
          </Card>
          <Card interactive>
            <h3 className="text-2xl font-black text-foreground mb-3">Community</h3>
            <p className="text-foreground-secondary leading-relaxed text-sm sm:text-base">
              Building connections between students, schools, and the broader esports community is at the heart of what we do. We foster a supportive and inclusive environment.
            </p>
          </Card>
          <Card interactive>
            <h3 className="text-2xl font-black text-foreground mb-3">Excellence</h3>
            <p className="text-foreground-secondary leading-relaxed text-sm sm:text-base">
              We strive for excellence in competition, organization, and student development. Our structured leagues and professional streaming infrastructure reflect this commitment.
            </p>
          </Card>
        </div>
      </Section>
    </main>
  );
}

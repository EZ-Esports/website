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
        <SectionHeader title="Our Vision & Mission" />
        <div className="max-w-4xl mx-auto space-y-6 text-base sm:text-lg leading-relaxed text-center text-foreground-secondary">
          <p className="text-2xl sm:text-3xl font-black text-foreground">
            &quot;Shaping the leaders of tomorrow through their passion for esports today.&quot;
          </p>
          <p className="text-xl text-primary font-bold">
            Empowering youth through building esports infrastructure in schools.
          </p>
        </div>
      </Section>

      <Section tone="raised">
        <SectionHeader title="Our History" />
        <div className="max-w-4xl mx-auto space-y-6 text-base sm:text-lg leading-relaxed text-foreground-secondary">
          <p>
            EZ Esports was founded in November 2021 by Edison Zhong, a student at Susan Wagner High School. Driven by a desire to play interschool esports, Edison found no support in the Public Schools Athletic League (PSAL).
          </p>
          <p>
            When over 200 students signed up at his school alone, it became clear there was a massive unmet need. This spurred him and other high school club leaders to build a city-wide league from scratch, run by students, for students.
          </p>
        </div>
      </Section>

      <Section>
        <SectionHeader
          title="By the Numbers"
          lead="Growing rapidly and empowering high-achieving students across NYC."
        />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatTile value="100%" label="Growth (2022-2023)" />
          <StatTile value={schoolCount > 0 ? schoolCount : '28'} label="Participating Schools" />
          <StatTile value={playerCount > 0 ? playerCount : '2,800'} label="Registered Players" />
          <StatTile value={gameCount > 0 ? gameCount : '—'} label="Competition Titles" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card interactive className="backdrop-blur-md bg-white/5 border-white/10 p-6 flex flex-col items-center justify-center text-center">
            <h3 className="text-4xl font-black text-primary mb-2">47%</h3>
            <p className="text-foreground-secondary font-medium">First-generation college students</p>
          </Card>
          <Card interactive className="backdrop-blur-md bg-white/5 border-white/10 p-6 flex flex-col items-center justify-center text-center">
            <h3 className="text-4xl font-black text-primary mb-2">71%</h3>
            <p className="text-foreground-secondary font-medium">Enrolled in Honors, IB, or AP courses</p>
          </Card>
          <Card interactive className="backdrop-blur-md bg-white/5 border-white/10 p-6 flex flex-col items-center justify-center text-center">
            <h3 className="text-4xl font-black text-primary mb-2">85%</h3>
            <p className="text-foreground-secondary font-medium">Student-run operations (no paid staff)</p>
          </Card>
        </div>
        <div className="text-center mt-8 text-foreground-secondary text-lg">
          <p>Over <strong className="text-primary font-bold">1/3</strong> of our student staff are accepted into top-25 universities.</p>
        </div>
      </Section>

      <Section tone="raised">
        <SectionHeader title="Student-Run Operations" />
        <div className="max-w-4xl mx-auto space-y-6">
          <Card interactive className="p-8 backdrop-blur-sm bg-background/50 border-primary/20">
            <h3 className="text-2xl font-black text-foreground mb-4">Corporate Mimicry</h3>
            <p className="text-foreground-secondary leading-relaxed text-sm sm:text-base mb-4">
              Our league organizes its staff into 10 distinct divisions—including Marketing, Engineering, and Operations—led by our dedicated alumni. This unique structure provides real-world corporate experience without an operating budget.
            </p>
            <p className="text-foreground-secondary leading-relaxed text-sm sm:text-base">
              Students get hands-on experience and learn valuable skills such as shoutcasting, graphic design, live stream production, and organizational management.
            </p>
          </Card>
        </div>
      </Section>
    </main>
  );
}

import type { Metadata } from 'next';
import ContentSection from '@/app/components/sections/ContentSection';
import Hero from '@/app/components/sections/Hero';
import Card from '@/app/components/ui/Card';
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
        backgroundImage="/images/hero-background.png"
      />

      <ContentSection
        heading="OUR MISSION"
        description=""
        theme="dark"
      >
        <div className="max-w-4xl mx-auto space-y-6 text-base sm:text-lg leading-relaxed text-center text-slate-300">
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
      </ContentSection>

      <ContentSection
        heading="WHAT WE DO"
        description=""
        theme="light"
      >
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          <Card className="text-center hover:scale-[1.03] duration-300">
            <div className="text-5xl font-black text-white mb-4">{schoolCount > 0 ? schoolCount : '—'}</div>
            <div className="text-xl font-bold text-white mb-2">Participating Schools</div>
            <div className="text-slate-400 text-sm">High schools from across New York City</div>
          </Card>
          <Card className="text-center hover:scale-[1.03] duration-300">
            <div className="text-5xl font-black text-white mb-4">{playerCount > 0 ? playerCount : '—'}</div>
            <div className="text-xl font-bold text-white mb-2">Registered Players</div>
            <div className="text-slate-400 text-sm">Students competing across our leagues</div>
          </Card>
          <Card className="text-center hover:scale-[1.03] duration-300">
            <div className="text-5xl font-black text-white mb-4">{gameCount > 0 ? gameCount : '—'}</div>
            <div className="text-xl font-bold text-white mb-2">Competition Titles</div>
            <div className="text-slate-400 text-sm">Live-streamed leagues with varsity & JV divisions</div>
          </Card>
        </div>
      </ContentSection>

      <ContentSection
        heading="OUR VALUES"
        description=""
        theme="dark"
      >
        <div className="max-w-4xl mx-auto space-y-6">
          <Card className="hover:scale-[1.01] duration-300">
            <h3 className="text-2xl font-black text-white mb-3">Accessibility</h3>
            <p className="text-slate-300 leading-relaxed text-sm sm:text-base">
              We believe esports should be accessible to all students, regardless of skill level or background. Our league structure accommodates both varsity and junior varsity divisions.
            </p>
          </Card>
          <Card className="hover:scale-[1.01] duration-300">
            <h3 className="text-2xl font-black text-white mb-3">Community</h3>
            <p className="text-slate-300 leading-relaxed text-sm sm:text-base">
              Building connections between students, schools, and the broader esports community is at the heart of what we do. We foster a supportive and inclusive environment.
            </p>
          </Card>
          <Card className="hover:scale-[1.01] duration-300">
            <h3 className="text-2xl font-black text-white mb-3">Excellence</h3>
            <p className="text-slate-300 leading-relaxed text-sm sm:text-base">
              We strive for excellence in competition, organization, and student development. Our structured leagues and professional streaming infrastructure reflect this commitment.
            </p>
          </Card>
        </div>
      </ContentSection>
    </main>
  );
}

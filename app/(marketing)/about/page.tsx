import type { Metadata } from 'next';
import AboutHero from '@/app/components/sections/AboutHero';
import Section from '@/app/components/ui/Section';
import { Eyebrow } from '@/app/components/ui/SectionHeader';
import GradientRule from '@/app/components/ui/GradientRule';
import Card from '@/app/components/ui/Card';
import CutCTA from '@/app/components/ui/CutCTA';
import ScrollReveal from '@/app/components/ui/ScrollReveal';
import { cx } from '@/app/lib/cx';
import { getCachedSchools, getCachedPlayers, getCachedGames } from '@/app/lib/db/queries';
import { ROUTES, SOCIAL_LINKS, GAMES, GAME_SLUGS } from '@/app/lib/constants';

export const metadata: Metadata = {
  title: 'About EZ Esports | NYC High School Esports League',
  description:
    'Learn about EZ Esports, founded in 2021 by NYC high school students, building community and competitive esports pathways across the five boroughs.',
};

const DIVISIONS = [
  { name: 'Marketing', description: 'Brand, social, and community growth for the league.' },
  { name: 'Engineering', description: "Builds and maintains the league's competitive infrastructure." },
  { name: 'Operations', description: 'Scheduling, standings, and day-to-day league logistics.' },
];

const SKILLS = ['Shoutcasting', 'Graphic design', 'Live stream production', 'Organizational management'];

const HISTORY = [
  {
    tag: 'Nov 2021',
    title: 'Founded at Susan Wagner High School',
    body: 'Edison Zhong wanted to play interschool esports. The Public Schools Athletic League had no support for it, so he built the league himself.',
  },
  {
    tag: 'Week 1',
    title: '200+ sign-ups, one school',
    body: "The response at Edison's own school made the unmet demand impossible to ignore. This needed to be bigger than one campus.",
  },
  {
    tag: '2022 →',
    title: 'A five-borough league, student-built',
    body: 'Other high school club leaders joined in, growing EZ Esports into a city-wide league run from scratch by students, for students.',
  },
];

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

  const discordLink = SOCIAL_LINKS.find((link) => link.platform === 'discord')?.url
    || 'https://discord.com/invite/RajSZqNyvu';

  const scoreboard = [
    { value: schoolCount > 0 ? schoolCount : 28, label: 'Schools' },
    { value: playerCount > 0 ? playerCount.toLocaleString() : '2,800', label: 'Players' },
    { value: gameCount > 0 ? gameCount : 3, label: 'Titles' },
    { value: '+100%', label: "Growth '22–23", highlight: true },
    { value: '85%', label: 'Student-run', highlight: true },
  ];

  return (
    <main>
      <AboutHero
        title="This Is EZ Esports"
        subtitle="The NYC high school esports league, built by a student in one borough, now run by students across all five."
        backgroundImage="/images/hero-background.jpg"
        primaryCTA={{ label: 'Apply Now', href: ROUTES.apply }}
        secondaryCTA={{ label: 'Join Discord', href: discordLink, external: true }}
      />

      {/* Scoreboard strip */}
      <div className="relative z-10 -mt-px bg-surface-sunken border-y border-line">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 sm:grid-cols-5">
            {scoreboard.map((cell) => (
              <div
                key={cell.label}
                className={cx(
                  'relative border-line px-4 py-6 text-center border-b sm:border-b-0 sm:border-r sm:last:border-r-0',
                  cell.highlight && "before:content-[''] before:absolute before:inset-x-0 before:top-0 before:h-[3px] before:bg-accent"
                )}
              >
                <div className="font-black tabular-nums text-2xl sm:text-3xl text-foreground">{cell.value}</div>
                <div className="mt-1 text-[11px] font-bold uppercase tracking-wider text-foreground-muted">{cell.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* History */}
      <Section>
        <ScrollReveal>
          <Eyebrow className="mb-3 block">Match History</Eyebrow>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-foreground mb-10">How We Got Here</h2>
        </ScrollReveal>
        <div className="divide-y divide-line border-t border-line">
          {HISTORY.map((entry, i) => (
            <ScrollReveal key={entry.tag} delay={i * 0.1}>
              <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-2 sm:gap-8 py-8">
                <div className="font-black text-sm text-accent tracking-wide">{entry.tag}</div>
                <div>
                  <h3 className="text-xl font-extrabold text-foreground mb-2">{entry.title}</h3>
                  <p className="text-foreground-secondary leading-relaxed max-w-2xl">{entry.body}</p>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </Section>

      {/* Mission banner */}
      <ScrollReveal>
        <div
          className="relative py-20 sm:py-24 text-center overflow-hidden [clip-path:polygon(0_3%,100%_0,100%_97%,0_100%)]"
          style={{ background: 'linear-gradient(135deg, rgba(244,204,204,0.09), rgba(79,70,229,0.07))' }}
        >
          <div className="container mx-auto px-4 max-w-3xl">
            <p className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground leading-tight text-balance">
              &quot;Shaping the leaders of tomorrow through their passion for esports today.&quot;
            </p>
            <p className="mt-6 text-xs font-bold uppercase tracking-[0.15em] text-foreground-muted">
              EZ Esports Mission
            </p>
          </div>
        </div>
      </ScrollReveal>

      {/* By the numbers */}
      <Section tone="raised">
        <ScrollReveal>
          <Eyebrow className="mb-3 block">By the Numbers</Eyebrow>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-foreground mb-10">
            Empowering Youth Through Esports Infrastructure
          </h2>
        </ScrollReveal>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <Card interactive className="text-center">
            <div className="text-4xl font-black text-accent mb-2">47%</div>
            <p className="text-foreground-secondary font-medium">First-generation college students</p>
          </Card>
          <Card interactive className="text-center">
            <div className="text-4xl font-black text-accent mb-2">71%</div>
            <p className="text-foreground-secondary font-medium">Enrolled in Honors, IB, or AP courses</p>
          </Card>
          <Card interactive className="text-center">
            <div className="text-4xl font-black text-accent mb-2">85%</div>
            <p className="text-foreground-secondary font-medium">Student-run operations (no paid staff)</p>
          </Card>
        </div>
        <p className="text-center mt-8 text-foreground-secondary text-lg">
          Over <strong className="text-accent font-black">1/3</strong> of our student staff are accepted into top-25 universities.
        </p>
      </Section>

      {/* Divisions / roster */}
      <Section>
        <ScrollReveal>
          <Eyebrow className="mb-3 block">Team Roster</Eyebrow>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-foreground mb-4">
            Ten Student-Run Divisions
          </h2>
          <p className="text-foreground-secondary text-lg leading-relaxed max-w-2xl mb-10">
            The league mirrors a real company&apos;s org chart: ten divisions, led by alumni, run with zero operating budget.
          </p>
        </ScrollReveal>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-line border border-line rounded-2xl overflow-hidden">
          {DIVISIONS.map((division, i) => (
            <div key={division.name} className="bg-surface-raised p-6 min-h-[150px] flex flex-col justify-between">
              <span className="text-xs font-black text-foreground-muted tracking-wider">{String(i + 1).padStart(2, '0')}</span>
              <div>
                <h3 className="font-extrabold uppercase tracking-wide text-foreground mb-1.5">{division.name}</h3>
                <p className="text-sm text-foreground-secondary leading-relaxed">{division.description}</p>
              </div>
            </div>
          ))}
          <div className="bg-surface-raised p-6 min-h-[150px] flex items-center">
            <p className="text-sm text-foreground-secondary leading-relaxed">
              + 7 more student-led divisions across the league.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 mt-8">
          {GAME_SLUGS.map((slug) => {
            const game = GAMES[slug];
            return (
              <span
                key={slug}
                className="inline-flex items-center gap-2 rounded-full border border-line px-3.5 py-2 text-sm font-bold text-foreground"
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: game.accent.color }} aria-hidden="true" />
                {game.displayName}
              </span>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-2.5 mt-4">
          {SKILLS.map((skill) => (
            <span key={skill} className="rounded-full border border-line px-3.5 py-1.5 text-xs font-semibold text-foreground-secondary">
              {skill}
            </span>
          ))}
        </div>
      </Section>

      {/* Final CTA */}
      <Section className="border-t border-b border-accent/15">
        <div className="flex flex-col items-center gap-3 text-center">
          <Eyebrow>Get in the Game</Eyebrow>
          <GradientRule className="mb-1" />
          <h2 className="text-2xl sm:text-3xl font-black text-foreground">Ready to compete?</h2>
          <div className="flex gap-4 flex-wrap justify-center mt-2">
            <CutCTA href={ROUTES.apply} variant="primary">Apply Now</CutCTA>
            <CutCTA href={discordLink} variant="outline" external>Join Discord</CutCTA>
          </div>
        </div>
      </Section>
    </main>
  );
}

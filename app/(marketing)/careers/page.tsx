import type { Metadata } from 'next';
import Section from '@/app/components/ui/Section';
import Hero from '@/app/components/sections/Hero';
import CareerFilterTabs from '@/app/components/careers/CareerFilterTabs';
import GeneralApplicationCard from '@/app/components/careers/GeneralApplicationCard';
import { getPublishedCareerPostings } from '@/app/lib/db/queries';
import {
  HiOutlineAcademicCap,
  HiOutlineUserGroup,
  HiOutlineTrophy,
  HiOutlineSparkles,
} from 'react-icons/hi2';

export const metadata: Metadata = {
  title: 'Careers & Get Involved | EZ Esports',
  description:
    'Join the team building New York City’s premier high school esports league. Explore open staff, broadcast, engineering, and operations roles.',
};

export const revalidate = 60;

const PERKS = [
  {
    icon: HiOutlineTrophy,
    title: 'Real-World Experience',
    desc: 'Work on live broadcasts, production graphics, software platforms, and competitive tournaments seen by hundreds of students across NYC.',
  },
  {
    icon: HiOutlineUserGroup,
    title: 'Student-Driven Community',
    desc: 'Join a tight-knit crew of high school and collegiate esports enthusiasts, organizers, software developers, and shoutcasters.',
  },
  {
    icon: HiOutlineAcademicCap,
    title: 'Volunteer Credit & Recommendations',
    desc: 'Earn certified community service hours, letters of recommendation from league directors, and leadership endorsements.',
  },
  {
    icon: HiOutlineSparkles,
    title: 'Shape the Future of NYC Esports',
    desc: 'Help expand access to competitive esports for public and private high schools across all five boroughs.',
  },
];

export default async function CareersPage() {
  let postings: Awaited<ReturnType<typeof getPublishedCareerPostings>> = [];

  try {
    if (process.env.DATABASE_URL || process.env.NODE_ENV === 'test') {
      postings = await getPublishedCareerPostings();
    }
  } catch (error) {
    console.error('Failed to load career postings', error);
  }

  return (
    <>
      <Hero
        title="Careers & Opportunities"
        subtitle="Help build the premier high school esports ecosystem in New York City."
        backgroundImage="/images/hero-background.jpg"
        size="large"
      />

      {/* Culture & Perks Section */}
      <Section className="py-12 border-b border-line/60">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {PERKS.map((perk, idx) => {
            const Icon = perk.icon;
            return (
              <div
                key={idx}
                className="p-5 rounded-2xl bg-surface-raised/30 border border-line/60 flex flex-col justify-between"
              >
                <div>
                  <div className="w-10 h-10 rounded-xl bg-accent/15 text-accent flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-bold text-white mb-2">{perk.title}</h3>
                  <p className="text-xs text-foreground-secondary leading-relaxed">
                    {perk.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      {/* Open Positions Section */}
      <Section className="py-16">
        <div className="mb-10 text-center max-w-2xl mx-auto">
          <span className="text-xs font-bold text-accent uppercase tracking-widest">
            Join Our Team
          </span>
          <h2 className="text-3xl font-black text-white mt-1">Open Positions</h2>
          <p className="text-sm text-foreground-secondary mt-2">
            Browse our current openings. Filter by department or submit a general application.
          </p>
        </div>

        <CareerFilterTabs postings={postings} />

        <div className="mt-12">
          <GeneralApplicationCard />
        </div>
      </Section>
    </>
  );
}

import Section from '@/app/components/ui/Section';
import { Eyebrow } from '@/app/components/ui/SectionHeader';
import CutCTA from '@/app/components/ui/CutCTA';
import Card from '@/app/components/ui/Card';
import { ROUTES } from '@/app/lib/constants';
import { HiOutlineAcademicCap, HiOutlineUserGroup, HiOutlineShieldCheck, HiOutlineEye } from 'react-icons/hi2';

export default function StudentOrgSection() {
  const pillars = [
    {
      icon: <HiOutlineUserGroup className="h-6 w-6 text-accent" />,
      title: 'Student-Run Operations',
      description: 'Built and managed entirely by NYC high school club officers, alumni, and student volunteers.',
    },
    {
      icon: <HiOutlineEye className="h-6 w-6 text-accent" />,
      title: 'Open Read-Only Directory',
      description: 'Public, read-only access to all verified school rosters, match results, and league leadership records.',
    },
    {
      icon: <HiOutlineAcademicCap className="h-6 w-6 text-accent" />,
      title: 'Five-Borough Reach',
      description: 'Empowering students across public, private, and charter high schools in all five NYC boroughs.',
    },
    {
      icon: <HiOutlineShieldCheck className="h-6 w-6 text-accent" />,
      title: 'Youth Development',
      description: 'Fostering careers in shoutcasting, live production, graphic design, and league administration.',
    },
  ];

  return (
    <Section tone="raised" className="border-t border-b border-line overflow-hidden">
      <div className="relative z-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <Eyebrow className="mb-3 block">Student Organization</Eyebrow>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-foreground tracking-tight">
              A Five-Borough League, <span className="text-accent">Student-Run</span>
            </h2>
          </div>
          <p className="max-w-xl text-foreground-secondary text-base leading-relaxed">
            EZ Esports is a student-led non-profit organization. From tournament administration to live broadcasts, our league is run by high school students for high school students.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          {pillars.map((pillar) => (
            <Card key={pillar.title} className="p-6 flex flex-col justify-between duration-300 hover:border-accent/40">
              <div>
                <div className="mb-4 inline-flex items-center justify-center p-2.5 rounded-xl border border-accent/20 bg-accent/10">
                  {pillar.icon}
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2">{pillar.title}</h3>
                <p className="text-sm text-foreground-secondary leading-relaxed">{pillar.description}</p>
              </div>
            </Card>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <CutCTA href={ROUTES.leadership} variant="primary" className="group">
            Meet Student Leaders
            <span className="inline-block transition-transform duration-200 group-hover:translate-x-1 ml-1.5" aria-hidden="true">→</span>
          </CutCTA>
          <CutCTA href={ROUTES.about} variant="outline">
            Our Mission & Story
          </CutCTA>
        </div>
      </div>
    </Section>
  );
}

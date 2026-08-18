// app/(marketing)/leadership/[year]/page.tsx
import { getCachedLeadership } from '@/app/lib/db/queries';
import { notFound } from 'next/navigation';
import type { LeadershipParams } from '@/app/types';
import { getLeadershipRoute } from '@/app/lib/constants';
import Section from '@/app/components/ui/Section';
import { SectionHeader } from '@/app/components/ui/SectionHeader';
import Card from '@/app/components/ui/Card';
import Button from '@/app/components/ui/Button';
import Image from 'next/image';

interface GroupedLeader {
  personId: string;
  name: string;
  handle: string | null;
  avatarUrl: string | null;
  highSchool: string | null;
  university: string | null;
  schoolName: string | null;
  graduationYear: number | null;
  bio: string | null;
  minDisplayOrder: number;
  roles: {
    role: string;
    department: string | null;
    displayOrder: number;
  }[];
}

export default async function LeadershipPage({ params }: { params: Promise<LeadershipParams> }) {
  const { year } = await params;
  let allLeaders: Awaited<ReturnType<typeof getCachedLeadership>> = [];
  try {
    allLeaders = await getCachedLeadership();
  } catch (error) {
    console.error('Failed to load leadership data', error);
  }

  const years = Array.from(new Set(allLeaders.map((l) => l.year))).sort().reverse();
  const leadersForYear = allLeaders.filter((l) => l.year === year);

  // If year doesn't exist in data and we have leadership records, show 404
  if (years.length > 0 && !years.includes(year)) {
    notFound();
  }

  // Collapse multiple roles in the same year into a single person card
  const groupedMap = new Map<string, GroupedLeader>();

  for (const l of leadersForYear) {
    const key = l.personId || l.name.trim().toLowerCase();
    if (!groupedMap.has(key)) {
      groupedMap.set(key, {
        personId: l.personId,
        name: l.name,
        handle: l.handle,
        avatarUrl: l.avatarUrl,
        highSchool: l.highSchool,
        university: l.university,
        schoolName: l.schoolName,
        graduationYear: l.graduationYear,
        bio: l.bio,
        minDisplayOrder: l.displayOrder ?? 3,
        roles: [
          {
            role: l.role,
            department: l.department,
            displayOrder: l.displayOrder ?? 3,
          },
        ],
      });
    } else {
      const existing = groupedMap.get(key)!;
      if (!existing.avatarUrl && l.avatarUrl) existing.avatarUrl = l.avatarUrl;
      if (!existing.handle && l.handle) existing.handle = l.handle;
      if (!existing.university && l.university) existing.university = l.university;
      if (!existing.highSchool && l.highSchool) existing.highSchool = l.highSchool;
      if (!existing.schoolName && l.schoolName) existing.schoolName = l.schoolName;
      if (!existing.graduationYear && l.graduationYear) existing.graduationYear = l.graduationYear;
      if (!existing.bio && l.bio) existing.bio = l.bio;

      existing.minDisplayOrder = Math.min(existing.minDisplayOrder, l.displayOrder ?? 3);
      if (!existing.roles.some((r) => r.role.toLowerCase() === l.role.toLowerCase())) {
        existing.roles.push({
          role: l.role,
          department: l.department,
          displayOrder: l.displayOrder ?? 3,
        });
      }
    }
  }

  // Sort by seniority (displayOrder ASC), then role, then name
  const collapsedLeaders = Array.from(groupedMap.values()).sort((a, b) => {
    if (a.minDisplayOrder !== b.minDisplayOrder) {
      return a.minDisplayOrder - b.minDisplayOrder;
    }
    const roleA = a.roles[0]?.role || '';
    const roleB = b.roles[0]?.role || '';
    if (roleA !== roleB) {
      return roleA.localeCompare(roleB);
    }
    return a.name.localeCompare(b.name);
  });

  return (
    <main>
      <Section>
        <SectionHeader
          as="h1"
          eyebrow="Leadership"
          title={`${year} Leadership Team`}
          lead="Meet the leaders who guide our organization"
        />

        {/* Year Selector */}
        <div className="mb-12 flex flex-wrap justify-center gap-2">
          {years.map((y) => (
            <Button
              key={y}
              href={getLeadershipRoute(y)}
              variant={y === year ? 'primary' : 'outline'}
              size="sm"
            >
              {y}
            </Button>
          ))}
        </div>

        {/* Leadership Grid */}
        <div className="flex flex-wrap justify-center gap-8">
          {collapsedLeaders.length === 0 ? (
            <Card className="w-full text-center py-16">
              <p className="text-foreground-secondary text-sm">
                No leadership members registered for {year} yet.
              </p>
            </Card>
          ) : (
            collapsedLeaders.map((leader) => {
              const uni = leader.university?.trim() || null;
              const hs = leader.highSchool?.trim() || null;
              const sn = leader.schoolName?.trim() || null;
              const displaySchool = uni || hs || sn || '';

              const initials = leader.name
                .split(' ')
                .filter(Boolean)
                .map((n) => n[0])
                .slice(0, 2)
                .join('')
                .toUpperCase();

              return (
                <Card
                  key={leader.personId || leader.name}
                  interactive
                  className="w-full md:w-[calc(50%_-_1rem)] lg:w-[calc(33.333%_-_1.333rem)] group transition-all duration-300"
                >
                  {/* Circular Headshot or Initials Monogram */}
                  {leader.avatarUrl ? (
                    <div className="relative w-28 h-28 rounded-full mx-auto mb-6 overflow-hidden border-2 border-line/80 bg-surface shadow-xl group-hover:border-accent/50 group-hover:shadow-accent/10 transition-all duration-300">
                      <Image
                        src={leader.avatarUrl}
                        alt={leader.name}
                        fill
                        sizes="(max-width: 768px) 112px, 112px"
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-28 h-28 rounded-full mx-auto mb-6 bg-gradient-to-b from-surface-raised to-surface-sunken border-2 border-line/80 flex items-center justify-center text-foreground shadow-xl group-hover:border-accent/50 group-hover:shadow-accent/10 transition-all duration-300">
                      <span className="text-3xl font-extrabold tracking-tight text-white/90">
                        {initials}
                      </span>
                    </div>
                  )}

                  <div className="text-center">
                    <h2 className="text-xl font-bold mb-0.5 tracking-tight text-foreground">{leader.name}</h2>
                    {leader.handle && (
                      <p className="text-xs text-foreground-secondary font-medium mb-2">({leader.handle})</p>
                    )}

                    {/* Role Badges */}
                    <div className="flex flex-wrap justify-center gap-1.5 mb-3">
                      {leader.roles.map((r) => (
                        <span
                          key={r.role}
                          className="text-accent text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-accent/10 border border-accent/25"
                        >
                          {r.role}
                        </span>
                      ))}
                    </div>

                    {(displaySchool || leader.graduationYear) && (
                      <p className="text-foreground-secondary text-xs leading-relaxed border-t border-line/80 pt-3 mt-3">
                        {displaySchool}
                        {displaySchool && leader.graduationYear ? ' ' : ''}
                        {leader.graduationYear ? `'${leader.graduationYear.toString().slice(-2)}` : ''}
                      </p>
                    )}
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </Section>
    </main>
  );
}

// Generate static params dynamically
export async function generateStaticParams() {
  try {
    const allLeaders = await getCachedLeadership();
    const years = Array.from(new Set(allLeaders.map((l) => l.year)));
    return years.map((year) => ({
      year,
    }));
  } catch {
    return [];
  }
}

// Generate metadata dynamically
export async function generateMetadata({ params }: { params: Promise<{ year: string }> }) {
  const { year } = await params;
  return {
    title: `${year} Leadership Team`,
    description: `Meet the ${year} leadership team of our organization`,
  };
}

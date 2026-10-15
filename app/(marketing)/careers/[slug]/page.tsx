import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Section from '@/app/components/ui/Section';
import Card from '@/app/components/ui/Card';
import Badge from '@/app/components/ui/Badge';
import Markdown from '@/app/components/ui/Markdown';
import CareerApplyForm from '@/app/components/careers/CareerApplyForm';
import { getPublishedCareerPostingBySlug } from '@/app/lib/db/queries';
import {
  HiOutlineArrowLeft,
  HiOutlineClock,
  HiOutlineMapPin,
  HiOutlineBriefcase,
  HiOutlineBuildingOffice2,
} from 'react-icons/hi2';

interface CareerDetailPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: CareerDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const posting = (process.env.DATABASE_URL || process.env.NODE_ENV === 'test')
      ? await getPublishedCareerPostingBySlug(slug)
      : null;
    if (!posting) return { title: 'Position Not Found | EZ Esports Careers' };
    return {
      title: `${posting.title} | EZ Esports Careers`,
      description: posting.summary,
    };
  } catch {
    return { title: 'Careers | EZ Esports' };
  }
}

export const revalidate = 60;

export default async function CareerDetailPage({ params }: CareerDetailPageProps) {
  const { slug } = await params;

  let posting: Awaited<ReturnType<typeof getPublishedCareerPostingBySlug>> = null;
  try {
    if (process.env.DATABASE_URL || process.env.NODE_ENV === 'test') {
      posting = await getPublishedCareerPostingBySlug(slug);
    }
  } catch (error) {
    console.error('Failed to load career posting by slug', error);
  }

  if (!posting) {
    notFound();
  }

  return (
    <div className="py-12 md:py-16">
      <Section>
        {/* Navigation & Header */}
        <div className="mb-8">
          <Link
            href="/careers"
            className="inline-flex items-center gap-2 text-xs font-bold text-foreground-muted hover:text-accent transition-colors uppercase tracking-wider mb-6 group cursor-pointer"
          >
            <HiOutlineArrowLeft className="w-4 h-4 transition-transform duration-200 group-hover:-translate-x-1" />
            <span>Back to all positions</span>
          </Link>

          <div className="flex flex-wrap items-center gap-2 mb-4">
            <Badge variant="accent" size="sm">
              {posting.department}
            </Badge>
            <span className="text-xs font-semibold text-foreground-muted uppercase tracking-wider">
              {posting.employmentType}
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight mb-4">
            {posting.title}
          </h1>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs sm:text-sm text-foreground-secondary">
            <span className="inline-flex items-center gap-1.5">
              <HiOutlineBuildingOffice2 className="w-4 h-4 text-accent" />
              {posting.department}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <HiOutlineMapPin className="w-4 h-4 text-accent" />
              {posting.location}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <HiOutlineClock className="w-4 h-4 text-accent" />
              {posting.commitment}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <HiOutlineBriefcase className="w-4 h-4 text-accent" />
              {posting.employmentType}
            </span>
          </div>
        </div>

        {/* Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          {/* Main Description */}
          <div className="lg:col-span-7 space-y-8">
            <Card className="bg-surface-raised/30 border border-line p-6 sm:p-8">
              <h2 className="text-xl font-black text-white uppercase tracking-wider mb-4 pb-3 border-b border-line/60">
                Role Overview
              </h2>
              <p className="text-sm sm:text-base text-foreground-secondary leading-relaxed mb-6 font-medium">
                {posting.summary}
              </p>

              <div className="prose prose-invert max-w-none text-sm text-foreground-secondary">
                <Markdown content={posting.description} />
              </div>
            </Card>
          </div>

          {/* Application Sidebar / Form */}
          <div className="lg:col-span-5" id="apply">
            <CareerApplyForm
              careerPostingId={posting.id}
              roleTitle={posting.title}
              department={posting.department}
            />
          </div>
        </div>
      </Section>
    </div>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import Section from '@/app/components/ui/Section';
import CareerApplyForm from '@/app/components/careers/CareerApplyForm';
import { HiOutlineArrowLeft, HiOutlineSparkles } from 'react-icons/hi2';

export const metadata: Metadata = {
  title: 'General Staff Application | EZ Esports Careers',
  description:
    'Don’t see your exact role listed? Submit a general application and let us know how your skills can help grow high school esports in NYC.',
};

export default function GeneralApplyPage() {
  return (
    <div className="py-12 md:py-16">
      <Section>
        {/* Navigation & Header */}
        <div className="mb-8 max-w-3xl">
          <Link
            href="/careers"
            className="inline-flex items-center gap-2 text-xs font-bold text-foreground-muted hover:text-accent transition-colors uppercase tracking-wider mb-6 group cursor-pointer"
          >
            <HiOutlineArrowLeft className="w-4 h-4 transition-transform duration-200 group-hover:-translate-x-1" />
            <span>Back to all positions</span>
          </Link>

          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-bold text-accent uppercase tracking-wider">
              Open Staff Application
            </span>
            <HiOutlineSparkles className="w-4 h-4 text-accent" />
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight mb-4">
            General Staff Application
          </h1>

          <p className="text-sm sm:text-base text-foreground-secondary leading-relaxed">
            Even if we don&apos;t have an opening that strictly matches your current background, our league is constantly expanding. Whether you are interested in tournament administration, graphics, social media, shoutcasting, or software development, we would love to review your resume.
          </p>
        </div>

        {/* Application Form */}
        <div className="max-w-3xl">
          <CareerApplyForm
            roleTitle="General Staff Application"
            department="All Departments"
          />
        </div>
      </Section>
    </div>
  );
}

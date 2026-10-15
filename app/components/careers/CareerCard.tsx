import Link from 'next/link';
import Card from '@/app/components/ui/Card';
import Badge from '@/app/components/ui/Badge';
import { HiOutlineClock, HiOutlineMapPin, HiArrowRight } from 'react-icons/hi2';
import type { CareerPostingSummary } from '@/app/types/careers';

interface CareerCardProps {
  posting: CareerPostingSummary;
}

export default function CareerCard({ posting }: CareerCardProps) {
  return (
    <Card
      as="article"
      interactive
      className="bg-surface-raised/40 border border-line hover:border-accent/40 flex flex-col justify-between transition-all duration-300 group"
    >
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <Badge variant="accent" size="sm">
            {posting.department}
          </Badge>
          <span className="text-[11px] font-semibold text-foreground-muted uppercase tracking-wider">
            {posting.employmentType}
          </span>
        </div>

        <h3 className="text-xl font-black text-white group-hover:text-accent transition-colors mb-2">
          {posting.title}
        </h3>

        <p className="text-sm text-foreground-secondary line-clamp-3 mb-6 leading-relaxed">
          {posting.summary}
        </p>
      </div>

      <div className="pt-4 border-t border-line/60">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-foreground-muted mb-4">
          <span className="inline-flex items-center gap-1.5">
            <HiOutlineMapPin className="w-3.5 h-3.5 text-accent" />
            {posting.location}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <HiOutlineClock className="w-3.5 h-3.5 text-accent" />
            {posting.commitment}
          </span>
        </div>

        <Link
          href={`/careers/${posting.slug}`}
          className="w-full inline-flex items-center justify-between px-4 py-2.5 rounded-xl bg-surface-raised hover:bg-accent hover:text-black text-white font-bold text-xs uppercase tracking-wider transition-all duration-300 group/link border border-line hover:border-accent"
        >
          <span>View Role & Apply</span>
          <HiArrowRight className="w-4 h-4 transition-transform duration-300 group-hover/link:translate-x-1" />
        </Link>
      </div>
    </Card>
  );
}

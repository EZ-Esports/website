import Link from 'next/link';
import Card from '@/app/components/ui/Card';
import Badge from '@/app/components/ui/Badge';
import { HiOutlineSparkles, HiArrowRight } from 'react-icons/hi2';

export default function GeneralApplicationCard() {
  return (
    <Card className="bg-gradient-to-br from-surface-raised/60 via-surface/40 to-accent/5 border border-line hover:border-accent/40 transition-all p-6 sm:p-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 mb-3">
            <Badge variant="accent" size="sm">
              Open Application
            </Badge>
            <span className="text-xs font-semibold text-foreground-muted uppercase tracking-wider">
              All Departments
            </span>
          </div>
          <h3 className="text-2xl font-black text-white mb-2 flex items-center gap-2">
            <span>Don&apos;t see your specific role?</span>
            <HiOutlineSparkles className="w-6 h-6 text-accent" />
          </h3>
          <p className="text-sm text-foreground-secondary leading-relaxed">
            We are always looking for passionate builders, organizers, designers, shoutcasters, and game directors to join the EZ Esports team. Submit an open application and tell us how you want to contribute!
          </p>
        </div>

        <div className="shrink-0">
          <Link
            href="/careers/apply/general"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-accent text-black font-extrabold text-sm uppercase tracking-wider hover:bg-accent/90 transition-all duration-300 shadow-lg shadow-accent/10"
          >
            <span>Submit Open Application</span>
            <HiArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </Card>
  );
}

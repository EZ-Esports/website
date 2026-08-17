import Card from '@/app/components/ui/Card';
import Section from '@/app/components/ui/Section';
import { SectionHeader } from '@/app/components/ui/SectionHeader';
import Badge from '@/app/components/ui/Badge';
import Link from 'next/link';

export const metadata = {
  title: 'League Rules & Handbook | EZ Esports',
  description: 'Official competition rules, sportsmanship guidelines, and participation terms for the NYC High School Esports League.',
};

export default function RulesPage() {
  return (
    <Section className="py-12 md:py-20">
      <div className="max-w-4xl mx-auto space-y-10">
        <div className="space-y-4">
          <Badge variant="neutral" size="md">
            Last Updated: August 2026 | Version 1.0
          </Badge>
          <SectionHeader
            eyebrow="Official Documentation"
            title="NYC High School Esports League Rules & Participation Terms"
            lead="Guidelines, sportsmanship standards, and competition rules governing the NYC High School Esports League."
          />
        </div>

        <div className="space-y-8">
          <Card className="bg-surface-raised/40 border border-line p-6 md:p-8 space-y-4">
            <h2 className="text-xl font-bold text-white uppercase tracking-wider">1. Eligibility & Roster Requirements</h2>
            <ul className="list-disc list-inside space-y-2 text-foreground-secondary text-sm leading-relaxed">
              <li>Applicants must represent a verified NYC high school esports club or program.</li>
              <li>Team captains and officers must maintain active student status at their respective high schools.</li>
              <li>Roster substitutions must be declared at least 24 hours prior to scheduled match times.</li>
              <li>All player accounts (IGNs / Discord IDs) must match the registered roster submitted to league management.</li>
            </ul>
          </Card>

          <Card className="bg-surface-raised/40 border border-line p-6 md:p-8 space-y-4">
            <h2 className="text-xl font-bold text-white uppercase tracking-wider">2. Code of Conduct & Sportsmanship</h2>
            <ul className="list-disc list-inside space-y-2 text-foreground-secondary text-sm leading-relaxed">
              <li>Toxic behavior, harassment, hate speech, or unsportsmanlike conduct in match chats or Discord will result in immediate disqualification.</li>
              <li>All players must uphold fair play—cheating, exploiting, or third-party assistance is strictly prohibited.</li>
              <li>Teams are expected to be present and ready in game lobbies 15 minutes before scheduled start time.</li>
            </ul>
          </Card>

          <Card className="bg-surface-raised/40 border border-line p-6 md:p-8 space-y-4">
            <h2 className="text-xl font-bold text-white uppercase tracking-wider">3. Match Scheduling & Reporting</h2>
            <ul className="list-disc list-inside space-y-2 text-foreground-secondary text-sm leading-relaxed">
              <li>Official match scores must be submitted by team captains immediately following match conclusion.</li>
              <li>Reschedule requests must be submitted through official league channels at least 48 hours prior to the match.</li>
              <li>Forfeits are recorded as loss penalties for the absent team after a 15-minute grace period.</li>
            </ul>
          </Card>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-6 bg-surface-raised/20 border border-line rounded-xl">
            <div>
              <h3 className="font-bold text-white text-base">Have questions about rules or scheduling?</h3>
              <p className="text-foreground-secondary text-sm">Reach out to our league staff for assistance or clarifications.</p>
            </div>
            <Link
              href="/apply"
              className="px-5 py-2.5 bg-accent text-on-accent font-bold text-xs uppercase tracking-wider rounded-lg hover:bg-accent/80 transition-all whitespace-nowrap"
            >
              Back to Application
            </Link>
          </div>
        </div>
      </div>
    </Section>
  );
}

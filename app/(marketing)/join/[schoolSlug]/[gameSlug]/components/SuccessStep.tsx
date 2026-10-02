'use client';

import Link from 'next/link';
import { FiCheck, FiShield, FiClock } from 'react-icons/fi';
import type { InviteData } from '../types';

interface SuccessStepProps {
  isManager?: boolean;
  legalFirstName: string;
  legalLastName: string;
  email: string;
  discordUsername: string;
  inviteData: InviteData;
}

export function SuccessStep({
  isManager,
  legalFirstName,
  legalLastName,
  email,
  discordUsername,
  inviteData,
}: SuccessStepProps) {
  if (isManager) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 sm:px-6">
        <div className="bg-surface-elevated border border-border rounded-2xl p-8 sm:p-10 shadow-xl text-center space-y-6">
          <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mx-auto ring-8 ring-emerald-500/5">
            <FiCheck className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              You have successfully signed up!
            </h1>
            <p className="text-foreground-muted text-sm sm:text-base">
              Welcome aboard,{' '}
              <span className="text-foreground font-semibold">
                {legalFirstName} {legalLastName}
              </span>
              ! Your School Manager account for{' '}
              <span className="text-accent font-semibold">
                {inviteData.schoolName}
              </span>{' '}
              has been created. Please sign in to access your school portal.
            </p>
          </div>

          <div className="bg-surface rounded-xl border border-border p-6 text-left space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-accent flex items-center gap-2">
              <FiShield className="w-4 h-4" /> Manager Portal Privileges Active
            </h2>
            <ul className="space-y-3 text-sm text-foreground-muted">
              <li className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">
                  ✓
                </span>
                <span>
                  <strong className="text-foreground">Official Community Access:</strong>{' '}
                  Your Discord account ({discordUsername}) is registered for league announcements, referee comms, and manager channels.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">
                  ✓
                </span>
                <span>
                  <strong className="text-foreground">Player Invites & Roster Review:</strong>{' '}
                  Generate player invite links for students at {inviteData.schoolName} and approve student submissions for tournament rosters.
                </span>
              </li>
            </ul>
          </div>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href={`/portal/login?email=${encodeURIComponent(email)}`}
              className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-2.5 rounded-lg bg-accent text-on-accent font-semibold text-sm hover:bg-accent/90 transition-colors shadow-sm"
            >
              Sign In to School Manager Portal &rarr;
            </Link>
            <Link
              href="/"
              className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-2.5 rounded-lg border border-border text-foreground font-semibold text-sm hover:bg-surface transition-colors"
            >
              Return to Homepage
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-12 px-4 sm:px-6">
      <div className="bg-surface-elevated border border-border rounded-2xl p-8 sm:p-10 shadow-xl text-center space-y-6">
        <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mx-auto ring-8 ring-emerald-500/5">
          <FiCheck className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Application Submitted!
          </h1>
          <p className="text-foreground-muted text-sm sm:text-base">
            Welcome aboard,{' '}
            <span className="text-foreground font-semibold">
              {legalFirstName} {legalLastName}
            </span>
            ! Your player onboarding application for{' '}
            <span className="text-accent font-semibold">
              {inviteData.schoolName} ({inviteData.gameName})
            </span>{' '}
            has been received.
          </p>
        </div>

        <div className="bg-surface rounded-xl border border-border p-6 text-left space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-accent flex items-center gap-2">
            <FiClock className="w-4 h-4" /> Next Steps Checklist
          </h2>
          <ul className="space-y-3 text-sm text-foreground-muted">
            <li className="flex items-start gap-3">
              <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">
                ✓
              </span>
              <span>
                <strong className="text-foreground">Stay in the Discord Server:</strong>{' '}
                Keep your Discord account ({discordUsername}) joined in the official EZ Esports server for referee announcements, match check-ins, and voice comms.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="w-5 h-5 rounded-full bg-accent/20 text-accent flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">
                2
              </span>
              <span>
                <strong className="text-foreground">Manager Roster Review:</strong>{' '}
                Your school coach or manager will review your submission and assign you to the active competition roster.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="w-5 h-5 rounded-full bg-accent/20 text-accent flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">
                3
              </span>
              <span>
                <strong className="text-foreground">Match Day Ready:</strong> Check your email ({email}) for tournament schedule releases and season kickoff details.
              </span>
            </li>
          </ul>
        </div>

        <div className="pt-4">
          <Link
            href="/"
            className="inline-flex items-center justify-center px-6 py-2.5 rounded-lg bg-accent text-on-accent font-semibold text-sm hover:bg-accent/90 transition-colors"
          >
            Return to Homepage
          </Link>
        </div>
      </div>
    </div>
  );
}

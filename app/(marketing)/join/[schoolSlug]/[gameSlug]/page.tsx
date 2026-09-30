import type { Metadata } from 'next';
import Link from 'next/link';
import {
  FiAlertTriangle,
  FiClock,
  FiCheckCircle,
  FiXCircle,
  FiArrowLeft,
} from 'react-icons/fi';
import { validateInviteToken } from '@/app/lib/onboarding/wizard-actions';
import PlayerOnboardingWizard from './PlayerOnboardingWizard';

interface JoinPageProps {
  params: Promise<{
    schoolSlug: string;
    gameSlug: string;
  }>;
  searchParams: Promise<{
    token?: string;
  }>;
}

export const metadata: Metadata = {
  title: 'Player Onboarding | EZ Esports',
  description: 'Complete your high school esports player verification and roster onboarding.',
};

export default async function PlayerOnboardingPage(props: JoinPageProps) {
  const params = await props.params;
  const searchParams = await props.searchParams;

  const { schoolSlug, gameSlug } = params;
  const token = searchParams.token || '';

  if (!token) {
    return (
      <div className="max-w-xl mx-auto py-16 px-4 text-center">
        <div className="bg-surface-elevated border border-border rounded-2xl p-8 space-y-5 shadow-lg">
          <div className="w-14 h-14 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto ring-8 ring-rose-500/5">
            <FiAlertTriangle className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-bold text-foreground">
              Invite Token Missing
            </h1>
            <p className="text-sm text-foreground-muted leading-relaxed">
              No single-use invite token was provided in the URL. Please verify that you opened the complete link shared by your school coach or esports manager.
            </p>
          </div>
          <div className="pt-2">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm font-semibold text-accent hover:underline"
            >
              <FiArrowLeft className="w-4 h-4" /> Return to Homepage
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const validation = await validateInviteToken({
    schoolSlug,
    gameSlug,
    token,
  });

  if (!validation.valid) {
    return (
      <div className="max-w-xl mx-auto py-16 px-4 text-center">
        <div className="bg-surface-elevated border border-border rounded-2xl p-8 space-y-5 shadow-lg">
          {validation.status === 'expired' && (
            <>
              <div className="w-14 h-14 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto ring-8 ring-amber-500/5">
                <FiClock className="w-7 h-7" />
              </div>
              <div className="space-y-2">
                <h1 className="text-xl font-bold text-foreground">
                  Invite Link Expired
                </h1>
                <p className="text-sm text-foreground-muted leading-relaxed">
                  This single-use onboarding link has expired. Please contact your school coach or team manager to request a new invite link.
                </p>
              </div>
            </>
          )}

          {validation.status === 'accepted' && (
            <>
              <div className="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto ring-8 ring-emerald-500/5">
                <FiCheckCircle className="w-7 h-7" />
              </div>
              <div className="space-y-2">
                <h1 className="text-xl font-bold text-foreground">
                  Invite Already Accepted
                </h1>
                <p className="text-sm text-foreground-muted leading-relaxed">
                  This invite link has already been used and approved by your team manager. You are already registered on the active roster.
                </p>
              </div>
            </>
          )}

          {validation.status === 'rejected' && (
            <>
              <div className="w-14 h-14 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto ring-8 ring-rose-500/5">
                <FiXCircle className="w-7 h-7" />
              </div>
              <div className="space-y-2">
                <h1 className="text-xl font-bold text-foreground">
                  Invite Rejected
                </h1>
                <p className="text-sm text-foreground-muted leading-relaxed">
                  This onboarding application was rejected by the school manager.
                  {validation.rejectionReason && (
                    <span className="block mt-2 font-mono text-xs p-2 bg-surface rounded border border-border text-foreground">
                      Reason: {validation.rejectionReason}
                    </span>
                  )}
                </p>
              </div>
            </>
          )}

          {validation.status === 'submitted' && (
            <>
              <div className="w-14 h-14 rounded-full bg-sky-500/10 text-sky-400 flex items-center justify-center mx-auto ring-8 ring-sky-500/5">
                <FiClock className="w-7 h-7" />
              </div>
              <div className="space-y-2">
                <h1 className="text-xl font-bold text-foreground">
                  Application Awaiting Review
                </h1>
                <p className="text-sm text-foreground-muted leading-relaxed">
                  Your onboarding submission has already been received and is currently in the queue for manager approval. You will receive an update once your roster spot is confirmed.
                </p>
              </div>
            </>
          )}

          {validation.status === 'invalid' && (
            <>
              <div className="w-14 h-14 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto ring-8 ring-rose-500/5">
                <FiAlertTriangle className="w-7 h-7" />
              </div>
              <div className="space-y-2">
                <h1 className="text-xl font-bold text-foreground">
                  Invalid Invite Link
                </h1>
                <p className="text-sm text-foreground-muted leading-relaxed">
                  {validation.message ||
                    'This invite link is invalid, corrupted, or has expired. Please check the URL or contact your school esports manager.'}
                </p>
              </div>
            </>
          )}

          <div className="pt-2">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm font-semibold text-accent hover:underline"
            >
              <FiArrowLeft className="w-4 h-4" /> Return to Homepage
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-[80vh] py-6">
      <PlayerOnboardingWizard token={token} inviteData={validation} />
    </main>
  );
}

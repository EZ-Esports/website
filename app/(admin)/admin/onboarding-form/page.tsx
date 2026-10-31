import { headers } from 'next/headers';
import { getStaffForAdminSection } from '@/app/lib/auth';
import PermissionDenied from '@/app/components/admin/PermissionDenied';
import DbErrorNotice from '@/app/components/admin/DbErrorNotice';
import { AdminNotice, AdminPage, AdminPageHeader, AdminSection } from '@/app/components/admin/AdminUI';
import { chip, chipDot } from '@/app/components/admin/styles';
import { CANONICAL_APP_URL } from '@/app/lib/constants';
import { countFormCompletions, readOnboardingFormSettingRows } from '@/app/lib/db/onboarding-form';
import { resolveOnboardingFormConfig } from '@/app/lib/onboarding/google-form/config';
import { buildAppsScript } from '@/app/lib/onboarding/google-form/apps-script';
import { deriveWebhookKey, isWebhookSecretConfigured } from '@/app/lib/onboarding/google-form/token';
import { CopyBlock, OnboardingFormSettingsForm } from './OnboardingFormSettings';

export const metadata = {
  title: 'Onboarding Form | Admin',
};

/** Where Google's script should post: this deployment's own origin, so a preview shows its own URL. */
async function webhookEndpoint(): Promise<string> {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  const proto = h.get('x-forwarded-proto') ?? (host?.startsWith('localhost') ? 'http' : 'https');
  const origin = host ? `${proto}://${host}` : process.env.NEXT_PUBLIC_APP_URL || CANONICAL_APP_URL;
  return `${origin}/api/google-form/complete`;
}

export default async function OnboardingFormPage() {
  if (!(await getStaffForAdminSection('/admin/onboarding-form'))) return <PermissionDenied />;

  let settings = { url: '', entryId: '' };
  let completions: number | null = null;
  let dbConfigured = false;
  try {
    if (process.env.DATABASE_URL) {
      settings = await readOnboardingFormSettingRows();
      dbConfigured = true;
      // The table arrives with migration 0057; until then the count is simply unavailable.
      completions = await countFormCompletions().catch(() => null);
    }
  } catch {
    // db not reachable
  }

  const config = resolveOnboardingFormConfig({ url: settings.url, entryId: settings.entryId });
  const secretConfigured = isWebhookSecretConfigured();
  const hasSettings = Boolean(settings.url || settings.entryId);
  const invalidSettings = hasSettings && !(config.formUrl && config.entryId);
  const endpoint = await webhookEndpoint();
  const webhookKey = secretConfigured ? deriveWebhookKey() : null;

  const status = config.enabled
    ? { tone: 'success' as const, label: 'Active: new students and managers must complete the form' }
    : hasSettings && !secretConfigured
      ? { tone: 'warning' as const, label: 'Off: server secret missing' }
      : invalidSettings
        ? { tone: 'warning' as const, label: 'Off: saved settings are incomplete' }
        : { tone: 'neutral' as const, label: 'Off: onboarding skips the form' };

  return (
    <AdminPage>
      <AdminPageHeader
        route="/admin/onboarding-form"
        description="The Google Form every student and school manager completes while onboarding. Completion is confirmed by the form itself, not by what the person says."
        meta={
          dbConfigured && (
            <>
              <span className={chip(status.tone)}>
                <span className={chipDot} />
                {status.label}
              </span>
              {completions !== null && (
                <span className={chip('accent')}>
                  {completions} completion{completions === 1 ? '' : 's'}
                </span>
              )}
            </>
          )
        }
      />

      {!dbConfigured && <DbErrorNotice variant="not-configured" />}

      {!secretConfigured && (
        <AdminNotice tone="warning" title="GOOGLE_FORM_WEBHOOK_SECRET is not set on the server">
          Until a developer sets it (at least 16 random characters), the form cannot be verified, so onboarding skips
          this step even if a link is saved below.
        </AdminNotice>
      )}

      {dbConfigured && (
        <AdminSection title="Form settings" description="Changes apply to the next onboarding page load.">
          <OnboardingFormSettingsForm initialUrl={settings.url} initialEntryId={settings.entryId} />
        </AdminSection>
      )}

      <AdminSection
        title="Set up the form"
        description="Do this once per form. The Google account that adds the trigger must keep owning it."
      >
        <ol className="list-decimal space-y-3 pl-5 text-sm leading-6 text-foreground-secondary marker:text-accent">
          <li>
            Add a <strong className="text-foreground">required short-answer</strong> question titled exactly{' '}
            <code className="rounded bg-surface-sunken px-1.5 py-0.5 text-foreground">Verification code</code>.
          </li>
          <li>
            Give that question this description so people do not change it:{' '}
            <em className="text-foreground">&ldquo;Leave this code as is. It is filled in for you and tells EZ Esports this response is yours.&rdquo;</em>
          </li>
          <li>
            In the form menu choose <strong className="text-foreground">Get pre-filled link</strong>, type any value in
            that question, choose <strong className="text-foreground">Get link</strong>, and copy the link. The number after{' '}
            <code className="rounded bg-surface-sunken px-1.5 py-0.5 text-foreground">entry.</code> is the entry id. Use the
            full docs.google.com link, never a forms.gle short link.
          </li>
          <li>
            Open <strong className="text-foreground">Extensions &gt; Apps Script</strong>, replace the code with the script
            below, and save.
          </li>
          <li>
            In the script&apos;s <strong className="text-foreground">Project Settings &gt; Script properties</strong>, add{' '}
            <code className="rounded bg-surface-sunken px-1.5 py-0.5 text-foreground">WEBHOOK_KEY</code> with the key
            below. Send the key through a private channel; it is the only secret the script holds.
          </li>
          <li>
            Open <strong className="text-foreground">Triggers</strong>, add a trigger for{' '}
            <code className="rounded bg-surface-sunken px-1.5 py-0.5 text-foreground">onFormSubmit</code>, event source{' '}
            <em>From form</em>, event type <em>On form submit</em>, and authorize it. The trigger runs as whoever adds it,
            so the form owner (or a long-lived shared staff account) should do this.
          </li>
          <li>
            Paste the link and entry id above, save, submit a test response from the prefilled link of a pending invite, and
            watch the completion count go up.
          </li>
        </ol>
        <p className="mt-4 text-xs leading-5 text-foreground-secondary">
          A new form, a copy of the form, or a change of owner means redoing the script, key and trigger and updating the
          link and entry id here. Deleting and re-adding the verification question changes its entry id.
        </p>
      </AdminSection>

      <AdminSection title="Script and key" description="The script already points at this site.">
        <div className="space-y-6">
          <CopyBlock label="Apps Script" value={buildAppsScript(endpoint)} multiline />
          {webhookKey ? (
            <CopyBlock label="WEBHOOK_KEY script property" value={webhookKey} secret />
          ) : (
            <p className="text-sm text-foreground-secondary">
              The key appears here once <code className="text-foreground">GOOGLE_FORM_WEBHOOK_SECRET</code> is set on the server.
            </p>
          )}
          <p className="text-xs leading-5 text-foreground-secondary">
            The key is derived from the server secret and can only report that a form was submitted. It cannot create a
            verification code, and changing the server secret invalidates it and every code already handed out.
          </p>
        </div>
      </AdminSection>
    </AdminPage>
  );
}

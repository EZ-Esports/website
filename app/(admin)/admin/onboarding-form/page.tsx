import type { ReactNode } from 'react';
import { getStaffForAdminSection } from '@/app/lib/auth';
import PermissionDenied from '@/app/components/admin/PermissionDenied';
import DbErrorNotice from '@/app/components/admin/DbErrorNotice';
import { AdminNotice, AdminPage, AdminPageHeader, AdminSection } from '@/app/components/admin/AdminUI';
import { chip, chipDot } from '@/app/components/admin/styles';
import { countFormCompletions, readOnboardingFormSettingRows } from '@/app/lib/db/onboarding-form';
import { resolveOnboardingFormConfig } from '@/app/lib/onboarding/google-form/config';
import { buildAppsScript, googleFormWebhookEndpoint } from '@/app/lib/onboarding/google-form/apps-script';
import { deriveWebhookKey, isWebhookSecretConfigured } from '@/app/lib/onboarding/google-form/token';
import { CopyBlock, OnboardingFormSettingsForm, ScriptGenerator } from './OnboardingFormSettings';

export const metadata = {
  title: 'Onboarding Form | Admin',
};

const code = 'rounded bg-surface-sunken px-1.5 py-0.5 text-foreground';
const strong = 'text-foreground';

/** One numbered step: a badge, the instruction, and optionally a control that belongs to it. */
function Step({ n, title, children }: { n: number; title: ReactNode; children?: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden
        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/20 text-xs font-bold text-accent"
      >
        {n}
      </span>
      <div className="min-w-0 flex-1 space-y-3 text-sm leading-6 text-foreground-secondary">
        <p className="font-medium text-foreground">
          {/* The visible badge is decorative; this keeps the number in the reading order for screen readers. */}
          <span className="sr-only">Step {n}: </span>
          {title}
        </p>
        {children}
      </div>
    </li>
  );
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
  const endpoint = googleFormWebhookEndpoint();
  const script = buildAppsScript(endpoint);
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

      <AdminSection
        title="Set up the form"
        description="Follow the steps in order. Nothing changes for students until you save in step 8. It takes about ten minutes the first time and needs a Google account that stays with EZ Esports."
      >
        <ol role="list" className="space-y-6">
          <Step n={1} title="Create the Google Form and add the verification question">
            <p>
              In Google Forms, create or open your form and add a <strong className={strong}>Short answer</strong>{' '}
              question. Title it exactly <code className={code}>Verification code</code> and switch on{' '}
              <strong className={strong}>Required</strong>.
            </p>
            <p>
              Under the question&apos;s three-dot menu choose <strong className={strong}>Description</strong> and type:{' '}
              <em className="text-foreground">
                &ldquo;Leave this code as is. It is filled in for you and tells EZ Esports this response is yours.&rdquo;
              </em>
            </p>
          </Step>

          <Step n={2} title="Check the form's response settings">
            <p>
              Open the form&apos;s <strong className={strong}>Settings</strong> tab, then{' '}
              <strong className={strong}>Responses</strong>. The form must be{' '}
              <strong className={strong}>accepting responses</strong> (the toggle on the Responses tab in the editor), or
              students cannot submit.
            </p>
            <p>
              Recommended, so each person can only submit once: turn on{' '}
              <strong className={strong}>Limit to 1 response</strong> (this makes respondents sign in with Google) and set{' '}
              <strong className={strong}>Collect email addresses</strong> to <em>Verified</em> if you want the response sheet
              to show who answered.
            </p>
            <AdminNotice tone="warning" live="none">
              Not yet tried against a real form: whether a pre-filled link still works when sign-in is required. Check it in
              the test step. Also, a completion belongs to an invite, so someone who gets a second invite (another game or
              season) cannot submit the same form again under &ldquo;Limit to 1 response&rdquo;. Use a new form for the new
              round or allow response editing; there is no manual override yet.
            </AdminNotice>
          </Step>

          <Step n={3} title="Copy the pre-filled link and the entry id (do not save yet)">
            <p>
              Click the three-dot menu at the top right of the form and choose{' '}
              <strong className={strong}>Get pre-filled link</strong>. Type anything in the Verification code box, choose{' '}
              <strong className={strong}>Get link</strong>, then <strong className={strong}>Copy link</strong>. Keep the link
              in a note for step 8.
            </p>
            <p>
              The link ends in something like <code className={code}>entry.1234567890=abc</code>. The number after{' '}
              <code className={code}>entry.</code> is the <strong className={strong}>entry id</strong>. Always use the long{' '}
              <code className={code}>docs.google.com</code> link, never a short <code className={code}>forms.gle</code> one.
            </p>
          </Step>

          <Step n={4} title={<>Click <em>Generate script</em> and copy it</>}>
            <p>
              The script already points at <code className={`${code} break-all`}>{endpoint}</code>. It is the same for every
              form, and it holds no password.
            </p>
            <ScriptGenerator script={script} />
          </Step>

          <Step n={5} title="Paste the script into the form">
            <p>
              In the form, click the three-dot menu at the top right and choose{' '}
              <strong className={strong}>Apps Script</strong>. A new tab opens. Delete the code that is there, paste the
              script, and click the save icon.
            </p>
          </Step>

          <Step n={6} title={<>Add the key as the script property <code className={code}>WEBHOOK_KEY</code></>}>
            <p>
              In the Apps Script tab open <strong className={strong}>Project Settings</strong> (the gear icon), scroll to{' '}
              <strong className={strong}>Script Properties</strong>, click <strong className={strong}>Add script property</strong>,
              enter <code className={code}>WEBHOOK_KEY</code> as the name and the key below as the value, and save. Send the key
              to other people only through a private channel.
            </p>
            {webhookKey ? (
              <CopyBlock label="WEBHOOK_KEY value" value={webhookKey} secret />
            ) : (
              <p>
                The key appears here once <code className={code}>GOOGLE_FORM_WEBHOOK_SECRET</code> is set on the server.
              </p>
            )}
          </Step>

          <Step n={7} title="Add the trigger and authorize it">
            <p>
              Click <strong className={strong}>Triggers</strong> (the alarm-clock icon), then{' '}
              <strong className={strong}>Add Trigger</strong>. Choose the function{' '}
              <code className={code}>onFormSubmit</code>, event source <strong className={strong}>From form</strong>, event
              type <strong className={strong}>On form submit</strong>, and save.
            </p>
            <p>
              Google then asks you to sign in. If it says <em>Google hasn&apos;t verified this app</em>, that is expected for
              your own script: choose <strong className={strong}>Advanced</strong>, then{' '}
              <strong className={strong}>Go to (project name) (unsafe)</strong>, then{' '}
              <strong className={strong}>Allow</strong>. The trigger runs as whoever adds it, so the form owner (or a
              long-lived shared staff account) should do this.
            </p>
          </Step>

          <Step n={8} title="Paste the link and the entry id here, then save. This switches the requirement on">
            <p>
              Saving is what makes students and managers see this form and be unable to finish onboarding without
              submitting it, so it comes last, once the script and trigger above are in place.
            </p>
            {dbConfigured ? (
              <div className="rounded-xl bg-surface-sunken/60 p-4">
                <OnboardingFormSettingsForm initialUrl={settings.url} initialEntryId={settings.entryId} />
              </div>
            ) : (
              <p>Connect the database to save the form settings.</p>
            )}
          </Step>

          <Step n={9} title="Test it straight after saving">
            <p>
              A test needs the form saved (step 8). Create a test invite, open its onboarding link, go to the last step and
              press <strong className={strong}>Open the form</strong>, then submit the form. Within a few seconds the
              onboarding page shows the form as received. Reload this page: the completion count above should go up by one.
            </p>
            <p>
              If it does not, open Apps Script &gt; <strong className={strong}>Executions</strong> and look for an error, and
              confirm the trigger exists and was authorized, the <code className={code}>WEBHOOK_KEY</code> value matches
              step 6, the question is titled exactly <code className={code}>Verification code</code>, and the form is
              accepting responses.
            </p>
          </Step>
        </ol>
      </AdminSection>

      <AdminSection title="Replacing the form later" description="Use a different Google Form whenever you like.">
        <div className="space-y-3 text-sm leading-6 text-foreground-secondary">
          <p>
            Do the Google-side work first and save last: steps 1 to 7 for the new form, using the{' '}
            <strong className={strong}>same script and the same key</strong>, and only then step 8. Until you save, students
            keep using the old form. Saving is what switches onboarding to the new form, on the next page load, with no
            deploy.
          </p>
          <ul className="list-disc space-y-1.5 pl-5 marker:text-accent">
            <li>
              <strong className={strong}>Each Google Form has its own Apps Script.</strong> The script text and key do not
              change, but they must be pasted into, and authorized on, every new form. A new form without them never reports
              back, and students would wait on the last step forever.
            </li>
            <li>
              People who already finished stay finished: a completion belongs to the invite, not to a form. Everyone who has
              not finished gets the new form the next time they press <em>Open the form</em>.
            </li>
            <li>
              A student who already opened the old form can still submit it. That only counts while the old form&apos;s
              trigger exists. To stop counting old-form submissions, delete the trigger on the old form (Apps Script &gt;
              Triggers &gt; the three dots &gt; Delete trigger).
            </li>
            <li>
              Deleting and re-adding the Verification code question changes its entry id, so update the entry id here too.
            </li>
            <li>
              Changing the server secret invalidates the key and every code already handed out: paste the new key into each
              form&apos;s script properties.
            </li>
          </ul>
        </div>
      </AdminSection>
    </AdminPage>
  );
}

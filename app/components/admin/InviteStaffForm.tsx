'use client';

import { useState, useTransition } from 'react';
import { inviteStaff } from '@/app/(admin)/admin/team/actions';
import { HiCheck, HiOutlineClipboard } from 'react-icons/hi2';
import { parseHexColor } from '@/app/lib/roles';
import { cx } from '@/app/lib/cx';
import { input, inputSm, label as labelClass, primaryBtn, secondaryBtn } from '@/app/components/admin/styles';
import { AdminField, AdminNotice, PendingLabel } from '@/app/components/admin/AdminUI';

interface InviteStaffFormProps {
  assignableRoles: {
    id: string;
    name: string;
    color: string;
  }[];
}

export default function InviteStaffForm({ assignableRoles }: InviteStaffFormProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [invitedEmail, setInvitedEmail] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function handleSubmit(formData: FormData) {
    setError(null);
    setLink(null);
    setCopied(false);
    startTransition(async () => {
      const result = await inviteStaff(formData);
      if (!result.success || !result.token) {
        setError(result.error ?? 'Could not create invite. Please try again.');
        return;
      }
      setInvitedEmail(result.email ?? null);
      setLink(`${window.location.origin}/accept-invite?token=${result.token}`);
    });
  }

  async function copyLink() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable — user can select manually
    }
  }

  return (
    <div className="space-y-4">
      <form action={handleSubmit} className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <AdminField label="Email" htmlFor="invite-email" className="flex-1">
            <input
              id="invite-email"
              name="email"
              type="email"
              required
              placeholder="new.staff@ezesports.org"
              className={input}
            />
          </AdminField>

          <button type="submit" disabled={isPending} aria-busy={isPending} className={primaryBtn}>
            <PendingLabel pending={isPending} label="Generate invite link" pendingLabel="Generating…" />
          </button>
        </div>

        {/* Roles Selection */}
        <fieldset className="space-y-2">
          <legend className={labelClass}>Initial roles (optional)</legend>
          {assignableRoles.length === 0 ? (
            <p className="text-sm text-foreground-secondary">No initial roles will be assigned. The member can still accept the invite.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {assignableRoles.map((role) => {
                const parsedColor = parseHexColor(role.color);
                return (
                  <label
                    key={role.id}
                    className="flex cursor-pointer select-none items-center gap-2 rounded-lg bg-surface-sunken px-2.5 py-1.5 transition-colors duration-150 hover:bg-surface-raised has-[:checked]:bg-surface-raised has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent/60"
                  >
                    <input
                      type="checkbox"
                      name="roleIds"
                      value={role.id}
                      className="h-4 w-4 cursor-pointer accent-accent focus:outline-none"
                    />
                    <span
                      className="inline-flex h-6 items-center rounded-md px-2 text-xs font-medium"
                      style={{
                        backgroundColor: `${parsedColor}1a`,
                        color: parsedColor,
                      }}
                    >
                      {role.name}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </fieldset>
      </form>

      {error && <AdminNotice tone="danger">{error}</AdminNotice>}

      {link && (
        <AdminNotice
          tone="success"
          title={
            <>
              Invite link for <span className="font-semibold">{invitedEmail}</span>
            </>
          }
        >
          <p>Copy and send it now. It won&apos;t be shown again.</p>
          <div className="mt-3 flex gap-2">
            <input
              readOnly
              aria-label="Invite link"
              value={link}
              onFocus={(e) => e.currentTarget.select()}
              className={cx(inputSm, 'font-mono')}
            />
            <button type="button" onClick={copyLink} className={secondaryBtn}>
              {copied ? <HiCheck aria-hidden className="h-4 w-4 text-success" /> : <HiOutlineClipboard aria-hidden className="h-4 w-4" />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </AdminNotice>
      )}
    </div>
  );
}

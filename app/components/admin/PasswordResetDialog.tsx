'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { FiCheck, FiCopy, FiKey } from 'react-icons/fi';
import {
  issuePasswordResetLink,
  listPasswordResetLinks,
  revokePasswordResetLink,
} from '@/app/(admin)/admin/password-reset-actions';
import type { IssuedLinkView, ResetLinkStatus } from '@/app/lib/password-reset/core';
import { Overlay, Modal, Dialog, Heading } from '@/app/components/ui/overlay';
import { PendingLabel } from '@/app/components/admin/AdminUI';
import { chip, ghostBtn, ghostBtnSm, inputSm, primaryBtn, primaryBtnSm, type ChipTone } from '@/app/components/admin/styles';

interface PasswordResetDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  /** Name or email shown in the title so staff can tell whose link this is. */
  subject: string;
}

const STATUS_TONE: Record<ResetLinkStatus, ChipTone> = {
  outstanding: 'warning',
  used: 'success',
  expired: 'neutral',
  revoked: 'danger',
};

const STATUS_LABEL: Record<ResetLinkStatus, string> = {
  outstanding: 'Outstanding',
  used: 'Used',
  expired: 'Expired',
  revoked: 'Revoked',
};

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Issue, copy, view and revoke one-time password reset links for one account.
 * The raw link is held only in this component's state while the dialog is open: it
 * is never stored server-side, so closing the dialog discards it and the next link
 * has to be issued again (which revokes the previous one).
 */
export default function PasswordResetDialog({ isOpen, onOpenChange, userId, subject }: PasswordResetDialogProps) {
  const [links, setLinks] = useState<IssuedLinkView[]>([]);
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState<{ url: string; expiresAt: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isIssuing, startIssuing] = useTransition();
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setLinks(await listPasswordResetLinks({ userId }));
    } catch {
      setLinks([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!isOpen) {
      setGenerated(null);
      setCopied(false);
      setCopyFailed(false);
      setError(null);
      return;
    }
    void refresh();
  }, [isOpen, refresh]);

  useEffect(() => () => {
    if (copyTimer.current) clearTimeout(copyTimer.current);
  }, []);

  async function writeToClipboard(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setCopyFailed(false);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2500);
      return true;
    } catch {
      setCopied(false);
      setCopyFailed(true);
      return false;
    }
  }

  function handleIssue() {
    // aria-disabled does not stop clicks, so a double click must be refused here.
    if (isIssuing) return;
    setError(null);
    setGenerated(null);
    setCopied(false);
    setCopyFailed(false);
    startIssuing(async () => {
      try {
        const res = await issuePasswordResetLink({ userId });
        if (!res.success || !res.resetPath || !res.expiresAt) {
          setError(res.error ?? 'Could not issue a reset link.');
          return;
        }
        const url = `${window.location.origin}${res.resetPath}`;
        setGenerated({ url, expiresAt: res.expiresAt });
        // Copy straight away, like the manager invite link: the raw link exists only now, so
        // it is already on the clipboard even if the dialog is dismissed right after.
        await writeToClipboard(url);
        await refresh();
      } catch {
        setError('Could not issue a reset link. Please try again.');
      }
    });
  }

  async function handleCopy() {
    if (generated) await writeToClipboard(generated.url);
  }

  async function handleRevoke(id: string) {
    if (revokingId) return;
    setError(null);
    setRevokingId(id);
    try {
      const res = await revokePasswordResetLink(id);
      if (!res.success) setError(res.error ?? 'Could not revoke the link.');
      else setGenerated(null);
      await refresh();
    } catch {
      setError('Could not revoke the link. Please try again.');
    } finally {
      setRevokingId(null);
    }
  }

  const hasOutstanding = links.some((l) => l.status === 'outstanding');

  return (
    <Overlay
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      isDismissable
      className="admin-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
    >
      <Modal className="admin-modal w-full max-w-lg outline-none">
        <Dialog
          aria-label={`Password reset link for ${subject}`}
          className="max-h-[85vh] w-full overflow-y-auto rounded-2xl bg-surface-raised p-6 text-left shadow-2xl shadow-black/60 ring-1 ring-line/70 outline-none"
        >
          {({ close }) => (
            <div className="space-y-5">
              <div className="space-y-1.5">
                <Heading slot="title" className="flex items-center gap-2 text-base font-semibold text-foreground">
                  <FiKey aria-hidden className="h-4 w-4 text-accent" />
                  Password reset link
                </Heading>
                <p className="text-sm leading-6 text-foreground-secondary">
                  For <span className="font-medium text-foreground">{subject}</span>. Send the link to them privately
                  (for example in their Discord ticket). It works once and expires in 24 hours. Their current password
                  keeps working until they set a new one, and setting it signs out their other devices.
                </p>
              </div>

              {generated && (
                <div className="admin-fade-in space-y-2 rounded-xl bg-accent/10 p-4 ring-1 ring-accent/30">
                  <p className="text-sm font-medium text-accent">
                    Link ready. It is shown only now.
                  </p>
                  <p className={copyFailed ? 'text-xs font-medium text-danger-on-tint' : 'text-xs text-foreground-secondary'}>
                    {copyFailed
                      ? 'Could not copy automatically. Press Copy, or select the link and copy it manually, before closing this window.'
                      : copied
                        ? 'Copied to clipboard.'
                        : 'It was copied to your clipboard when generated.'}
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={generated.url}
                      aria-label="One-time password reset link"
                      className={`${inputSm} flex-1 select-all font-mono`}
                      onFocus={(e) => e.currentTarget.select()}
                    />
                    <button
                      type="button"
                      onClick={handleCopy}
                      className={`${primaryBtnSm} max-sm:min-h-11`}
                      aria-label="Copy reset link to clipboard"
                    >
                      {copied ? (
                        <>
                          <FiCheck aria-hidden className="h-3.5 w-3.5" /> Copied
                        </>
                      ) : (
                        <>
                          <FiCopy aria-hidden className="h-3.5 w-3.5" /> Copy
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-foreground-secondary">Expires {formatWhen(generated.expiresAt)}.</p>
                  <span role="status" aria-live="polite" className="sr-only">
                    {copied ? 'Link copied to clipboard' : copyFailed ? 'Could not copy the link automatically' : ''}
                  </span>
                </div>
              )}

              {error && (
                <p role="alert" className="rounded-xl bg-danger/15 px-4 py-3 text-sm leading-6 text-danger-on-tint">
                  {error}
                </p>
              )}

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleIssue}
                  aria-disabled={isIssuing || undefined}
                  aria-busy={isIssuing || undefined}
                  className={`${primaryBtn} max-sm:min-h-11`}
                >
                  <PendingLabel
                    pending={isIssuing}
                    label={generated || hasOutstanding ? 'Generate a new link' : 'Generate reset link'}
                    pendingLabel="Generating…"
                  />
                </button>
                {hasOutstanding && (
                  <p className="text-xs text-foreground-secondary">
                    Generating a new link revokes the outstanding one.
                  </p>
                )}
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold text-foreground">Recent links</h3>
                {loading && links.length === 0 ? (
                  <p role="status" className="text-sm text-foreground-secondary">Loading…</p>
                ) : links.length === 0 ? (
                  <p className="rounded-xl bg-surface-sunken/60 p-3 text-sm text-foreground-secondary">
                    No reset links have been issued for this account.
                  </p>
                ) : (
                  <ul className="divide-y divide-line/50 overflow-hidden rounded-xl bg-surface-sunken/60">
                    {links.map((link) => (
                      <li key={link.id} className="flex items-center justify-between gap-3 p-3 text-xs">
                        <div className="min-w-0 space-y-1">
                          <span className={chip(STATUS_TONE[link.status], 'sm')}>{STATUS_LABEL[link.status]}</span>
                          <p className="text-foreground-secondary">
                            Issued {formatWhen(link.createdAt)} by {link.issuedByEmail ?? 'former staff member'}
                          </p>
                          {link.status === 'used' && link.usedAt && (
                            <p className="text-foreground-secondary">Used {formatWhen(link.usedAt)}</p>
                          )}
                          {link.status === 'revoked' && link.revokedAt && (
                            <p className="text-foreground-secondary">Revoked {formatWhen(link.revokedAt)}</p>
                          )}
                          {link.status === 'outstanding' && (
                            <p className="text-foreground-secondary">Expires {formatWhen(link.expiresAt)}</p>
                          )}
                        </div>
                        {link.status === 'outstanding' && (
                          <button
                            type="button"
                            onClick={() => handleRevoke(link.id)}
                            aria-disabled={revokingId === link.id || undefined}
                            className={`${ghostBtnSm} shrink-0 text-red-300 hover:text-red-200 max-sm:min-h-11`}
                          >
                            {revokingId === link.id ? 'Revoking…' : 'Revoke'}
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex justify-end">
                <button type="button" onClick={close} className={`${ghostBtn} max-sm:min-h-11`}>
                  Close
                </button>
              </div>
            </div>
          )}
        </Dialog>
      </Modal>
    </Overlay>
  );
}

"use client";

import { useState, useTransition } from "react";
import { updateStaffApplicationStatus, softDeleteStaffApplication } from "@/app/(admin)/admin/applications/actions";
import ConfirmDeleteButton from "@/app/components/admin/ConfirmDeleteButton";
import StaffApplicationDetailModal from "@/app/components/admin/StaffApplicationDetailModal";
import type { StaffApplicationDetails } from "@/app/lib/staff-application-form";
import { ApplicationStatus, isValidStatusTransition } from "@/app/lib/application-status";
import { chip, chipButton, tdCompact as td, tdCompactRight as tdRight, textLinkSm, tr, type ChipTone } from "@/app/components/admin/styles";
import { cx } from "@/app/lib/cx";

type Status = ApplicationStatus;
type StatusFilter = "all" | Status;

export interface StaffApplication {
  id: string;
  name: string;
  preferredFirstName: string | null;
  email: string;
  phone: string;
  discordTag: string | null;
  role: string;
  details: StaffApplicationDetails | null;
  hasResume: boolean;
  status: Status;
  submittedAt: Date;
}

const statusTone: Record<Status, ChipTone> = {
  pending: "accent",
  reviewed: "info",
  accepted: "success",
  rejected: "danger",
};

export function StaffDetailsChips({ details }: { details: StaffApplicationDetails | null }) {
  if (!details) {
    return <span className="text-foreground-secondary text-xs">—</span>;
  }

  const availability = typeof details.availability === "string" ? details.availability.trim() : null;
  const linkedin = typeof details.linkedin === "string" && details.linkedin.trim() ? details.linkedin.trim() : null;
  const discordTag = typeof details.discordTag === "string" ? details.discordTag.trim() : null;
  const motivation = typeof details.backgroundMotivation === "string" ? details.backgroundMotivation.trim() : null;

  return (
    <div className="space-y-1 py-0.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {availability && (
          <span className={chip("success")}>
            {availability}
          </span>
        )}
        {linkedin && (
          <a
            href={linkedin.startsWith("http") ? linkedin : `https://${linkedin}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className={cx(chip("info"), "hover:text-sky-200 transition-colors")}
          >
            LinkedIn ↗
          </a>
        )}
        {discordTag && (
          <span className={chip("violet")}>
            {discordTag}
          </span>
        )}
      </div>
      {motivation && (
        <p className="text-xs text-foreground-secondary line-clamp-2 italic max-w-[260px]">
          &ldquo;{motivation}&rdquo;
        </p>
      )}
    </div>
  );
}

export default function StaffApplicationRow({ app, activeFilter = "all" }: { app: StaffApplication; activeFilter?: StatusFilter }) {
  const [status, setStatus] = useState<Status>(app.status);
  const [detailOpen, setDetailOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);

  if (removed) return null;

  const handleStatusChange = (s: Status) => {
    const prev = status;
    setStatus(s);
    setActionError(null);
    startTransition(async () => {
      try {
        const res = await updateStaffApplicationStatus(app.id, s);
        if (res && !res.success) {
          setStatus(prev);
          setActionError(res.error || "Failed to update status. Please try again.");
          return;
        }
        if (activeFilter !== "all" && s !== activeFilter) setRemoved(true);
      } catch (err) {
        setStatus(prev);
        setActionError(err instanceof Error ? err.message : "Failed to update status. Please try again.");
      }
    });
  };

  const handleDelete = async () => {
    setActionError(null);
    let result;
    await new Promise<void>((resolve) => {
      startTransition(async () => {
        try {
          const res = await softDeleteStaffApplication(app.id);
          result = res;
          if (res && !res.success) {
            setActionError(res.error || "Failed to delete application. Please try again.");
          } else {
            setRemoved(true);
          }
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : "Failed to delete application. Please try again.";
          setActionError(errMsg);
          result = { success: false, error: errMsg };
        } finally {
          resolve();
        }
      });
    });
    return result;
  };

  return (
    <>
      <tr className={tr}>
        <td className={td}>
          <div className="font-medium text-foreground">{app.name}</div>
          {app.preferredFirstName && (
            <div className="text-xs text-foreground-secondary">goes by {app.preferredFirstName}</div>
          )}
          <a href={`mailto:${app.email}`} className="break-all rounded text-xs text-foreground-secondary hover:text-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent/60">
            {app.email}
          </a>
          <div className="text-xs text-foreground-secondary">{app.phone}</div>
        </td>
        <td className={cx(td, "text-foreground-secondary capitalize")}>{app.role}</td>
        <td className={cx(td, "text-foreground-secondary")}>
          <div className="flex items-start justify-between gap-2">
            <StaffDetailsChips details={app.details} />
            <button
              type="button"
              onClick={() => setDetailOpen(true)}
              className={cx(textLinkSm, "mt-0.5 shrink-0")}
            >
              View
            </button>
          </div>
        </td>
        <td className={td}>
          <div className="flex flex-wrap gap-1 items-center" role="group" aria-label="Application status">
            {(["pending", "reviewed", "accepted", "rejected"] as const).map((s) => {
              const isCurrent = status === s;
              const canTransition = isCurrent || isValidStatusTransition(status, s);
              return (
                <button
                  key={s}
                  type="button"
                  disabled={isPending || isCurrent || !canTransition}
                  onClick={() => handleStatusChange(s)}
                  aria-pressed={isCurrent}
                  className={cx(
                    "capitalize",
                    isCurrent
                      ? cx(chip(statusTone[s], "sm"), "cursor-default")
                      : canTransition
                      ? chipButton("ghost", "sm")
                      : cx(chip("ghost", "sm"), "opacity-35 cursor-not-allowed"),
                  )}
                >
                  {s}
                </button>
              );
            })}
          </div>
          {actionError && (
            <span role="alert" aria-live="polite" className="admin-fade-in mt-1 block text-xs font-medium text-danger-on-tint">
              {actionError}
            </span>
          )}
        </td>
        <td className={cx(td, "text-foreground-secondary whitespace-nowrap")}>
          {new Date(app.submittedAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </td>
        <td className={cx(tdRight, "whitespace-nowrap")}>
          <ConfirmDeleteButton
            action={handleDelete}
            message="Are you sure you want to remove this application?"
            label={`Remove application from ${app.name}`}
          />
        </td>
      </tr>
      <StaffApplicationDetailModal app={app} isOpen={detailOpen} onOpenChange={setDetailOpen} />
    </>
  );
}

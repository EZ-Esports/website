"use client";

import { useState, useTransition } from "react";
import { updateStaffApplicationStatus, softDeleteStaffApplication } from "@/app/(admin)/admin/applications/actions";
import ConfirmDeleteButton from "@/app/components/admin/ConfirmDeleteButton";
import StaffApplicationDetailModal from "@/app/components/admin/StaffApplicationDetailModal";
import type { StaffApplicationDetails } from "@/app/lib/staff-application-form";
import { ApplicationStatus, isValidStatusTransition } from "@/app/lib/application-status";

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

const activeBadgeClass: Record<Status, string> = {
  pending: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  reviewed: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
  accepted: "bg-green-500/10 text-green-400 border border-green-500/20",
  rejected: "bg-red-500/10 text-red-400 border border-red-500/20",
};

export function StaffDetailsChips({ details }: { details: StaffApplicationDetails | null }) {
  if (!details) {
    return <span className="text-foreground-muted italic text-xs">—</span>;
  }

  const availability = typeof details.availability === "string" ? details.availability.trim() : null;
  const linkedin = typeof details.linkedin === "string" && details.linkedin.trim() ? details.linkedin.trim() : null;
  const discordTag = typeof details.discordTag === "string" ? details.discordTag.trim() : null;
  const motivation = typeof details.backgroundMotivation === "string" ? details.backgroundMotivation.trim() : null;

  return (
    <div className="space-y-1 py-0.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {availability && (
          <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            {availability}
          </span>
        )}
        {linkedin && (
          <a
            href={linkedin.startsWith("http") ? linkedin : `https://${linkedin}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:text-blue-300 transition-colors"
          >
            LinkedIn ↗
          </a>
        )}
        {discordTag && (
          <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
            {discordTag}
          </span>
        )}
      </div>
      {motivation && (
        <p className="text-xs text-foreground-secondary line-clamp-1 italic max-w-[280px]">
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
      <tr className="hover:bg-surface-raised/40 transition-colors">
        <td className="py-3 pr-4 font-semibold text-white whitespace-nowrap">
          {app.name}
          {app.preferredFirstName && (
            <span className="block text-xs font-normal text-foreground-muted">goes by {app.preferredFirstName}</span>
          )}
          {app.discordTag && <span className="block text-xs font-normal text-foreground-muted">{app.discordTag}</span>}
        </td>
        <td className="py-3 pr-4 text-foreground-secondary capitalize">{app.role}</td>
        <td className="py-3 pr-4">
          <a href={`mailto:${app.email}`} className="text-foreground-secondary hover:text-white transition-colors">
            {app.email}
          </a>
        </td>
        <td className="py-3 pr-4 text-foreground-secondary whitespace-nowrap">{app.phone}</td>
        <td className="py-3 pr-4 text-foreground-secondary min-w-[240px] max-w-[360px]">
          <div className="flex items-start justify-between gap-2">
            <StaffDetailsChips details={app.details} />
            <button
              type="button"
              onClick={() => setDetailOpen(true)}
              className="mt-0.5 text-accent hover:text-accent/80 transition-colors text-xs font-semibold cursor-pointer shrink-0"
            >
              View
            </button>
          </div>
        </td>
        <td className="py-3 pr-4">
          <div className="flex gap-1 items-center">
            {(["pending", "reviewed", "accepted", "rejected"] as const).map((s) => {
              const isCurrent = status === s;
              const canTransition = isCurrent || isValidStatusTransition(status, s);
              return (
                <button
                  key={s}
                  type="button"
                  disabled={isPending || isCurrent || !canTransition}
                  onClick={() => handleStatusChange(s)}
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize transition-all cursor-pointer disabled:cursor-not-allowed ${
                    isCurrent
                      ? activeBadgeClass[s]
                      : canTransition
                      ? "bg-line/50 text-foreground-muted border border-line hover:bg-line/50"
                      : "bg-line/20 text-foreground-muted/40 border border-line/30"
                  }`}
                >
                  {s}
                </button>
              );
            })}
            {actionError && (
              <span role="alert" aria-live="polite" className="text-[10px] text-red-400 ml-1 font-semibold">
                {actionError}
              </span>
            )}
          </div>
        </td>
        <td className="py-3 pr-4 text-foreground-secondary whitespace-nowrap">
          {new Date(app.submittedAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </td>
        <td className="py-3 pr-2 text-right whitespace-nowrap">
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

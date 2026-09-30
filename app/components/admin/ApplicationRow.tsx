"use client";

import { useState, useTransition } from "react";
import { updateApplicationStatus, softDeleteSchoolApplication } from "@/app/(admin)/admin/applications/actions";
import ConfirmDeleteButton from "@/app/components/admin/ConfirmDeleteButton";
import ApplicationDetailModal from "@/app/components/admin/ApplicationDetailModal";
import type { SchoolApplicationDetails } from "@/app/lib/school-application-form";
import { ApplicationStatus, isValidStatusTransition } from "@/app/lib/application-status";

type Status = ApplicationStatus;
type StatusFilter = "all" | Status;

export interface Application {
  id: string;
  applicantName: string;
  schoolName: string;
  role: string;
  email: string;
  message: string | null;
  details: SchoolApplicationDetails | null;
  status: Status;
  submittedAt: Date;
}

const activeBadgeClass: Record<Status, string> = {
  pending: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  reviewed: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
  accepted: "bg-green-500/10 text-green-400 border border-green-500/20",
  rejected: "bg-red-500/10 text-red-400 border border-red-500/20",
};

export default function ApplicationRow({ app, activeFilter = "all" }: { app: Application; activeFilter?: StatusFilter }) {
  const [status, setStatus] = useState<Status>(app.status);
  const [detailOpen, setDetailOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);

  const message = app.message ?? "";
  const isLong = message.length > 80;

  if (removed) return null;

  const handleStatusChange = (s: Status) => {
    const prev = status;
    setStatus(s);
    setActionError(null);
    startTransition(async () => {
      try {
        const res = await updateApplicationStatus(app.id, s);
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
          const res = await softDeleteSchoolApplication(app.id);
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
        <td className="py-3 pr-4 font-semibold text-white whitespace-nowrap">{app.applicantName}</td>
        <td className="py-3 pr-4 text-foreground-secondary">{app.schoolName}</td>
        <td className="py-3 pr-4 text-foreground-secondary capitalize">{app.role}</td>
        <td className="py-3 pr-4">
          <a href={`mailto:${app.email}`} className="text-foreground-secondary hover:text-white transition-colors">
            {app.email}
          </a>
        </td>
        <td className="py-3 pr-4 text-foreground-secondary max-w-[320px]">
          {message || app.details ? (
            <>
              {message && (
                <span className="whitespace-pre-line">{isLong ? `${message.slice(0, 80)}…` : message}</span>
              )}
              <button
                type="button"
                onClick={() => setDetailOpen(true)}
                className="ml-1 text-accent hover:text-accent/80 transition-colors text-xs font-semibold cursor-pointer"
              >
                View
              </button>
            </>
          ) : (
            <span className="text-foreground-muted italic">—</span>
          )}
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
            label={`Remove application from ${app.schoolName}`}
          />
        </td>
      </tr>
      <ApplicationDetailModal app={app} isOpen={detailOpen} onOpenChange={setDetailOpen} />
    </>
  );
}

"use client";

import { useState, useTransition } from "react";
import { updateApplicationStatus, softDeleteSchoolApplication } from "@/app/(admin)/admin/applications/actions";
import ConfirmDeleteButton from "@/app/components/admin/ConfirmDeleteButton";
import ApplicationDetailModal from "@/app/components/admin/ApplicationDetailModal";
import type { SchoolApplicationDetails } from "@/app/lib/school-application-form";
import { ApplicationStatus, isValidStatusTransition } from "@/app/lib/application-status";
import { chip, chipButton, td, tdRight, textLinkSm, tr, type ChipTone } from "@/app/components/admin/styles";
import { cx } from "@/app/lib/cx";

type Status = ApplicationStatus;
type StatusFilter = "all" | Status;

export interface Application {
  id: string;
  applicantName: string;
  schoolName: string;
  role: string;
  email: string;
  details: SchoolApplicationDetails | null;
  status: Status;
  submittedAt: Date;
}

const statusTone: Record<Status, ChipTone> = {
  pending: "accent",
  reviewed: "info",
  accepted: "success",
  rejected: "danger",
};

export function SchoolDetailsChips({ details }: { details: SchoolApplicationDetails | null }) {
  if (!details) {
    return <span className="text-foreground-secondary text-xs">—</span>;
  }

  if (details.version === 2 || details.version === 3) {
    const rawGames = details.club?.interestedGames;
    const games = Array.isArray(rawGames)
      ? rawGames.filter((g): g is string => typeof g === "string" && g.trim().length > 0)
      : [];
    const rawActive = details.club?.activeStudentsCount;
    const activeStudents = typeof rawActive === "string" ? rawActive.trim() : typeof rawActive === "number" ? String(rawActive) : undefined;
    const rawAdvisor = details.club?.advisorConfirmed;
    const advisorConfirmed = typeof rawAdvisor === "string" ? rawAdvisor.trim() : typeof rawAdvisor === "boolean" ? (rawAdvisor ? "Yes" : "No") : undefined;
    const rawGradYear = details.president?.gradYear;
    const gradYear = typeof rawGradYear === "string" ? rawGradYear.trim() : typeof rawGradYear === "number" ? String(rawGradYear) : undefined;

    return (
      <div className="flex flex-wrap items-center gap-1.5 py-0.5">
        {gradYear && (
          <span className={chip("neutral")}>
            Class &apos;{gradYear.replace(/^20/, "")}
          </span>
        )}
        {activeStudents && (
          <span className={chip("info")}>
            {activeStudents} {activeStudents.toLowerCase().includes("student") || activeStudents.toLowerCase().includes("member") ? "" : "students"}
          </span>
        )}
        {advisorConfirmed && (
          <span
            className={chip(
              advisorConfirmed.toLowerCase() === "yes" || advisorConfirmed.toLowerCase() === "confirmed" ? "success" : "warning",
            )}
          >
            Advisor: {advisorConfirmed}
          </span>
        )}
        {games.map((game) => (
          <span
            key={game}
            className={chip("accent")}
          >
            {game}
          </span>
        ))}
      </div>
    );
  }

  // Version 1 fallback
  return (
    <div className="flex flex-wrap items-center gap-1.5 py-0.5">
      {details.interestedDivisions && (
        <span className={chip("accent")}>
          {details.interestedDivisions}
        </span>
      )}
      {details.schoolCode && (
        <span className={chip("neutral")}>
          Code: {details.schoolCode}
        </span>
      )}
    </div>
  );
}

export default function ApplicationRow({ app, activeFilter = "all" }: { app: Application; activeFilter?: StatusFilter }) {
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
      <tr className={tr}>
        <td className={cx(td, "font-medium text-foreground whitespace-nowrap")}>{app.applicantName}</td>
        <td className={cx(td, "text-foreground-secondary")}>{app.schoolName}</td>
        <td className={cx(td, "text-foreground-secondary capitalize")}>{app.role}</td>
        <td className={td}>
          <a href={`mailto:${app.email}`} className="rounded text-foreground-secondary hover:text-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent/60">
            {app.email}
          </a>
        </td>
        <td className={cx(td, "text-foreground-secondary min-w-[240px] max-w-[360px]")}>
          <div className="flex items-start justify-between gap-2">
            <SchoolDetailsChips details={app.details} />
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
          <div className="flex flex-nowrap gap-0.5 items-center" role="group" aria-label="Application status">
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
            label={`Remove application from ${app.schoolName}`}
          />
        </td>
      </tr>
      <ApplicationDetailModal app={app} isOpen={detailOpen} onOpenChange={setDetailOpen} />
    </>
  );
}

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

export function SchoolDetailsChips({ details }: { details: SchoolApplicationDetails | null }) {
  if (!details) {
    return <span className="text-foreground-muted italic text-xs">—</span>;
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
          <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full bg-surface-raised text-foreground-secondary border border-line">
            Class &apos;{gradYear.replace(/^20/, "")}
          </span>
        )}
        {activeStudents && (
          <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
            {activeStudents} {activeStudents.toLowerCase().includes("student") || activeStudents.toLowerCase().includes("member") ? "" : "students"}
          </span>
        )}
        {advisorConfirmed && (
          <span
            className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
              advisorConfirmed.toLowerCase() === "yes" || advisorConfirmed.toLowerCase() === "confirmed"
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : "bg-amber-500/10 text-amber-400 border-amber-500/20"
            }`}
          >
            Advisor: {advisorConfirmed}
          </span>
        )}
        {games.map((game) => (
          <span
            key={game}
            className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20"
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
        <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20">
          {details.interestedDivisions}
        </span>
      )}
      {details.schoolCode && (
        <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full bg-surface-raised text-foreground-secondary border border-line">
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
      <tr className="hover:bg-surface-raised/40 transition-colors">
        <td className="py-3 pr-4 font-semibold text-white whitespace-nowrap">{app.applicantName}</td>
        <td className="py-3 pr-4 text-foreground-secondary">{app.schoolName}</td>
        <td className="py-3 pr-4 text-foreground-secondary capitalize">{app.role}</td>
        <td className="py-3 pr-4">
          <a href={`mailto:${app.email}`} className="text-foreground-secondary hover:text-white transition-colors">
            {app.email}
          </a>
        </td>
        <td className="py-3 pr-4 text-foreground-secondary min-w-[240px] max-w-[360px]">
          <div className="flex items-start justify-between gap-2">
            <SchoolDetailsChips details={app.details} />
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
            label={`Remove application from ${app.schoolName}`}
          />
        </td>
      </tr>
      <ApplicationDetailModal app={app} isOpen={detailOpen} onOpenChange={setDetailOpen} />
    </>
  );
}

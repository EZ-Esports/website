'use client';

import { useState } from 'react';
import Link from 'next/link';
import { adminButton, chip, chipDot, deleteIconBtn, editIconBtn, focusRing, secondaryBtnSm, td, tdRight, tr } from './styles';
import { deleteCareerPostingAction } from '@/app/(admin)/admin/careers/actions';
import type { AdminCareerPostingWithStats } from '@/app/types/careers';
import {
  HiOutlinePencilSquare,
  HiOutlineTrash,
  HiOutlineArrowTopRightOnSquare,
  HiOutlineUsers,
} from 'react-icons/hi2';

interface CareerPostingRowProps {
  posting: AdminCareerPostingWithStats;
  onEdit: (posting: AdminCareerPostingWithStats) => void;
  onRefresh: () => void;
}

export default function CareerPostingRow({
  posting,
  onEdit,
  onRefresh,
}: CareerPostingRowProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await deleteCareerPostingAction(posting.id);
      if (res.success) {
        onRefresh();
      } else {
        alert(res.error || 'Failed to delete posting.');
      }
    } catch {
      alert('Failed to delete posting.');
    } finally {
      setIsDeleting(false);
      setShowConfirmDelete(false);
    }
  };

  const statusTone = { published: 'success', draft: 'warning', closed: 'danger' } as const;
  const statusLabel = { published: 'Published', draft: 'Draft', closed: 'Closed' } as const;
  const getStatusBadge = (status: string) => {
    if (!(status in statusTone)) return null;
    const key = status as keyof typeof statusTone;
    return (
      <span className={chip(statusTone[key])}>
        <span aria-hidden className={chipDot} />
        {statusLabel[key]}
      </span>
    );
  };

  return (
    <tr className={tr}>
      {/* Title & Slug */}
      <td className={td}>
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground">{posting.title}</span>
          {posting.status === 'published' && (
            <Link
              href={`/careers/${posting.slug}`}
              target="_blank"
              title="Preview public posting"
              aria-label={`Preview public posting for ${posting.title} (opens in a new tab)`}
              className={`rounded text-foreground-secondary hover:text-accent transition-colors ${focusRing}`}
            >
              <HiOutlineArrowTopRightOnSquare aria-hidden className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
        <p className="mt-0.5 font-mono text-xs text-foreground-secondary">/{posting.slug}</p>
      </td>

      {/* Department */}
      <td className={`${td} text-foreground-secondary`}>{posting.department}</td>

      {/* Status */}
      <td className={td}>{getStatusBadge(posting.status)}</td>

      {/* Commitment */}
      <td className={`${td} text-foreground-secondary`}>{posting.commitment}</td>

      {/* Applicants Count */}
      <td className={td}>
        <Link
          href={`/admin/applications?posting=${posting.id}`}
          aria-label={`${posting.applicantCount} applicants for ${posting.title}`}
          className={`${secondaryBtnSm} tabular-nums`}
        >
          <HiOutlineUsers aria-hidden className="w-3.5 h-3.5 text-accent" />
          <span>{posting.applicantCount}</span>
        </Link>
      </td>

      {/* Actions */}
      <td className={tdRight}>
        <div className="inline-flex items-center gap-2 justify-end">
          <button
            type="button"
            onClick={() => onEdit(posting)}
            className={editIconBtn}
            title="Edit Opening"
            aria-label="Edit Opening"
          >
            <HiOutlinePencilSquare aria-hidden className="w-4 h-4" />
          </button>

          {showConfirmDelete ? (
            <div role="group" aria-label="Confirm delete" className="admin-fade-in inline-flex h-8 items-center gap-1 rounded-lg bg-danger/10 pl-2.5 pr-1">
              <span className="text-xs font-medium text-danger-on-tint">Delete?</span>
              <button type="button" onClick={handleDelete} disabled={isDeleting} aria-busy={isDeleting} className={adminButton('danger', 'xs')}>
                Yes
              </button>
              <button type="button" onClick={() => setShowConfirmDelete(false)} className={adminButton('ghost', 'xs')}>
                No
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowConfirmDelete(true)}
              className={deleteIconBtn}
              title="Delete Opening"
              aria-label="Delete Opening"
            >
              <HiOutlineTrash aria-hidden className="w-4 h-4" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

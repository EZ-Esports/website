'use client';

import { useState } from 'react';
import Link from 'next/link';
import { editIconBtn, iconBtn } from './styles';
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'published':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            Published
          </span>
        );
      case 'draft':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/30">
            Draft
          </span>
        );
      case 'closed':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-rose-500/10 text-rose-400 border border-rose-500/30">
            Closed
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <tr className="hover:bg-surface-raised/40 transition-colors">
      {/* Title & Slug */}
      <td className="py-3.5 pr-4">
        <div className="flex items-center gap-2">
          <span className="font-bold text-white text-sm">{posting.title}</span>
          {posting.status === 'published' && (
            <Link
              href={`/careers/${posting.slug}`}
              target="_blank"
              title="Preview public posting"
              className="text-foreground-muted hover:text-accent transition-colors"
            >
              <HiOutlineArrowTopRightOnSquare className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
        <p className="text-xs text-foreground-muted font-mono mt-0.5">/{posting.slug}</p>
      </td>

      {/* Department */}
      <td className="py-3.5 pr-4">
        <span className="text-xs text-foreground-secondary font-medium">
          {posting.department}
        </span>
      </td>

      {/* Status */}
      <td className="py-3.5 pr-4">
        {getStatusBadge(posting.status)}
      </td>

      {/* Commitment */}
      <td className="py-3.5 pr-4 text-xs text-foreground-muted">
        {posting.commitment}
      </td>

      {/* Applicants Count */}
      <td className="py-3.5 pr-4">
        <Link
          href={`/admin/applications?posting=${posting.id}`}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-raised hover:bg-surface border border-line text-xs font-bold text-foreground hover:text-white transition-all"
        >
          <HiOutlineUsers className="w-3.5 h-3.5 text-accent" />
          <span>{posting.applicantCount}</span>
        </Link>
      </td>

      {/* Actions */}
      <td className="py-3.5 pr-2 text-right">
        <div className="inline-flex items-center gap-2 justify-end">
          <button
            type="button"
            onClick={() => onEdit(posting)}
            className={editIconBtn}
            title="Edit Opening"
            aria-label="Edit Opening"
          >
            <HiOutlinePencilSquare className="w-4 h-4" />
          </button>

          {showConfirmDelete ? (
            <div className="inline-flex items-center gap-1.5 bg-red-950/80 border border-red-500/40 rounded-lg px-2 py-1">
              <span className="text-[10px] text-red-200 font-bold uppercase">Delete?</span>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="text-[10px] bg-red-600 hover:bg-red-500 text-white font-bold px-1.5 py-0.5 rounded cursor-pointer"
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => setShowConfirmDelete(false)}
                className="text-[10px] text-foreground-muted hover:text-white px-1 cursor-pointer"
              >
                No
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowConfirmDelete(true)}
              className={`${iconBtn} text-red-400 hover:text-red-300 hover:bg-red-500/10`}
              title="Delete Opening"
              aria-label="Delete Opening"
            >
              <HiOutlineTrash className="w-4 h-4" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

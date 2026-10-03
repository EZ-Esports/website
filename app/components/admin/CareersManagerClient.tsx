'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { primaryBtn, segmentedGroup, segmentedItem, table, tableWrap, tbody, th, theadRow, thRight } from './styles';
import { AdminEmptyState, AdminPageHeader, AdminSearchField, AdminSection, AdminCount } from './AdminUI';
import CareerPostingRow from './CareerPostingRow';
import CareerPostingModal from './CareerPostingModal';
import type { AdminCareerPostingWithStats } from '@/app/types/careers';
import { HiOutlinePlus, HiOutlineBriefcase } from 'react-icons/hi2';

interface CareersManagerClientProps {
  initialPostings: AdminCareerPostingWithStats[];
}

export default function CareersManagerClient({ initialPostings }: CareersManagerClientProps) {
  const router = useRouter();
  const [postings] = useState<AdminCareerPostingWithStats[]>(initialPostings);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPosting, setEditingPosting] = useState<AdminCareerPostingWithStats | null>(null);

  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft' | 'closed'>('all');
  const [search, setSearch] = useState('');

  const filtered = postings.filter((p) => {
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    const matchesSearch =
      !search.trim() ||
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.department.toLowerCase().includes(search.toLowerCase()) ||
      p.slug.toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const handleOpenCreate = () => {
    setEditingPosting(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (posting: AdminCareerPostingWithStats) => {
    setEditingPosting(posting);
    setModalOpen(true);
  };

  const handleSuccess = () => {
    router.refresh();
  };

  return (
    <>
      {/* Rendered here (not in the page) because the primary action opens this component's modal. */}
      <AdminPageHeader
        route="/admin/careers"
        description="Manage staff job postings, application requirements, and review submission volume."
        actions={
          <button type="button" onClick={handleOpenCreate} className={primaryBtn}>
            <HiOutlinePlus aria-hidden className="h-4 w-4" />
            New opening
          </button>
        }
      />

      <AdminSection
        variant="flush"
        stickyToolbar
        title={<>Career openings<AdminCount>{postings.length}</AdminCount></>}
        toolbar={
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div role="group" aria-label="Filter openings by status" className={segmentedGroup}>
              {(['all', 'published', 'draft', 'closed'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={statusFilter === s}
                  onClick={() => setStatusFilter(s)}
                  className={`${segmentedItem(statusFilter === s)} cursor-pointer capitalize`}
                >
                  {s}
                </button>
              ))}
            </div>
            <AdminSearchField
              size="sm"
              className="w-full sm:w-64"
              aria-label="Filter by role or department"
              placeholder="Filter by role or department…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClear={() => setSearch('')}
            />
          </div>
        }
      >
        {filtered.length === 0 ? (
          <AdminEmptyState
            icon={<HiOutlineBriefcase />}
            title={postings.length === 0 ? 'No career openings created yet.' : 'No openings match your current filter.'}
            action={
              postings.length === 0 && (
                <button type="button" onClick={handleOpenCreate} className={primaryBtn}>
                  <HiOutlinePlus aria-hidden className="h-4 w-4" />
                  New opening
                </button>
              )
            }
          />
        ) : (
          <div className={tableWrap}>
            <table className={table}>
              <thead>
                <tr className={theadRow}>
                  <th className={th}>Position</th>
                  <th className={th}>Department</th>
                  <th className={th}>Status</th>
                  <th className={th}>Commitment</th>
                  <th className={th}>Applicants</th>
                  <th className={thRight}>Actions</th>
                </tr>
              </thead>
              <tbody className={tbody}>
                {filtered.map((posting) => (
                  <CareerPostingRow
                    key={posting.id}
                    posting={posting}
                    onEdit={handleOpenEdit}
                    onRefresh={handleSuccess}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminSection>

      {/* Create / Edit Modal */}
      <CareerPostingModal
        isOpen={modalOpen}
        posting={editingPosting}
        onClose={() => setModalOpen(false)}
        onSuccess={handleSuccess}
      />
    </>
  );
}

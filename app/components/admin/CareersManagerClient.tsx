'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Card from '@/app/components/ui/Card';
import { primaryBtn, input } from './styles';
import CareerPostingRow from './CareerPostingRow';
import CareerPostingModal from './CareerPostingModal';
import type { AdminCareerPostingWithStats } from '@/app/types/careers';
import { HiOutlinePlus, HiOutlineMagnifyingGlass, HiOutlineBriefcase } from 'react-icons/hi2';

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
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-white uppercase tracking-wider flex items-center gap-2">
            <HiOutlineBriefcase className="w-6 h-6 text-accent" />
            <span>Career Openings</span>
            <span className="text-foreground-muted text-sm font-normal">({postings.length})</span>
          </h1>
          <p className="text-xs text-foreground-secondary mt-1">
            Manage staff job postings, application requirements, and review submission volume.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className={primaryBtn}
        >
          <HiOutlinePlus className="w-4 h-4" />
          <span>New Opening</span>
        </button>
      </div>

      {/* Main Card */}
      <Card className="bg-surface-raised/30 border border-line border-l-4 border-l-accent p-6">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          {/* Status Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {(['all', 'published', 'draft', 'closed'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`text-[10px] font-bold px-3 py-1.5 rounded-lg uppercase tracking-wider transition-all border cursor-pointer ${
                  statusFilter === s
                    ? 'bg-accent/15 text-accent border-accent/40'
                    : 'bg-surface-raised text-foreground-secondary border-line hover:text-white'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative w-full sm:w-64">
            <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted pointer-events-none" />
            <input
              type="text"
              placeholder="Filter by role or department..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`${input} pl-9 text-xs py-1.5`}
            />
          </div>
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-foreground-secondary text-sm">
              {postings.length === 0
                ? 'No career openings created yet. Click "New Opening" above to get started.'
                : 'No openings match your current filter.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-accent/20">
                  <th className="text-left text-xs font-bold text-foreground-secondary uppercase tracking-wider pb-3 pr-4">
                    Position
                  </th>
                  <th className="text-left text-xs font-bold text-foreground-secondary uppercase tracking-wider pb-3 pr-4">
                    Department
                  </th>
                  <th className="text-left text-xs font-bold text-foreground-secondary uppercase tracking-wider pb-3 pr-4">
                    Status
                  </th>
                  <th className="text-left text-xs font-bold text-foreground-secondary uppercase tracking-wider pb-3 pr-4">
                    Commitment
                  </th>
                  <th className="text-left text-xs font-bold text-foreground-secondary uppercase tracking-wider pb-3 pr-4">
                    Applicants
                  </th>
                  <th className="text-right text-xs font-bold text-foreground-secondary uppercase tracking-wider pb-3 pr-2">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
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
      </Card>

      {/* Create / Edit Modal */}
      <CareerPostingModal
        isOpen={modalOpen}
        posting={editingPosting}
        onClose={() => setModalOpen(false)}
        onSuccess={handleSuccess}
      />
    </div>
  );
}

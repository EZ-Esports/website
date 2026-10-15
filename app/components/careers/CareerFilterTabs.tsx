'use client';

import { useMemo, useState } from 'react';
import type { CareerPostingSummary } from '@/app/types/careers';
import CareerCard from './CareerCard';
import { HiOutlineMagnifyingGlass } from 'react-icons/hi2';

interface CareerFilterTabsProps {
  postings: CareerPostingSummary[];
}

export default function CareerFilterTabs({ postings }: CareerFilterTabsProps) {
  const [selectedDept, setSelectedDept] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const departments = useMemo(() => {
    const set = new Set<string>();
    postings.forEach((p) => set.add(p.department));
    return ['All', ...Array.from(set).sort()];
  }, [postings]);

  const filteredPostings = useMemo(() => {
    return postings.filter((p) => {
      const matchesDept = selectedDept === 'All' || p.department === selectedDept;
      const matchesSearch =
        !searchQuery.trim() ||
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.department.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesDept && matchesSearch;
    });
  }, [postings, selectedDept, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Controls: Department Tabs + Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Department Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 sm:pb-0 scrollbar-none">
          {departments.map((dept) => {
            const isSelected = selectedDept === dept;
            return (
              <button
                key={dept}
                type="button"
                onClick={() => setSelectedDept(dept)}
                className={`text-xs font-bold px-3.5 py-2 rounded-xl transition-all duration-200 whitespace-nowrap cursor-pointer border ${
                  isSelected
                    ? 'bg-accent/15 text-accent border-accent/40 shadow-sm'
                    : 'bg-surface-raised/40 text-foreground-secondary border-line hover:text-white hover:border-line hover:bg-surface-raised'
                }`}
              >
                {dept}
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted pointer-events-none" />
          <input
            type="text"
            placeholder="Search roles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-surface-raised/40 border border-line rounded-xl pl-9 pr-3 py-2 text-xs text-foreground placeholder:text-foreground-muted focus:outline-none focus:border-accent transition-colors"
          />
        </div>
      </div>

      {/* Grid */}
      {filteredPostings.length === 0 ? (
        <div className="text-center py-12 px-4 rounded-2xl border border-line/60 bg-surface/30">
          <p className="text-foreground-secondary text-sm">
            No openings found matching your criteria.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPostings.map((posting) => (
            <CareerCard key={posting.id} posting={posting} />
          ))}
        </div>
      )}
    </div>
  );
}

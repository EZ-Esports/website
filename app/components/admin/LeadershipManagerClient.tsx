'use client';

import { useState, useMemo, useRef } from 'react';
import Card from '@/app/components/ui/Card';
import LeadershipRow, { LeaderRowItem } from '@/app/components/admin/LeadershipRow';
import ImageUpload from '@/app/components/admin/ImageUpload';
import SubmitButton from '@/app/components/admin/SubmitButton';
import { createLeader } from '@/app/(admin)/admin/leadership/actions';
import type { DBMember, School } from '@/app/types';
import { HiMagnifyingGlass, HiXMark, HiUserPlus, HiCheck, HiSparkles } from 'react-icons/hi2';

export interface PersonItem {
  id: string;
  fullName: string;
  preferredName?: string | null;
  handle: string | null;
  avatarUrl: string | null;
  storageKey: string | null;
  highSchool: string | null;
  university: string | null;
  graduationYear: number | null;
  bio: string | null;
  memberId: string | null;
  isActive?: boolean;
}

interface LeadershipManagerClientProps {
  initialLeadership: LeaderRowItem[];
  peopleList: PersonItem[];
  membersList: DBMember[];
  schoolsList: School[];
}

const inputClass =
  'w-full px-3.5 py-2.5 bg-surface-sunken border border-line/80 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/30 transition-all';

export default function LeadershipManagerClient({
  initialLeadership,
  peopleList,
  membersList,
  schoolsList,
}: LeadershipManagerClientProps) {
  // Filter States
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Creation Mode State: 'existing' vs 'new'
  const [creationMode, setCreationMode] = useState<'existing' | 'new'>('existing');
  const [selectedPerson, setSelectedPerson] = useState<PersonItem | null>(null);
  const [personSearch, setPersonSearch] = useState<string>('');
  const [showPersonDropdown, setShowPersonDropdown] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<boolean>(false);

  const formRef = useRef<HTMLFormElement>(null);

  // Available unique years in leadership records
  const availableYears = useMemo(() => {
    const years = Array.from(new Set(initialLeadership.map((l) => l.year))).sort().reverse();
    return years;
  }, [initialLeadership]);

  // Filtered leadership records
  const filteredLeaders = useMemo(() => {
    return initialLeadership.filter((leader) => {
      const matchesYear = selectedYear === 'all' || leader.year === selectedYear;
      if (!matchesYear) return false;

      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase().trim();
      const name = leader.name.toLowerCase();
      const handle = leader.handle?.toLowerCase() || '';
      const role = leader.role.toLowerCase();
      const dept = leader.department?.toLowerCase() || '';
      const hs = leader.highSchool?.toLowerCase() || '';
      const uni = leader.university?.toLowerCase() || '';
      const school = leader.schoolName?.toLowerCase() || '';

      return (
        name.includes(q) ||
        handle.includes(q) ||
        role.includes(q) ||
        dept.includes(q) ||
        hs.includes(q) ||
        uni.includes(q) ||
        school.includes(q)
      );
    });
  }, [initialLeadership, selectedYear, searchQuery]);

  // Filtered people for autocomplete dropdown
  const filteredPeople = useMemo(() => {
    if (!personSearch.trim()) return peopleList.slice(0, 15);
    const q = personSearch.toLowerCase().trim();
    return peopleList
      .filter((p) => {
        const name = p.fullName.toLowerCase();
        const handle = p.handle?.toLowerCase() || '';
        const hs = p.highSchool?.toLowerCase() || '';
        const uni = p.university?.toLowerCase() || '';
        return name.includes(q) || handle.includes(q) || hs.includes(q) || uni.includes(q);
      })
      .slice(0, 15);
  }, [peopleList, personSearch]);

  const schoolMap = useMemo(() => {
    return new Map(schoolsList.map((s) => [s.id, s.name]));
  }, [schoolsList]);

  // Form submission wrapper
  async function handleAddLeader(formData: FormData) {
    setFormError(null);
    setFormSuccess(false);

    if (creationMode === 'existing' && !selectedPerson) {
      setFormError('Please search and select an existing person profile first.');
      return;
    }

    const res = await createLeader(formData);
    if (res && !res.success) {
      setFormError(res.error || 'Failed to add officer.');
      return;
    }

    setFormSuccess(true);
    formRef.current?.reset();
    setSelectedPerson(null);
    setPersonSearch('');
    setTimeout(() => setFormSuccess(false), 4000);
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <Card className="border-l-4 border-l-accent hover:shadow-none duration-300">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-white uppercase tracking-wider">Leadership Manager</h1>
            <p className="text-foreground-secondary text-xs mt-1.5 leading-relaxed">
              Manage student officers, terms, seniorities, and normalized person profiles.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-surface-sunken border border-line rounded-lg text-xs font-bold text-foreground">
              {peopleList.length} Unique People
            </span>
            <span className="px-3 py-1 bg-surface-sunken border border-accent/30 text-accent rounded-lg text-xs font-bold">
              {initialLeadership.length} Active Terms
            </span>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Dual Officer Creation Workflow */}
        <Card className="lg:col-span-5 space-y-6">
          <div className="flex items-center justify-between border-b border-line/60 pb-4">
            <div>
              <h2 className="text-lg font-black text-white uppercase tracking-wider">Add Officer</h2>
              <p className="text-foreground-secondary text-xs mt-0.5">Register or assign an appointment.</p>
            </div>
            <div className="flex rounded-lg bg-surface-sunken p-1 border border-line/80">
              <button
                type="button"
                onClick={() => {
                  setCreationMode('existing');
                  setFormError(null);
                }}
                className={`px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                  creationMode === 'existing'
                    ? 'bg-accent text-on-accent shadow-sm'
                    : 'text-foreground-secondary hover:text-white'
                }`}
              >
                <HiCheck className="w-3.5 h-3.5" />
                Assign Existing
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreationMode('new');
                  setFormError(null);
                }}
                className={`px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                  creationMode === 'new'
                    ? 'bg-accent text-on-accent shadow-sm'
                    : 'text-foreground-secondary hover:text-white'
                }`}
              >
                <HiUserPlus className="w-3.5 h-3.5" />
                New Person
              </button>
            </div>
          </div>

          {formError && (
            <div role="alert" className="p-3 bg-red-950/30 border border-red-900/50 rounded-lg text-red-400 text-xs">
              {formError}
            </div>
          )}

          {formSuccess && (
            <div role="status" className="p-3 bg-green-950/30 border border-green-900/50 rounded-lg text-green-400 text-xs">
              Officer term added successfully!
            </div>
          )}

          <form ref={formRef} action={handleAddLeader} className="space-y-4">
            {/* Option A: Assign Existing Person */}
            {creationMode === 'existing' && (
              <div className="space-y-4">
                <input type="hidden" name="personId" value={selectedPerson?.id || ''} />

                {!selectedPerson ? (
                  <div className="relative">
                    <label className="block text-xs font-bold text-foreground-secondary uppercase tracking-wider mb-2">
                      Select Existing Person Profile <span className="text-accent">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search by name, handle, or school..."
                        value={personSearch}
                        onChange={(e) => {
                          setPersonSearch(e.target.value);
                          setShowPersonDropdown(true);
                        }}
                        onFocus={() => setShowPersonDropdown(true)}
                        className={inputClass}
                      />
                      <HiMagnifyingGlass className="absolute right-3 top-3 w-4 h-4 text-foreground-muted pointer-events-none" />
                    </div>

                    {showPersonDropdown && (
                      <div className="absolute z-20 mt-1 w-full bg-surface-raised border border-line rounded-xl shadow-2xl max-h-60 overflow-y-auto divide-y divide-line/60">
                        {filteredPeople.length === 0 ? (
                          <div className="p-4 text-xs text-foreground-muted text-center">
                            No profiles found matching &quot;{personSearch}&quot;. Switch to &quot;New Person&quot; above to create one.
                          </div>
                        ) : (
                          filteredPeople.map((p) => {
                            const pInitials = p.fullName
                              .split(' ')
                              .filter(Boolean)
                              .map((n) => n[0])
                              .slice(0, 2)
                              .join('')
                              .toUpperCase();

                            return (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => {
                                  setSelectedPerson(p);
                                  setShowPersonDropdown(false);
                                  setPersonSearch('');
                                }}
                                className="w-full text-left p-3 hover:bg-line/20 flex items-center gap-3 transition-colors cursor-pointer"
                              >
                                <div className="w-8 h-8 rounded-full bg-surface-sunken border border-line flex-shrink-0 flex items-center justify-center overflow-hidden">
                                  {p.avatarUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={p.avatarUrl} alt={p.fullName} className="w-full h-full object-cover" />
                                  ) : (
                                    <span className="text-[10px] font-black text-foreground-secondary">{pInitials}</span>
                                  )}
                                </div>
                                <div className="flex-grow min-w-0">
                                  <div className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                                    <span>{p.fullName}</span>
                                    {p.handle && <span className="text-foreground-muted font-normal">({p.handle})</span>}
                                  </div>
                                  <div className="text-[11px] text-foreground-secondary truncate">
                                    {p.university || p.highSchool || 'No school specified'}
                                  </div>
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-4 bg-surface-sunken/80 border border-accent/30 rounded-xl flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-surface-raised border border-line flex-shrink-0 flex items-center justify-center overflow-hidden">
                        {selectedPerson.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={selectedPerson.avatarUrl} alt={selectedPerson.fullName} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xs font-black text-foreground-secondary">
                            {selectedPerson.fullName
                              .split(' ')
                              .filter(Boolean)
                              .map((n: string) => n[0])
                              .slice(0, 2)
                              .join('')
                              .toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-black text-white truncate flex items-center gap-1.5">
                          <span>{selectedPerson.fullName}</span>
                          {selectedPerson.handle && (
                            <span className="text-foreground-muted font-normal">({selectedPerson.handle})</span>
                          )}
                        </div>
                        <div className="text-[11px] text-foreground-secondary truncate">
                          {selectedPerson.university || selectedPerson.highSchool || 'Profile loaded'}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedPerson(null)}
                      className="text-xs text-foreground-secondary hover:text-white px-2.5 py-1 bg-surface-raised border border-line rounded-md transition-all cursor-pointer shrink-0"
                    >
                      Change
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Option B: Create New Person */}
            {creationMode === 'new' && (
              <div className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-xs font-bold text-foreground-secondary uppercase tracking-wider mb-1">
                    Officer Full Name <span className="text-accent">*</span>
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    required
                    placeholder="e.g. Alice Williams"
                    className={inputClass}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="handle" className="block text-xs font-bold text-foreground-secondary uppercase tracking-wider mb-1">
                      Handle / IGN
                    </label>
                    <input
                      id="handle"
                      name="handle"
                      type="text"
                      placeholder="e.g. eddyson."
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="memberId" className="block text-xs font-bold text-foreground-secondary uppercase tracking-wider mb-1">
                      Associated Member
                    </label>
                    <select id="memberId" name="memberId" className={inputClass} defaultValue="">
                      <option value="">None</option>
                      {membersList.map((m) => {
                        const schoolName = schoolMap.get(m.schoolId) || 'Unknown School';
                        const gradSuffix = m.graduationYear ? ` '${m.graduationYear.toString().slice(-2)}` : '';
                        return (
                          <option key={m.id} value={m.id}>
                            {m.firstName} {m.lastName} ({schoolName}{gradSuffix})
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="highSchool" className="block text-xs font-bold text-foreground-secondary uppercase tracking-wider mb-1">
                      High School
                    </label>
                    <input
                      id="highSchool"
                      name="highSchool"
                      type="text"
                      placeholder="e.g. Stuyvesant High School"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="university" className="block text-xs font-bold text-foreground-secondary uppercase tracking-wider mb-1">
                      University
                    </label>
                    <input
                      id="university"
                      name="university"
                      type="text"
                      placeholder="e.g. Columbia University"
                      className={inputClass}
                    />
                  </div>
                </div>

                <div>
                  <ImageUpload
                    name="avatarUrl"
                    storageKeyName="storageKey"
                    label="Headshot Avatar Photo"
                  />
                </div>

                <div>
                  <label htmlFor="bio" className="block text-xs font-bold text-foreground-secondary uppercase tracking-wider mb-1">
                    Bio / About
                  </label>
                  <textarea
                    id="bio"
                    name="bio"
                    rows={2}
                    placeholder="Short bio..."
                    className={inputClass}
                  />
                </div>
              </div>
            )}

            {/* Common Term Fields */}
            <div className="pt-2 border-t border-line/60 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="role" className="block text-xs font-bold text-foreground-secondary uppercase tracking-wider mb-1">
                    Role Title <span className="text-accent">*</span>
                  </label>
                  <input
                    id="role"
                    name="role"
                    type="text"
                    required
                    placeholder="e.g. President, VALORANT Director"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="year" className="block text-xs font-bold text-foreground-secondary uppercase tracking-wider mb-1">
                    Academic Year <span className="text-accent">*</span>
                  </label>
                  <input
                    id="year"
                    name="year"
                    type="text"
                    required
                    pattern="[0-9]{4}"
                    title="Four-digit year, e.g. 2026"
                    placeholder="e.g. 2026"
                    defaultValue={new Date().getFullYear().toString()}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="department" className="block text-xs font-bold text-foreground-secondary uppercase tracking-wider mb-1">
                    Department (Optional)
                  </label>
                  <input
                    id="department"
                    name="department"
                    type="text"
                    placeholder="e.g. Executive, Broadcasting"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="displayOrder" className="block text-xs font-bold text-foreground-secondary uppercase tracking-wider mb-1">
                    Seniority Order (Optional)
                  </label>
                  <input
                    id="displayOrder"
                    name="displayOrder"
                    type="number"
                    min="0"
                    max="99"
                    placeholder="1=Exec, 2=Director, 3=Staff"
                    className={inputClass}
                  />
                </div>
              </div>
            </div>

            <SubmitButton
              label={creationMode === 'existing' ? 'Assign Officer Term' : 'Create Person & Term'}
              pendingLabel="Saving Officer…"
              className="w-full py-3 bg-white hover:bg-foreground text-surface-sunken text-xs font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed mt-4 shadow-lg shadow-black/20"
            />
          </form>
        </Card>

        {/* Right Column: Interactive Filter & Officers Table */}
        <div className="lg:col-span-7 space-y-4">
          {/* Controls Bar */}
          <div className="p-4 bg-surface-raised/40 border border-line/80 rounded-2xl space-y-4 shadow-xl shadow-black/20">
            {/* Search and stats */}
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
              <div className="relative w-full sm:max-w-xs">
                <input
                  type="text"
                  placeholder="Filter by name, role, school..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 bg-surface-sunken border border-line/80 rounded-xl text-xs text-white placeholder-foreground-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/30 transition-all"
                />
                <HiMagnifyingGlass className="absolute left-3 top-2.5 w-3.5 h-3.5 text-foreground-muted pointer-events-none" />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-2.5 text-foreground-muted hover:text-white cursor-pointer"
                  >
                    <HiXMark className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="text-xs text-foreground-secondary font-medium self-end sm:self-center">
                Showing <strong className="text-white font-bold">{filteredLeaders.length}</strong> of{' '}
                <strong className="text-foreground">{initialLeadership.length}</strong> terms
              </div>
            </div>

            {/* Year Selector Pills */}
            <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-line/40">
              <button
                type="button"
                onClick={() => setSelectedYear('all')}
                className={`px-3 py-1 rounded-lg text-xs font-bold tracking-wider transition-all cursor-pointer ${
                  selectedYear === 'all'
                    ? 'bg-accent text-on-accent shadow-sm shadow-accent/20'
                    : 'bg-surface-sunken text-foreground-secondary hover:text-white hover:bg-surface-raised border border-line/60'
                }`}
              >
                All Years
              </button>
              {availableYears.map((year) => (
                <button
                  key={year}
                  type="button"
                  onClick={() => setSelectedYear(year)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold tracking-wider transition-all cursor-pointer ${
                    selectedYear === year
                      ? 'bg-accent text-on-accent shadow-sm shadow-accent/20'
                      : 'bg-surface-sunken text-foreground-secondary hover:text-white hover:bg-surface-raised border border-line/60'
                  }`}
                >
                  {year}
                </button>
              ))}
            </div>
          </div>

          {/* Officers Table */}
          <div className="bg-surface-raised/30 border border-line/80 rounded-2xl overflow-hidden shadow-2xl shadow-black/30">
            {filteredLeaders.length === 0 ? (
              <div className="p-16 text-center text-foreground-muted text-sm bg-surface-sunken/20 rounded-2xl space-y-2">
                <HiSparkles className="w-8 h-8 text-foreground-muted mx-auto mb-2 opacity-50" />
                <p className="font-bold text-foreground">No leadership records found</p>
                <p className="text-xs text-foreground-secondary">
                  {searchQuery || selectedYear !== 'all'
                    ? 'Try adjusting your search or year filter.'
                    : 'Register student officers using the panel on the left.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-[#0b101d] border-b border-accent/20">
                    <tr className="text-foreground-secondary text-xs font-bold uppercase tracking-widest">
                      <th className="px-6 py-4">Officer Profile</th>
                      <th className="px-6 py-4">Role & Dept</th>
                      <th className="px-6 py-4">Seniority</th>
                      <th className="px-6 py-4">Year</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line text-sm">
                    {filteredLeaders.map((leader) => (
                      <LeadershipRow
                        key={leader.termId || leader.id}
                        leader={leader}
                        members={membersList}
                        schools={schoolsList}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

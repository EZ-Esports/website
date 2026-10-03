'use client';

import { useState, useMemo, useRef } from 'react';
import LeadershipRow, { LeaderRowItem } from '@/app/components/admin/LeadershipRow';
import {
  AdminCount,
  AdminEmptyState,
  AdminField,
  AdminNotice,
  AdminSearchField,
  AdminSection,
  RequiredMark,
} from '@/app/components/admin/AdminUI';
import { AdminSegmented } from '@/app/components/admin/AdminTabs';
import {
  focusRing,
  input,
  label as labelClass,
  secondaryBtnSm,
  table,
  tbody,
  th,
  theadRow,
  thRight,
} from '@/app/components/admin/styles';
import { cx } from '@/app/lib/cx';
import ImageUpload from '@/app/components/admin/ImageUpload';
import SubmitButton from '@/app/components/admin/SubmitButton';
import { createLeader } from '@/app/(admin)/admin/leadership/actions';
import { HiUserPlus, HiCheck, HiSparkles } from 'react-icons/hi2';

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
}

export default function LeadershipManagerClient({
  initialLeadership,
  peopleList,
}: LeadershipManagerClientProps) {
  // Available unique years sorted in DESCENDING order (latest first)
  const availableYears = useMemo(() => {
    return Array.from(new Set(initialLeadership.map((l) => l.year))).sort((a, b) =>
      b.localeCompare(a, undefined, { numeric: true })
    );
  }, [initialLeadership]);

  // Default filter: always latest year
  const [selectedYear, setSelectedYear] = useState<string>(() => availableYears[0] || new Date().getFullYear().toString());
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Creation Mode State: 'existing' vs 'new'
  const [creationMode, setCreationMode] = useState<'existing' | 'new'>('existing');
  const [selectedPerson, setSelectedPerson] = useState<PersonItem | null>(null);
  const [personSearch, setPersonSearch] = useState<string>('');
  const [showPersonDropdown, setShowPersonDropdown] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<boolean>(false);

  const formRef = useRef<HTMLFormElement>(null);

  // Filtered leadership records for selected year and search query
  const filteredLeaders = useMemo(() => {
    return initialLeadership.filter((leader) => {
      const matchesYear = leader.year === selectedYear;
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

  const initialsOf = (fullName: string) =>
    fullName
      .split(' ')
      .filter(Boolean)
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

  return (
    <div className="grid w-full min-w-0 grid-cols-1 items-start gap-6 lg:grid-cols-12">
      {/* Left Column: Dual Officer Creation Workflow */}
      <AdminSection
        className="w-full min-w-0 lg:col-span-5"
        title="Add officer"
        description="Register or assign an appointment."
        actions={
          <AdminSegmented
            aria-label="Officer source"
            value={creationMode}
            onChange={(mode) => {
              setCreationMode(mode);
              setFormError(null);
            }}
            options={[
              { value: 'existing', label: 'Assign existing', icon: <HiCheck aria-hidden className="h-3.5 w-3.5" /> },
              { value: 'new', label: 'New person', icon: <HiUserPlus aria-hidden className="h-3.5 w-3.5" /> },
            ]}
          />
        }
      >
        <div className="space-y-4">
          {formError && <AdminNotice tone="danger">{formError}</AdminNotice>}

          {formSuccess && <AdminNotice tone="success">Officer term added successfully!</AdminNotice>}

          <form ref={formRef} action={handleAddLeader} className="space-y-4">
            {/* Option A: Assign Existing Person */}
            {creationMode === 'existing' && (
              <div key="existing" className="admin-fade-in space-y-3">
                <input type="hidden" name="personId" value={selectedPerson?.id || ''} />

                {!selectedPerson ? (
                  <div className="relative">
                    <label htmlFor="person-search" className={labelClass}>
                      Select person profile <RequiredMark />
                    </label>
                    <AdminSearchField
                      id="person-search"
                      aria-label="Select person profile"
                      placeholder="Search by name, handle, or school…"
                      value={personSearch}
                      onChange={(e) => {
                        setPersonSearch(e.target.value);
                        setShowPersonDropdown(true);
                      }}
                      onFocus={() => setShowPersonDropdown(true)}
                    />

                    {showPersonDropdown && (
                      <div className="admin-fade-in absolute z-20 mt-1.5 max-h-64 w-full divide-y divide-line/50 overflow-y-auto rounded-xl bg-surface-raised p-1 shadow-2xl shadow-black/60 ring-1 ring-line/70">
                        {filteredPeople.length === 0 ? (
                          <div className="p-3 text-center text-sm text-foreground-secondary">
                            No profiles found matching &quot;{personSearch}&quot;. Switch to &quot;New person&quot; above to create one.
                          </div>
                        ) : (
                          filteredPeople.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                setSelectedPerson(p);
                                setShowPersonDropdown(false);
                                setPersonSearch('');
                              }}
                              className={cx('flex w-full cursor-pointer items-center gap-2.5 rounded-lg p-2.5 text-left transition-colors duration-150 hover:bg-line/60', focusRing)}
                            >
                              <Avatar src={p.avatarUrl} name={p.fullName} initials={initialsOf(p.fullName)} size="sm" />
                              <div className="min-w-0 flex-grow">
                                <div className="flex items-center gap-1 truncate text-sm font-medium text-foreground">
                                  <span>{p.fullName}</span>
                                  {p.handle && <span className="font-normal text-foreground-secondary">({p.handle})</span>}
                                </div>
                                <div className="truncate text-xs text-foreground-secondary">
                                  {p.university || p.highSchool || 'No school specified'}
                                </div>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="admin-fade-in flex items-center justify-between gap-3 rounded-xl bg-surface-sunken p-3 ring-1 ring-accent/30">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Avatar src={selectedPerson.avatarUrl} name={selectedPerson.fullName} initials={initialsOf(selectedPerson.fullName)} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1 truncate text-sm font-medium text-foreground">
                          <span>{selectedPerson.fullName}</span>
                          {selectedPerson.handle && (
                            <span className="font-normal text-foreground-secondary">({selectedPerson.handle})</span>
                          )}
                        </div>
                        <div className="truncate text-xs text-foreground-secondary">
                          {selectedPerson.university || selectedPerson.highSchool || 'Profile loaded'}
                        </div>
                      </div>
                    </div>
                    <button type="button" onClick={() => setSelectedPerson(null)} className={secondaryBtnSm}>
                      Change
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Option B: Create New Person */}
            {creationMode === 'new' && (
              <div key="new" className="admin-fade-in space-y-4">
                <AdminField label="Officer full name" htmlFor="name" required>
                  <input id="name" name="name" type="text" required placeholder="e.g. Alice Williams" className={input} />
                </AdminField>

                <AdminField label="Handle / IGN" htmlFor="handle">
                  <input id="handle" name="handle" type="text" placeholder="e.g. eddyson." className={input} />
                </AdminField>

                <div className="grid grid-cols-2 gap-3">
                  <AdminField label="High school" htmlFor="highSchool">
                    <input id="highSchool" name="highSchool" type="text" placeholder="e.g. Stuyvesant HS" className={input} />
                  </AdminField>
                  <AdminField label="University" htmlFor="university">
                    <input id="university" name="university" type="text" placeholder="e.g. Columbia" className={input} />
                  </AdminField>
                </div>

                <ImageUpload
                  section="leadership"
                  entityIdName="personId"
                  name="avatarUrl"
                  storageKeyName="storageKey"
                  label="Headshot photo"
                />

                <AdminField label="Bio / fun fact" htmlFor="bio">
                  <textarea id="bio" name="bio" rows={2} placeholder="Short bio…" className={input} />
                </AdminField>
              </div>
            )}

            {/* Common Term Fields */}
            <div className="space-y-4 border-t border-line/60 pt-4">
              <div className="grid grid-cols-2 gap-3">
                <AdminField label="Role title" htmlFor="role" required>
                  <input id="role" name="role" type="text" required placeholder="e.g. President, CTO" className={input} />
                </AdminField>
                <AdminField label="Academic year" htmlFor="year" required>
                  <input
                    id="year"
                    name="year"
                    type="text"
                    required
                    pattern="[0-9]{4}"
                    title="Four-digit year, e.g. 2026"
                    placeholder="e.g. 2026"
                    defaultValue={selectedYear || new Date().getFullYear().toString()}
                    className={input}
                  />
                </AdminField>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <AdminField label="Department (optional)" htmlFor="department">
                  <input id="department" name="department" type="text" placeholder="e.g. Executive, Marketing" className={input} />
                </AdminField>
                <AdminField label="Seniority order" htmlFor="displayOrder">
                  <select id="displayOrder" name="displayOrder" defaultValue="3" className={input}>
                    <option value="1">1 - Executive (President, CTO, Founders)</option>
                    <option value="2">2 - Director / Lead (Dept & Game Leads)</option>
                    <option value="3">3 - Associate / Staff (Associates, Coordinators)</option>
                    <option value="4">4 - Advisor / Special Thanks</option>
                    <option value="0">0 - Other / Unspecified</option>
                  </select>
                </AdminField>
              </div>
            </div>

            <SubmitButton
              label={creationMode === 'existing' ? 'Assign officer term' : 'Create person & term'}
              pendingLabel="Saving officer…"
              className="w-full"
            />
          </form>
        </div>
      </AdminSection>

      {/* Right Column: Year filter, search and the officers table */}
      <AdminSection
        variant="flush"
        stickyToolbar
        className="w-full min-w-0 lg:col-span-7"
        title={
          <>
            Officers in {selectedYear}
            <AdminCount>{filteredLeaders.length}</AdminCount>
          </>
        }
        toolbar={
          <div className="space-y-3">
            <AdminSearchField
              className="w-full sm:max-w-xs"
              aria-label="Search officers in this year"
              placeholder="Search in this year…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClear={() => setSearchQuery('')}
            />

            {availableYears.length > 0 && (
              <AdminSegmented
                aria-label="Academic year"
                className="flex-wrap"
                value={selectedYear}
                onChange={setSelectedYear}
                options={availableYears.map((year) => ({ value: year, label: year }))}
              />
            )}
          </div>
        }
      >
        {filteredLeaders.length === 0 ? (
          <AdminEmptyState
            compact
            icon={<HiSparkles />}
            title={`No officers found for ${selectedYear}`}
            description={
              searchQuery
                ? 'Try adjusting your search query.'
                : `Add officers for ${selectedYear} using the panel on the left.`
            }
          />
        ) : (
          <div className="w-full overflow-hidden">
            <table className={cx(table, 'table-fixed')}>
              <thead>
                <tr className={theadRow}>
                  <th className={cx(th, 'w-[38%]')}>Officer profile</th>
                  <th className={cx(th, 'w-[26%]')}>Role &amp; dept</th>
                  <th className={cx(th, 'w-[18%]')}>Seniority</th>
                  <th className={cx(thRight, 'w-[18%]')}>Actions</th>
                </tr>
              </thead>
              <tbody className={tbody}>
                {filteredLeaders.map((leader) => (
                  <LeadershipRow key={leader.termId || leader.id} leader={leader} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminSection>
    </div>
  );
}

/** Round headshot with an initials fallback. */
function Avatar({ src, name, initials, size = 'md' }: { src: string | null; name: string; initials: string; size?: 'sm' | 'md' }) {
  return (
    <div
      className={cx(
        'flex flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-raised',
        size === 'sm' ? 'h-7 w-7' : 'h-9 w-9',
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} className="h-full w-full object-cover" />
      ) : (
        <span className="text-[11px] font-semibold text-foreground-secondary">{initials}</span>
      )}
    </div>
  );
}

'use client';

import { useState, useMemo } from 'react';
import { AdminCount, AdminEmptyState, AdminPage, AdminPageHeader, AdminSearchField, AdminSection } from '@/app/components/admin/AdminUI';
import { chip, iconBtn, secondaryBtn, secondaryBtnSm, selectClass, table, tableWrap, tbody, td, tdRight, th, theadRow, thRight, tr } from '@/app/components/admin/styles';
import { cx } from '@/app/lib/cx';
import { Overlay, Modal, Dialog, Heading } from '@/app/components/ui/overlay';
import {
  HiOutlineUserGroup,
  HiOutlineShieldCheck,
  HiOutlineAcademicCap,
  HiOutlineDocumentArrowDown,
  HiOutlineInformationCircle,
  HiOutlineXMark,
  HiOutlineCheckCircle,
} from 'react-icons/hi2';

export interface DemographicRecord {
  id: string;
  memberId: string;
  legalFirstName: string;
  legalLastName: string;
  birthDate: string;
  gender: string | null;
  race: string[] | null;
  ethnicity: string[] | null;
  countryOfBirth: string | null;
  parentsCountryOfBirth: string | null;
  primaryLanguageAtHome: string | null;
  isFreeOrReducedLunch: boolean | null;
  isFirstGenCollege: boolean | null;
  doePetitionConsent: boolean;
  surveyDetails: {
    ping?: string;
    hoursPerWeek?: string;
    internetReliability?: string;
    careerInterests?: string[];
    feedback?: string;
    codeOfConductAccepted?: boolean;
  } | null;
  createdAt: string;
  memberFirstName: string | null;
  memberLastName: string | null;
  memberEmail: string | null;
  memberDiscord: string | null;
  graduationYear: number | null;
  schoolId: string | null;
  schoolName: string | null;
}

interface DemographicsExplorerProps {
  records: DemographicRecord[];
  schools: Array<{ id: string; name: string }>;
}

export default function DemographicsExplorer({ records, schools }: DemographicsExplorerProps) {
  const [search, setSearch] = useState('');
  const [selectedSchool, setSelectedSchool] = useState('all');
  const [selectedTitleI, setSelectedTitleI] = useState<'all' | 'yes' | 'no'>('all');
  const [selectedFirstGen, setSelectedFirstGen] = useState<'all' | 'yes' | 'no'>('all');
  const [activeSurveyRecord, setActiveSurveyRecord] = useState<DemographicRecord | null>(null);

  // Filtered records
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      if (selectedSchool !== 'all' && r.schoolId !== selectedSchool) return false;
      if (selectedTitleI === 'yes' && r.isFreeOrReducedLunch !== true) return false;
      if (selectedTitleI === 'no' && r.isFreeOrReducedLunch === true) return false;
      if (selectedFirstGen === 'yes' && r.isFirstGenCollege !== true) return false;
      if (selectedFirstGen === 'no' && r.isFirstGenCollege === true) return false;

      if (!search.trim()) return true;
      const q = search.toLowerCase();
      const legalName = `${r.legalFirstName} ${r.legalLastName}`.toLowerCase();
      const preferredName = `${r.memberFirstName ?? ''} ${r.memberLastName ?? ''}`.toLowerCase();
      const email = (r.memberEmail ?? '').toLowerCase();
      const discord = (r.memberDiscord ?? '').toLowerCase();
      const school = (r.schoolName ?? '').toLowerCase();

      return (
        legalName.includes(q) ||
        preferredName.includes(q) ||
        email.includes(q) ||
        discord.includes(q) ||
        school.includes(q)
      );
    });
  }, [records, search, selectedSchool, selectedTitleI, selectedFirstGen]);

  // Summary Metrics
  const stats = useMemo(() => {
    const total = records.length;
    const titleICount = records.filter((r) => r.isFreeOrReducedLunch === true).length;
    const firstGenCount = records.filter((r) => r.isFirstGenCollege === true).length;
    const doeConsentCount = records.filter((r) => r.doePetitionConsent === true).length;

    return {
      total,
      titleICount,
      titleIPct: total > 0 ? Math.round((titleICount / total) * 100) : 0,
      firstGenCount,
      firstGenPct: total > 0 ? Math.round((firstGenCount / total) * 100) : 0,
      doeConsentCount,
      doeConsentPct: total > 0 ? Math.round((doeConsentCount / total) * 100) : 0,
    };
  }, [records]);

  // Export CSV handler
  const handleExportCsv = () => {
    const headers = [
      'Legal Name',
      'Preferred Name',
      'Email',
      'Discord',
      'School',
      'Graduation Year',
      'Birth Date',
      'Gender',
      'Race / Ethnicity',
      'Country of Birth',
      'Primary Language',
      'Free or Reduced Lunch (Title I)',
      'First Gen College',
      'DOE Petition Consent',
      'Gaming Ping',
      'Weekly Hours',
      'Internet Reliability',
      'Career Interests',
      'Feedback',
      'Submitted At',
    ];

    const rows = filteredRecords.map((r) => [
      `"${r.legalLastName}, ${r.legalFirstName}"`,
      `"${r.memberLastName ?? ''}, ${r.memberFirstName ?? ''}"`,
      `"${r.memberEmail ?? ''}"`,
      `"${r.memberDiscord ?? ''}"`,
      `"${r.schoolName ?? 'Unassigned'}"`,
      r.graduationYear ?? '',
      r.birthDate ? r.birthDate.split('T')[0] : '',
      `"${r.gender ?? ''}"`,
      `"${[...(r.race ?? []), ...(r.ethnicity ?? [])].join('; ')}"`,
      `"${r.countryOfBirth ?? ''}"`,
      `"${r.primaryLanguageAtHome ?? ''}"`,
      r.isFreeOrReducedLunch === true ? 'Yes' : r.isFreeOrReducedLunch === false ? 'No' : 'Unspecified',
      r.isFirstGenCollege === true ? 'Yes' : r.isFirstGenCollege === false ? 'No' : 'Unspecified',
      r.doePetitionConsent ? 'Yes' : 'No',
      `"${r.surveyDetails?.ping ?? ''}"`,
      `"${r.surveyDetails?.hoursPerWeek ?? ''}"`,
      `"${r.surveyDetails?.internetReliability ?? ''}"`,
      `"${(r.surveyDetails?.careerInterests ?? []).join('; ')}"`,
      `"${(r.surveyDetails?.feedback ?? '').replace(/"/g, '""')}"`,
      r.createdAt ? r.createdAt.split('T')[0] : '',
    ]);

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `student-demographics-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const kpis = [
    { label: 'Total submissions', value: stats.total, pct: null, help: 'Verified student profiles', icon: <HiOutlineUserGroup />, tone: 'bg-accent/15 text-accent' },
    { label: 'Title I (free/reduced lunch)', value: stats.titleICount, pct: stats.titleIPct, help: 'Eligible for Title I grant reporting', icon: <HiOutlineShieldCheck />, tone: 'bg-success/15 text-success' },
    { label: 'First-gen college', value: stats.firstGenCount, pct: stats.firstGenPct, help: 'First in family to attend college', icon: <HiOutlineAcademicCap />, tone: 'bg-violet-400/15 text-violet-300' },
    { label: 'DOE petition consent', value: stats.doeConsentCount, pct: stats.doeConsentPct, help: 'Consented for official recognition', icon: <HiOutlineCheckCircle />, tone: 'bg-sky-400/15 text-sky-300' },
  ];

  return (
    <AdminPage>
      <AdminPageHeader
        route="/admin/demographics"
        description={
          <>
            Strictly isolated minor demographic PII. Accessible only to actors with{' '}
            <code className="rounded bg-surface-sunken px-1 py-0.5 font-mono text-[0.8125rem] text-accent">VIEW_STUDENT_DEMOGRAPHICS</code> or Owner
            privileges. School managers and general staff cannot see or query these records.
          </>
        }
        meta={
          <>
            <span className={chip('danger')}>Superadmin restricted</span>
            <span className={chip('success')}>FERPA / Title I vault</span>
          </>
        }
        actions={
          <button type="button" onClick={handleExportCsv} disabled={filteredRecords.length === 0} className={secondaryBtn}>
            <HiOutlineDocumentArrowDown aria-hidden className="h-4 w-4 text-accent" />
            Export CSV <span className="tabular-nums text-foreground-secondary">({filteredRecords.length})</span>
          </button>
        }
      />

      {/* Summary KPI Cards */}
      <section aria-label="Summary" className="admin-stagger grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-2xl bg-admin-panel p-5">
            <div className="flex items-center justify-between gap-2 text-sm font-medium text-foreground-secondary">
              <span>{k.label}</span>
              <span aria-hidden className={cx('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg [&>svg]:h-4 [&>svg]:w-4', k.tone)}>{k.icon}</span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-semibold tabular-nums tracking-tight text-foreground">{k.value}</span>
              {k.pct !== null && <span className="text-sm font-medium tabular-nums text-foreground-secondary">({k.pct}%)</span>}
            </div>
            <p className="mt-1 text-xs text-foreground-secondary">{k.help}</p>
          </div>
        ))}
      </section>

      <AdminSection
        variant="flush"
        stickyToolbar
        title={<>Student records<AdminCount>{filteredRecords.length}</AdminCount></>}
        toolbar={
          <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
            <AdminSearchField
              size="sm"
              aria-label="Search student, email, school"
              placeholder="Search student, email, school…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClear={() => setSearch('')}
            />
            <select aria-label="School" value={selectedSchool} onChange={(e) => setSelectedSchool(e.target.value)} className={cx(selectClass, 'w-full')}>
              <option value="all">All Schools</option>
              {schools.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <select aria-label="Title I status" value={selectedTitleI} onChange={(e) => setSelectedTitleI(e.target.value as any)} className={cx(selectClass, 'w-full')}>
              <option value="all">Title I: All Students</option>
              <option value="yes">Title I: Eligible (Free/Reduced Lunch)</option>
              <option value="no">Title I: Standard / Ineligible</option>
            </select>
            <select aria-label="First-gen college status" value={selectedFirstGen} onChange={(e) => setSelectedFirstGen(e.target.value as any)} className={cx(selectClass, 'w-full')}>
              <option value="all">First-Gen: All Students</option>
              <option value="yes">First-Gen College: Yes</option>
              <option value="no">First-Gen College: No</option>
            </select>
          </div>
        }
      >
        {filteredRecords.length === 0 ? (
          <AdminEmptyState
            icon={<HiOutlineUserGroup />}
            title="No demographic records found"
            description={
              records.length === 0
                ? 'No students have submitted the onboarding demographic survey yet.'
                : 'No records match the current filter criteria.'
            }
          />
        ) : (
          <div className={tableWrap}>
            <table className={table}>
              <thead>
                <tr className={theadRow}>
                  <th className={th}>Student name</th>
                  <th className={th}>School / class</th>
                  <th className={th}>Birthdate / gender</th>
                  <th className={th}>Race &amp; ethnicity</th>
                  <th className={th}>Equity status</th>
                  <th className={th}>Language / origin</th>
                  <th className={thRight}>Details</th>
                </tr>
              </thead>
              <tbody className={tbody}>
                {filteredRecords.map((r) => {
                  const birthDateObj = r.birthDate ? new Date(r.birthDate) : null;
                  const birthFormatted = birthDateObj ? birthDateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
                  const allRaces = [...(r.race ?? []), ...(r.ethnicity ?? [])];

                  return (
                    <tr key={r.id} className={tr}>
                      {/* Name & Preferred Name */}
                      <td className={td}>
                        <div className="font-medium text-foreground">
                          {r.legalFirstName} {r.legalLastName}
                        </div>
                        {(r.memberFirstName || r.memberLastName) && (
                          <div className="mt-0.5 text-xs text-foreground-secondary">
                            Pref: {r.memberFirstName} {r.memberLastName}
                          </div>
                        )}
                        {r.memberEmail && <div className="max-w-[180px] truncate text-xs text-foreground-secondary">{r.memberEmail}</div>}
                      </td>

                      {/* School & Grad Year */}
                      <td className={td}>
                        <div className="text-foreground">{r.schoolName || <span className="text-foreground-secondary">Unassigned</span>}</div>
                        <div className="text-xs text-foreground-secondary">{r.graduationYear ? `Class of ${r.graduationYear}` : 'No class year'}</div>
                      </td>

                      {/* DOB / Gender */}
                      <td className={td}>
                        <div className="text-foreground">{birthFormatted}</div>
                        <div className="text-xs capitalize text-foreground-secondary">{r.gender || 'Not specified'}</div>
                      </td>

                      {/* Race & Ethnicity */}
                      <td className={cx(td, 'max-w-[200px]')}>
                        {allRaces.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {allRaces.map((tag, idx) => (
                              <span key={idx} className={cx(chip('neutral', 'sm'), 'truncate')}>
                                {tag}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-foreground-secondary">—</span>
                        )}
                      </td>

                      {/* Equity Badges */}
                      <td className={td}>
                        <div className="flex flex-col items-start gap-1">
                          {r.isFreeOrReducedLunch === true ? (
                            <span className={chip('success', 'sm')}>Title I eligible</span>
                          ) : (
                            <span className={chip('neutral', 'sm')}>Standard</span>
                          )}
                          {r.isFirstGenCollege === true && <span className={chip('violet', 'sm')}>First-gen college</span>}
                          {r.doePetitionConsent && <span className={chip('info', 'sm')}>DOE consent</span>}
                        </div>
                      </td>

                      {/* Language & Country */}
                      <td className={td}>
                        <div className="capitalize text-foreground">{r.primaryLanguageAtHome || 'English'}</div>
                        <div className="text-xs text-foreground-secondary">Born: {r.countryOfBirth || 'USA'}</div>
                      </td>

                      {/* Survey View Button */}
                      <td className={tdRight}>
                        <button type="button" onClick={() => setActiveSurveyRecord(r)} className={secondaryBtnSm}>
                          <HiOutlineInformationCircle aria-hidden className="h-3.5 w-3.5 text-accent" />
                          Survey
                          <span className="sr-only"> for {r.legalFirstName} {r.legalLastName}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </AdminSection>

      {/* Survey Details Modal */}
      {activeSurveyRecord && (
        <Overlay
          isOpen={Boolean(activeSurveyRecord)}
          onOpenChange={() => setActiveSurveyRecord(null)}
          className="admin-modal-overlay fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-4"
        >
          <Modal className="admin-modal my-8 w-full max-w-xl overflow-hidden rounded-2xl bg-surface-raised text-left shadow-2xl shadow-black/60 ring-1 ring-line/70 outline-none">
            <Dialog className="flex max-h-[85vh] flex-col outline-none">
              {/* Modal Header */}
              <div className="flex items-start justify-between gap-4 border-b border-line/60 px-6 py-5">
                <div className="flex items-center gap-3">
                  <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
                    <HiOutlineInformationCircle className="h-5 w-5" />
                  </span>
                  <div>
                    <Heading className="text-lg font-semibold text-foreground">
                      {activeSurveyRecord.legalFirstName} {activeSurveyRecord.legalLastName}
                    </Heading>
                    <p className="text-sm text-foreground-secondary">Full survey and demographics responses</p>
                  </div>
                </div>
                <button type="button" onClick={() => setActiveSurveyRecord(null)} className={cx(iconBtn, '-mr-2 -mt-1')} aria-label="Close survey dialog">
                  <HiOutlineXMark aria-hidden className="h-5 w-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 space-y-6 overflow-y-auto p-6 text-sm">
                <SurveyGroup title="Gaming environment & connectivity">
                  <div className="grid grid-cols-3 gap-3">
                    <SurveyFact label="Reported ping" value={activeSurveyRecord.surveyDetails?.ping || 'Not reported'} />
                    <SurveyFact label="Hours / week" value={activeSurveyRecord.surveyDetails?.hoursPerWeek || 'Not reported'} />
                    <SurveyFact label="Internet quality" value={activeSurveyRecord.surveyDetails?.internetReliability || 'Not reported'} />
                  </div>
                </SurveyGroup>

                <SurveyGroup title="Career & academic interests">
                  {activeSurveyRecord.surveyDetails?.careerInterests && activeSurveyRecord.surveyDetails.careerInterests.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {activeSurveyRecord.surveyDetails.careerInterests.map((interest, idx) => (
                        <span key={idx} className={chip('neutral')}>
                          {interest}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-foreground-secondary">No career interests specified.</p>
                  )}
                </SurveyGroup>

                <SurveyGroup title="Family & demographic background">
                  <div className="grid grid-cols-2 gap-3">
                    <SurveyFact label="Parent birthplace" value={activeSurveyRecord.parentsCountryOfBirth || 'Not specified'} />
                    <SurveyFact label="Home language" value={activeSurveyRecord.primaryLanguageAtHome || 'English'} />
                  </div>
                </SurveyGroup>

                {activeSurveyRecord.surveyDetails?.feedback && (
                  <SurveyGroup title="Student feedback & goals">
                    <p className="rounded-xl bg-surface-sunken/70 p-3 leading-relaxed text-foreground">
                      &quot;{activeSurveyRecord.surveyDetails.feedback}&quot;
                    </p>
                  </SurveyGroup>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex justify-end border-t border-line/60 px-6 py-4">
                <button type="button" onClick={() => setActiveSurveyRecord(null)} className={secondaryBtn}>
                  Close
                </button>
              </div>
            </Dialog>
          </Modal>
        </Overlay>
      )}
    </AdminPage>
  );
}

function SurveyGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 border-t border-line/60 pt-5 first:border-t-0 first:pt-0">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {children}
    </section>
  );
}

function SurveyFact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-surface-sunken/70 p-3">
      <span className="text-xs font-medium text-foreground-secondary">{label}</span>
      <div className="mt-1 text-sm font-medium text-foreground">{value}</div>
    </div>
  );
}

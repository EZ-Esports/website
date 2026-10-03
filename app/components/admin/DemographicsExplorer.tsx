'use client';

import { useState, useMemo } from 'react';
import Card from '@/app/components/ui/Card';
import { Overlay, Modal, Dialog, Heading } from '@/app/components/ui/overlay';
import {
  HiOutlineUserGroup,
  HiOutlineShieldCheck,
  HiOutlineAcademicCap,
  HiOutlineDocumentArrowDown,
  HiOutlineMagnifyingGlass,
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

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-surface-raised/40 border border-line border-l-4 border-l-accent rounded-2xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded bg-red-950/60 text-red-400 border border-red-800/50">
              Superadmin Restricted
            </span>
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/50">
              FERPA / Title I Vault
            </span>
          </div>
          <h1 className="text-xl font-black text-white uppercase tracking-wider mt-2">
            Student Demographics & Equity Vault
          </h1>
          <p className="text-xs text-foreground-secondary max-w-2xl mt-1 leading-relaxed">
            Strictly isolated minor demographic PII. Accessible only to actors with{' '}
            <code className="text-accent text-[11px]">VIEW_STUDENT_DEMOGRAPHICS</code> or Owner privileges. School managers
            and general staff cannot see or query these records.
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportCsv}
          disabled={filteredRecords.length === 0}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-surface-raised hover:bg-line border border-line text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
        >
          <HiOutlineDocumentArrowDown className="w-4 h-4 text-accent" />
          <span>Export CSV ({filteredRecords.length})</span>
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-surface-raised/30 border border-line p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-foreground-secondary uppercase tracking-wider">
              Total Submissions
            </span>
            <div className="w-8 h-8 rounded-lg bg-accent/15 text-accent flex items-center justify-center">
              <HiOutlineUserGroup className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-white mt-3">{stats.total}</div>
          <p className="text-[11px] text-foreground-muted mt-1">Verified student profiles</p>
        </Card>

        <Card className="bg-surface-raised/30 border border-line p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-foreground-secondary uppercase tracking-wider">
              Title I (Free/Reduced Lunch)
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
              <HiOutlineShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-3">
            <span className="text-2xl font-black text-white">{stats.titleICount}</span>
            <span className="text-xs font-bold text-emerald-400">({stats.titleIPct}%)</span>
          </div>
          <p className="text-[11px] text-foreground-muted mt-1">Eligible for Title I grant reporting</p>
        </Card>

        <Card className="bg-surface-raised/30 border border-line p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-foreground-secondary uppercase tracking-wider">
              First-Gen College
            </span>
            <div className="w-8 h-8 rounded-lg bg-purple-500/15 text-purple-400 flex items-center justify-center">
              <HiOutlineAcademicCap className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-3">
            <span className="text-2xl font-black text-white">{stats.firstGenCount}</span>
            <span className="text-xs font-bold text-purple-400">({stats.firstGenPct}%)</span>
          </div>
          <p className="text-[11px] text-foreground-muted mt-1">First in family to attend college</p>
        </Card>

        <Card className="bg-surface-raised/30 border border-line p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-foreground-secondary uppercase tracking-wider">
              DOE Petition Consent
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/15 text-blue-400 flex items-center justify-center">
              <HiOutlineCheckCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-3">
            <span className="text-2xl font-black text-white">{stats.doeConsentCount}</span>
            <span className="text-xs font-bold text-blue-400">({stats.doeConsentPct}%)</span>
          </div>
          <p className="text-[11px] text-foreground-muted mt-1">Consented for official recognition</p>
        </Card>
      </div>

      {/* Controls & Filter Bar */}
      <Card className="bg-surface-raised/20 border border-line p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Search Input */}
          <div className="relative md:col-span-1">
            <HiOutlineMagnifyingGlass className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search student, email, school…"
              className="w-full pl-9 pr-3 py-2 bg-surface-sunken border border-line rounded-xl text-xs text-white placeholder-foreground-muted focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent/60 transition-all"
            />
          </div>

          {/* School Select */}
          <div>
            <select
              value={selectedSchool}
              onChange={(e) => setSelectedSchool(e.target.value)}
              className="w-full px-3 py-2 bg-surface-sunken border border-line rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent/60 transition-all"
            >
              <option value="all">All Schools</option>
              {schools.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Title I Status */}
          <div>
            <select
              value={selectedTitleI}
              onChange={(e) => setSelectedTitleI(e.target.value as any)}
              className="w-full px-3 py-2 bg-surface-sunken border border-line rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent/60 transition-all"
            >
              <option value="all">Title I: All Students</option>
              <option value="yes">Title I: Eligible (Free/Reduced Lunch)</option>
              <option value="no">Title I: Standard / Ineligible</option>
            </select>
          </div>

          {/* First Gen Status */}
          <div>
            <select
              value={selectedFirstGen}
              onChange={(e) => setSelectedFirstGen(e.target.value as any)}
              className="w-full px-3 py-2 bg-surface-sunken border border-line rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent/60 transition-all"
            >
              <option value="all">First-Gen: All Students</option>
              <option value="yes">First-Gen College: Yes</option>
              <option value="no">First-Gen College: No</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Main Records Table */}
      <Card className="bg-surface-raised/30 border border-line overflow-hidden">
        {filteredRecords.length === 0 ? (
          <div className="py-16 text-center">
            <HiOutlineUserGroup className="w-12 h-12 text-foreground-muted mx-auto mb-3 opacity-40" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">No Demographic Records Found</h3>
            <p className="text-xs text-foreground-muted mt-1 max-w-sm mx-auto">
              {records.length === 0
                ? 'No students have submitted the onboarding demographic survey yet.'
                : 'No records match the current filter criteria.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-line bg-surface-sunken/40">
                  <th className="py-3 px-4 font-bold text-foreground-secondary uppercase tracking-wider">Student Name</th>
                  <th className="py-3 px-4 font-bold text-foreground-secondary uppercase tracking-wider">School / Class</th>
                  <th className="py-3 px-4 font-bold text-foreground-secondary uppercase tracking-wider">Birthdate / Gender</th>
                  <th className="py-3 px-4 font-bold text-foreground-secondary uppercase tracking-wider">Race & Ethnicity</th>
                  <th className="py-3 px-4 font-bold text-foreground-secondary uppercase tracking-wider">Equity Status</th>
                  <th className="py-3 px-4 font-bold text-foreground-secondary uppercase tracking-wider">Language / Origin</th>
                  <th className="py-3 px-4 font-bold text-foreground-secondary uppercase tracking-wider text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {filteredRecords.map((r) => {
                  const birthDateObj = r.birthDate ? new Date(r.birthDate) : null;
                  const birthFormatted = birthDateObj ? birthDateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
                  const allRaces = [...(r.race ?? []), ...(r.ethnicity ?? [])];

                  return (
                    <tr key={r.id} className="hover:bg-surface-raised/40 transition-colors">
                      {/* Name & Preferred Name */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-white text-sm">
                          {r.legalFirstName} {r.legalLastName}
                        </div>
                        {(r.memberFirstName || r.memberLastName) && (
                          <div className="text-[11px] text-foreground-muted mt-0.5">
                            Pref: {r.memberFirstName} {r.memberLastName}
                          </div>
                        )}
                        {r.memberEmail && (
                          <div className="text-[11px] text-foreground-secondary truncate max-w-[180px]">
                            {r.memberEmail}
                          </div>
                        )}
                      </td>

                      {/* School & Grad Year */}
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-foreground">
                          {r.schoolName || <span className="text-foreground-muted italic">Unassigned</span>}
                        </div>
                        <div className="text-[11px] text-foreground-muted">
                          {r.graduationYear ? `Class of ${r.graduationYear}` : 'No class year'}
                        </div>
                      </td>

                      {/* DOB / Gender */}
                      <td className="py-3.5 px-4">
                        <div className="text-foreground">{birthFormatted}</div>
                        <div className="text-[11px] text-foreground-muted capitalize">
                          {r.gender || 'Not specified'}
                        </div>
                      </td>

                      {/* Race & Ethnicity */}
                      <td className="py-3.5 px-4 max-w-[200px]">
                        {allRaces.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {allRaces.map((tag, idx) => (
                              <span
                                key={idx}
                                className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-surface-sunken border border-line text-foreground-secondary truncate"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-foreground-muted text-[11px]">—</span>
                        )}
                      </td>

                      {/* Equity Badges */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-1 items-start">
                          {r.isFreeOrReducedLunch === true ? (
                            <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/50">
                              Title I Eligible
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded bg-surface-sunken text-foreground-muted border border-line">
                              Standard
                            </span>
                          )}

                          {r.isFirstGenCollege === true && (
                            <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded bg-purple-950/60 text-purple-400 border border-purple-800/50">
                              First-Gen College
                            </span>
                          )}

                          {r.doePetitionConsent && (
                            <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded bg-blue-950/60 text-blue-400 border border-blue-800/50">
                              DOE Consent
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Language & Country */}
                      <td className="py-3.5 px-4">
                        <div className="text-foreground capitalize">{r.primaryLanguageAtHome || 'English'}</div>
                        <div className="text-[11px] text-foreground-muted">
                          Born: {r.countryOfBirth || 'USA'}
                        </div>
                      </td>

                      {/* Survey View Button */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => setActiveSurveyRecord(r)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface-raised hover:bg-line border border-line text-foreground hover:text-white rounded-lg transition-all font-bold text-[11px] uppercase tracking-wider cursor-pointer"
                        >
                          <HiOutlineInformationCircle className="w-3.5 h-3.5 text-accent" />
                          <span>Survey</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Survey Details Modal */}
      {activeSurveyRecord && (
        <Overlay isOpen={Boolean(activeSurveyRecord)} onOpenChange={() => setActiveSurveyRecord(null)}>
          <Modal className="w-full max-w-xl bg-surface border border-line rounded-2xl shadow-2xl overflow-hidden my-8">
            <Dialog className="flex flex-col max-h-[85vh] outline-none">
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-line bg-surface-raised/40">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-accent/15 text-accent flex items-center justify-center shrink-0">
                    <HiOutlineInformationCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <Heading className="text-base font-bold text-white">
                      {activeSurveyRecord.legalFirstName} {activeSurveyRecord.legalLastName}
                    </Heading>
                    <p className="text-xs text-foreground-secondary">
                      Full Survey & Demographics Responses
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveSurveyRecord(null)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-foreground-muted hover:text-white hover:bg-surface-raised transition-all cursor-pointer"
                  aria-label="Close survey dialog"
                >
                  <HiOutlineXMark className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-6 overflow-y-auto flex-1 text-xs">
                {/* Gaming Metrics */}
                <div className="space-y-3">
                  <h4 className="text-xs font-black text-white uppercase tracking-wider border-b border-line pb-1.5 flex items-center gap-2">
                    <span className="w-1 h-3.5 bg-accent rounded" />
                    <span>Gaming Environment & Connectivity</span>
                  </h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 bg-surface-sunken/40 rounded-xl border border-line">
                      <span className="text-[10px] text-foreground-muted font-bold uppercase">Reported Ping</span>
                      <div className="text-sm font-bold text-white mt-1">
                        {activeSurveyRecord.surveyDetails?.ping || 'Not reported'}
                      </div>
                    </div>
                    <div className="p-3 bg-surface-sunken/40 rounded-xl border border-line">
                      <span className="text-[10px] text-foreground-muted font-bold uppercase">Hours / Week</span>
                      <div className="text-sm font-bold text-white mt-1">
                        {activeSurveyRecord.surveyDetails?.hoursPerWeek || 'Not reported'}
                      </div>
                    </div>
                    <div className="p-3 bg-surface-sunken/40 rounded-xl border border-line">
                      <span className="text-[10px] text-foreground-muted font-bold uppercase">Internet Quality</span>
                      <div className="text-sm font-bold text-white mt-1">
                        {activeSurveyRecord.surveyDetails?.internetReliability || 'Not reported'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Career Interests */}
                <div className="space-y-3">
                  <h4 className="text-xs font-black text-white uppercase tracking-wider border-b border-line pb-1.5 flex items-center gap-2">
                    <span className="w-1 h-3.5 bg-accent rounded" />
                    <span>Career & Academic Interests</span>
                  </h4>
                  {activeSurveyRecord.surveyDetails?.careerInterests &&
                  activeSurveyRecord.surveyDetails.careerInterests.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {activeSurveyRecord.surveyDetails.careerInterests.map((interest, idx) => (
                        <span
                          key={idx}
                          className="px-2.5 py-1 text-xs font-medium rounded-lg bg-surface-raised border border-line text-white"
                        >
                          {interest}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-foreground-muted italic">No career interests specified.</p>
                  )}
                </div>

                {/* Family & Background */}
                <div className="space-y-3">
                  <h4 className="text-xs font-black text-white uppercase tracking-wider border-b border-line pb-1.5 flex items-center gap-2">
                    <span className="w-1 h-3.5 bg-accent rounded" />
                    <span>Family & Demographic Background</span>
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-surface-sunken/40 rounded-xl border border-line">
                      <span className="text-[10px] text-foreground-muted font-bold uppercase">Parent Birthplace</span>
                      <div className="text-xs font-medium text-white mt-1">
                        {activeSurveyRecord.parentsCountryOfBirth || 'Not specified'}
                      </div>
                    </div>
                    <div className="p-3 bg-surface-sunken/40 rounded-xl border border-line">
                      <span className="text-[10px] text-foreground-muted font-bold uppercase">Home Language</span>
                      <div className="text-xs font-medium text-white mt-1">
                        {activeSurveyRecord.primaryLanguageAtHome || 'English'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Student Feedback */}
                {activeSurveyRecord.surveyDetails?.feedback && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-black text-white uppercase tracking-wider border-b border-line pb-1.5 flex items-center gap-2">
                      <span className="w-1 h-3.5 bg-accent rounded" />
                      <span>Student Feedback & Goals</span>
                    </h4>
                    <div className="p-3 bg-surface-sunken/40 rounded-xl border border-line text-foreground leading-relaxed italic">
                      &quot;{activeSurveyRecord.surveyDetails.feedback}&quot;
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-line flex justify-end bg-surface-raised/20">
                <button
                  type="button"
                  onClick={() => setActiveSurveyRecord(null)}
                  className="px-5 py-2 bg-surface-raised hover:bg-line text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer border border-line"
                >
                  Close
                </button>
              </div>
            </Dialog>
          </Modal>
        </Overlay>
      )}
    </div>
  );
}

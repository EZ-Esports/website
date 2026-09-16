'use client';

import { useEffect, useState } from 'react';
import {
  validateSchoolApplicationForm,
  compileApplicationPayload,
  type SchoolApplicationFormData,
} from '@/app/lib/school-application-form';
import {
  CHECKBOX_GROUP_LABELS,
  emptySelection,
  isCheckboxGroupComplete,
  SECTIONS,
  type CheckboxGroupKey,
  type CheckboxOptionKey,
  type SectionId,
} from './form-config';
import PresidentSection from './sections/PresidentSection';
import VicePresidentSection from './sections/VicePresidentSection';
import OfficerSection from './sections/OfficerSection';
import ClubInfoSection from './sections/ClubInfoSection';

const initialForm = {
  clubStatus: '',

  // Layer 1: President Info
  presidentFirstName: '',
  presidentLastName: '',
  schoolName: '',
  presidentGradYear: '',
  presidentEmail: '',
  presidentDiscord: '',
  presidentPreferredContact: '',

  // Layer 2: Vice President Info
  vpFirstName: '',
  vpLastName: '',
  vpGradYear: '',
  vpDiscord: '',
  vpEmail: '',
  vpPreferredContact: '',

  // Layer 3: 3rd Student Club Officer Info
  officerFirstName: '',
  officerLastName: '',
  officerGradYear: '',
  officerEmail: '',
  officerPreferredContact: '',

  // Layer 4: Club Info
  instagramLink: '',
  discordLink: '',
  advisorName: '',
  advisorEmail: '',
  advisorConfirmed: '',
  activeStudentsCount: '',
  interestedGames: emptySelection(CHECKBOX_GROUP_LABELS.interestedGames.labels, CHECKBOX_GROUP_LABELS.interestedGames.hasOther),
  interestedGamesOther: '',
  clubBarriers: '',
  clubBarriersOther: '',
  nonRosterOpportunities: emptySelection(CHECKBOX_GROUP_LABELS.nonRosterOpportunities.labels, CHECKBOX_GROUP_LABELS.nonRosterOpportunities.hasOther),
  nonRosterOpportunitiesOther: '',
  inclusiveOpportunities: emptySelection(CHECKBOX_GROUP_LABELS.inclusiveOpportunities.labels, CHECKBOX_GROUP_LABELS.inclusiveOpportunities.hasOther),
  inclusiveOpportunitiesOther: '',
  separateGamingClubs: '',
  contributeBeyondSchool: emptySelection(CHECKBOX_GROUP_LABELS.contributeBeyondSchool.labels, CHECKBOX_GROUP_LABELS.contributeBeyondSchool.hasOther),
  feedback: '',
  agreedToRules: false,
  agreedToTerms: false,
  agreedToPrivacy: false,
} satisfies SchoolApplicationFormData;

// `satisfies` (rather than a `: SchoolApplicationFormData` annotation) keeps
// the state's inferred type as narrow as the literal above — e.g. every
// `*Other` field stays a required `string` instead of widening to the lib
// type's `string | undefined` — exactly as it did before this file was
// split up. Section components import this type instead of
// `SchoolApplicationFormData` so they see the same narrowed shape.
export type ApplyFormData = typeof initialForm;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ApplyForm() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<SectionId>('president');

  const [form, setForm] = useState(initialForm);

  // Scroll-spy: highlight the section currently in view in the sidebar nav.
  useEffect(() => {
    if (submitted) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          setActiveSection(visible[0].target.id.replace('section-', '') as SectionId);
        }
      },
      { rootMargin: '-15% 0px -55% 0px' }
    );
    SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(`section-${id}`);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [submitted]);

  const requiredChecks: Record<SectionId, boolean[]> = {
    president: [
      !!form.clubStatus,
      !!form.presidentFirstName.trim(),
      !!form.presidentLastName.trim(),
      !!form.schoolName.trim(),
      !!form.presidentGradYear,
      EMAIL_RE.test(form.presidentEmail),
      !!form.presidentDiscord.trim(),
      !!form.presidentPreferredContact.trim(),
    ],
    vicePresident: [
      !!form.vpFirstName.trim(),
      !!form.vpLastName.trim(),
      !!form.vpGradYear,
      !!form.vpDiscord.trim(),
      EMAIL_RE.test(form.vpEmail),
      !!form.vpPreferredContact.trim(),
    ],
    thirdOfficer: [
      !!form.officerFirstName.trim(),
      !!form.officerLastName.trim(),
      !!form.officerGradYear,
      EMAIL_RE.test(form.officerEmail),
      !!form.officerPreferredContact.trim(),
    ],
    clubInfo: [
      !!form.instagramLink.trim(),
      !!form.discordLink.trim(),
      !!form.advisorName.trim(),
      EMAIL_RE.test(form.advisorEmail),
      !!form.advisorConfirmed,
      !!form.activeStudentsCount.trim(),
      isCheckboxGroupComplete(form.interestedGames, form.interestedGamesOther),
      !!form.clubBarriers && (form.clubBarriers !== 'other' || !!form.clubBarriersOther.trim()),
      isCheckboxGroupComplete(form.nonRosterOpportunities, form.nonRosterOpportunitiesOther),
      isCheckboxGroupComplete(form.inclusiveOpportunities, form.inclusiveOpportunitiesOther),
      !!form.separateGamingClubs.trim(),
      isCheckboxGroupComplete(form.contributeBeyondSchool),
      form.agreedToRules,
      form.agreedToTerms,
      form.agreedToPrivacy,
    ],
  };

  const sectionComplete = (id: SectionId) => requiredChecks[id].every(Boolean);
  const allChecks = Object.values(requiredChecks).flat();
  const progress = Math.round((allChecks.filter(Boolean).length / allChecks.length) * 100);

  const scrollToSection = (id: SectionId) => {
    document.getElementById(`section-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validateSchoolApplicationForm(form);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      const firstErrorKey = Object.keys(errors)[0];
      const element = document.getElementById(`field-${firstErrorKey}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }
    setFieldErrors({});
    setLoading(true);
    setError('');

    try {
      // The client compiles the payload before sending; the API route
      // (app/api/apply/route.ts) re-checks required fields, email format,
      // and — the one check it can't skip — that all three legal consents
      // were actually given, so that gate can't be bypassed client-side.
      const res = await fetch('/api/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(compileApplicationPayload(form)),
      });
      if (!res.ok) throw new Error('Submission failed');
      setSubmitted(true);
    } catch {
      setError('Something went wrong. Please try again or reach out to info@ezesports.org.');
    } finally {
      setLoading(false);
    }
  };

  // Shared by every change handler below so "clear the error(s) this edit
  // just resolved" stays a single implementation instead of four copies.
  const clearFieldErrors = (...keys: string[]) => {
    if (!keys.some((key) => fieldErrors[key])) return;
    setFieldErrors((prev) => {
      const next = { ...prev };
      for (const key of keys) delete next[key];
      return next;
    });
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    clearFieldErrors(name);
  };

  // clubBarriers pairs a radio group with a write-in "Other" field, same as
  // the checkbox groups below — needs its own handler (rather than plain
  // handleTextChange) so switching away from "other" also clears the
  // now-irrelevant clubBarriersOther error, mirroring handleCheckboxGroupChange.
  const handleClubBarriersChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    setForm((prev) => ({ ...prev, clubBarriers: value }));
    clearFieldErrors('clubBarriers', 'clubBarriersOther');
  };

  const handleConsentChange = (field: 'agreedToRules' | 'agreedToTerms' | 'agreedToPrivacy', checked: boolean) => {
    setForm((prev) => ({ ...prev, [field]: checked }));
    clearFieldErrors(field);
  };

  const handleCheckboxGroupChange = <G extends CheckboxGroupKey>(group: G, key: CheckboxOptionKey<G>, checked: boolean) => {
    setForm((prev) => ({
      ...prev,
      [group]: {
        ...prev[group],
        [key]: checked,
      },
    }));
    clearFieldErrors(group, `${group}Other`);
  };

  const handleClearForm = () => {
    setForm(initialForm);
    setFieldErrors({});
  };

  return (
    <section className="theme-light min-h-screen bg-gradient-to-br from-[#fff0f5] via-[#ffeef6] to-[#ffdceb] pt-12 md:pt-16 pb-16 md:pb-24 relative z-10">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Header: title, meta badges, description, benefits & notice */}
        <div className="mb-10 md:mb-14 max-w-3xl">
          <span className="inline-block text-accent uppercase tracking-widest text-xs font-bold mb-3">
            Registration Portal
          </span>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight bg-gradient-to-r from-foreground to-accent bg-clip-text text-transparent uppercase">
            Submit Interest
          </h1>

          {/* Metadata badges */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-4 text-xs font-semibold text-foreground-secondary">
            <span className="inline-flex items-center gap-1.5">
              <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              New York City
            </span>
            <span className="inline-flex items-center gap-1.5">
              <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              ~5 min to complete
            </span>
            <span className="inline-flex items-center gap-1.5">
              <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              {SECTIONS.length} sections
            </span>
            <span className="inline-flex items-center gap-1.5">
              <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Free for schools
            </span>
          </div>

          {/* Description & League Highlights */}
          <p className="text-foreground-secondary text-sm md:text-base mt-5 font-medium leading-relaxed">
            Bring competitive high-school esports to your campus for the <strong className="text-foreground">2026–2027</strong> school year. Any high school student currently leading their school&apos;s Esports Club can apply on behalf of their school. Joining gets your students:
          </p>
          <ul className="mt-3 space-y-1.5 text-sm font-medium text-foreground-secondary">
            {[
              'Organized leagues in Valorant, League of Legends, Teamfight Tactics, TETR.IO, Clash Royale, and Super Smash Bros. Ultimate with real standings',
              'Live-streamed matches broadcast to audiences across NYC',
              'Community and pathways into gaming and technology careers',
            ].map((benefit) => (
              <li key={benefit} className="flex items-start gap-2.5">
                <svg className="w-4 h-4 mt-0.5 shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span>{benefit}</span>
              </li>
            ))}
          </ul>

          {/* Quick resource links */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-6 text-xs font-semibold text-foreground-secondary">
            <a
              href="https://www.instagram.com/e.z.esports/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 hover:text-accent transition-colors"
            >
              <svg className="w-4 h-4 text-accent" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
              </svg>
              Instagram
            </a>
            <a
              href="https://docs.google.com/presentation/d/1IQ1GnfzcZQTfVkaMUCzu17BGx10D0hicYxKPc5574uc/edit?usp=sharing"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 hover:text-accent transition-colors"
            >
              <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12H4z" />
              </svg>
              Pitch Deck
            </a>
            <a
              href="https://www.silive.com/sports/2023/01/game-on-susan-wagner-student-spurred-a-city-wide-esports-league-which-is-now-home-to-hundreds-of-members.html"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 hover:text-accent transition-colors"
            >
              <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6m-6 4h6" />
              </svg>
              News Article
            </a>
          </div>
        </div>

        {submitted ? (
          <div className="max-w-2xl mx-auto bg-surface/95 border border-line rounded-2xl p-8 text-center space-y-6 shadow-xl backdrop-blur-md">
            <div className="w-16 h-16 rounded-full bg-success/10 border border-success/20 flex items-center justify-center mx-auto animate-bounce">
              <svg className="w-8 h-8 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-black text-foreground">Application Received!</h2>
              <p className="text-foreground-secondary text-sm mt-3 leading-relaxed">
                Thank you for applying. We have registered your school&apos;s 3 points of contact and club details. We will review your application and reach out to <strong className="text-foreground">{form.presidentEmail}</strong> soon.
              </p>
            </div>
            <button
              onClick={() => {
                setSubmitted(false);
                setForm(initialForm);
              }}
              className="text-accent hover:underline text-sm font-semibold focus:outline-none cursor-pointer"
            >
              Submit another application
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left rail: sticky scroll-spy navigation + After You Apply timeline + Assistance */}
            <aside className="lg:col-span-4 space-y-6 lg:sticky lg:top-24">
              <nav
                aria-label="Application sections"
                className="bg-surface/85 backdrop-blur-md rounded-2xl border border-line p-6 shadow-sm"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Application</h3>
                  <span className="text-xs font-bold text-accent tabular-nums">{progress}%</span>
                </div>
                <div
                  className="h-1.5 rounded-full bg-accent/10 overflow-hidden mb-5"
                  role="progressbar"
                  aria-valuenow={progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Required fields completed"
                >
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-accent to-accent-secondary transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>

                <ul className="space-y-1">
                  {SECTIONS.map((section) => {
                    const isActive = activeSection === section.id;
                    const isComplete = sectionComplete(section.id);
                    return (
                      <li key={section.id}>
                        <button
                          type="button"
                          onClick={() => scrollToSection(section.id)}
                          aria-current={isActive ? 'true' : undefined}
                          className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-all cursor-pointer ${
                            isActive
                              ? 'bg-accent/10 text-foreground font-bold'
                              : 'text-foreground-secondary font-semibold hover:bg-accent/5 hover:text-foreground'
                          }`}
                        >
                          <span
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-colors ${
                              isComplete
                                ? 'bg-success text-white'
                                : isActive
                                ? 'bg-accent text-white'
                                : 'bg-accent/10 text-accent border border-line'
                            }`}
                          >
                            {isComplete ? (
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              section.num
                            )}
                          </span>
                          <span>{section.title}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </nav>

              {/* What happens next / Timeline */}
              <div className="bg-surface/85 backdrop-blur-md rounded-2xl border border-line p-6 shadow-sm">
                <h3 className="text-sm font-bold text-foreground mb-4 uppercase tracking-wider">After You Apply</h3>
                <ol className="relative border-l-2 border-line ml-2.5 pl-5 space-y-5 text-sm">
                  <li className="relative">
                    <span className="absolute -left-[27px] top-1 h-2.5 w-2.5 rounded-full bg-accent ring-4 ring-surface" />
                    <p className="font-bold text-foreground">Consultation call</p>
                    <p className="text-xs text-foreground-muted mt-0.5">Short meeting to review league rules &amp; format.</p>
                  </li>
                  <li className="relative">
                    <span className="absolute -left-[27px] top-1 h-2.5 w-2.5 rounded-full bg-line ring-4 ring-surface" />
                    <p className="font-bold text-foreground">Roster registration</p>
                    <p className="text-xs text-foreground-muted mt-0.5">Register players and assign coaches/captains.</p>
                  </li>
                  <li className="relative">
                    <span className="absolute -left-[27px] top-1 h-2.5 w-2.5 rounded-full bg-line ring-4 ring-surface" />
                    <p className="font-bold text-foreground">Season kickoff</p>
                    <p className="text-xs text-foreground-muted mt-0.5">Match schedules are generated &amp; games start!</p>
                  </li>
                </ol>
              </div>

              {/* Assistance */}
              <div className="bg-surface/85 backdrop-blur-md rounded-2xl border border-line p-6 shadow-sm">
                <h3 className="text-xs font-bold text-foreground mb-2 uppercase tracking-wider">Need Assistance?</h3>
                <p className="text-xs text-foreground-muted mb-3 leading-relaxed">
                  Have questions about student eligibility, club requirements, or discord onboarding? We are here to help.
                </p>
                <div className="flex flex-col gap-1.5 text-xs">
                  <a href="mailto:info@ezesports.org" className="text-accent hover:underline font-bold transition-all">
                    info@ezesports.org
                  </a>
                </div>
              </div>
            </aside>

            {/* Right column: 4 Layers Form */}
            <form onSubmit={handleSubmit} className="lg:col-span-8 space-y-6" noValidate>
              <PresidentSection
                form={form}
                fieldErrors={fieldErrors}
                focusedField={focusedField}
                onFieldFocus={setFocusedField}
                onFieldBlur={() => setFocusedField(null)}
                onTextChange={handleTextChange}
              />

              <VicePresidentSection
                form={form}
                fieldErrors={fieldErrors}
                focusedField={focusedField}
                onFieldFocus={setFocusedField}
                onFieldBlur={() => setFocusedField(null)}
                onTextChange={handleTextChange}
              />

              <OfficerSection
                form={form}
                fieldErrors={fieldErrors}
                focusedField={focusedField}
                onFieldFocus={setFocusedField}
                onFieldBlur={() => setFocusedField(null)}
                onTextChange={handleTextChange}
              />

              <ClubInfoSection
                form={form}
                fieldErrors={fieldErrors}
                focusedField={focusedField}
                onFieldFocus={setFocusedField}
                onFieldBlur={() => setFocusedField(null)}
                onTextChange={handleTextChange}
                onClubBarriersChange={handleClubBarriersChange}
                onCheckboxGroupChange={handleCheckboxGroupChange}
                onConsentChange={handleConsentChange}
                loading={loading}
                error={error}
                onClearForm={handleClearForm}
              />
            </form>
          </div>
        )}
      </div>
    </section>
  );
}

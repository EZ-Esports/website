'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { validateSchoolApplicationForm, compileApplicationPayload } from '@/app/lib/school-application-form';
import Button from '@/app/components/ui/Button';
import { Textarea } from '@/app/components/ui/form';

const GRAD_YEARS = ["'27", "'28", "'29", "'30"] as const;

const initialForm = {
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
  clubSocials: '',
  advisorName: '',
  advisorEmail: '',
  activeStudentsCount: '',
  interestedGames: {
    valorant: false,
    lol: false,
    tft: false,
    tetris: false,
    clashRoyale: false,
    other: false,
  },
  interestedGamesOther: '',
  feedback: '',
  agreedRules: false,
};

const SECTIONS = [
  { id: 'president', num: 1, title: 'President Info', desc: 'Primary student leader contact and school details.' },
  { id: 'vicePresident', num: 2, title: 'Vice President Info', desc: 'Co-president, VP, or primary club manager.' },
  { id: 'thirdOfficer', num: 3, title: '3rd Student Officer Info', desc: 'Third student point of contact.' },
  { id: 'clubInfo', num: 4, title: 'Club Info', desc: 'Socials, advisor details, active members & games.' },
] as const;

type SectionId = (typeof SECTIONS)[number]['id'];

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
      !!form.advisorName.trim(),
      EMAIL_RE.test(form.advisorEmail),
      !!form.activeStudentsCount.trim(),
      Object.values(form.interestedGames).some(Boolean) &&
        (!form.interestedGames.other || !!form.interestedGamesOther.trim()),
      form.agreedRules,
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
      const payload = compileApplicationPayload(form);
      const res = await fetch('/api/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Submission failed');
      setSubmitted(true);
    } catch {
      setError('Something went wrong. Please try again or reach out to "angesumi" on Discord or email info@ezesports.org.');
    } finally {
      setLoading(false);
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const handleRulesChange = (checked: boolean) => {
    setForm((prev) => ({ ...prev, agreedRules: checked }));
    if (fieldErrors.agreedRules) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next.agreedRules;
        return next;
      });
    }
  };

  const handleGameCheckboxChange = (key: keyof typeof initialForm.interestedGames, checked: boolean) => {
    setForm((prev) => ({
      ...prev,
      interestedGames: {
        ...prev.interestedGames,
        [key]: checked,
      },
    }));
    if (fieldErrors.interestedGames || fieldErrors.interestedGamesOther) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next.interestedGames;
        delete next.interestedGamesOther;
        return next;
      });
    }
  };

  const textInputClass = (hasError: boolean) =>
    `w-full px-4 py-3 bg-surface border rounded-lg text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 transition-all text-sm shadow-sm ${
      hasError
        ? 'border-danger focus:ring-danger/20'
        : 'border-line focus:ring-accent/20 focus:border-accent/50'
    }`;

  const fieldWrapperClass = (fieldId: string, hasError: boolean) => {
    const isFocused = focusedField === fieldId;
    return `transition-all duration-300 border-l-2 pl-3 w-full ${
      hasError ? 'border-danger' : isFocused ? 'border-accent' : 'border-transparent'
    }`;
  };

  const labelClass = 'block text-xs sm:text-sm font-bold text-foreground mb-2 tracking-wide uppercase';
  const requiredMark = <span className="text-accent ml-1" aria-hidden="true">*</span>;

  const sectionCardClass =
    'bg-surface/90 backdrop-blur-md rounded-2xl border border-line/75 p-6 sm:p-8 shadow-sm space-y-5 scroll-mt-28';

  const sectionHeader = (id: SectionId) => {
    const section = SECTIONS.find((s) => s.id === id)!;
    return (
      <div className="border-b border-line/50 pb-4 mb-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent mb-1">
          Step {section.num} of {SECTIONS.length}
        </p>
        <h3 className="text-lg sm:text-xl font-black text-foreground tracking-tight">{section.title}</h3>
        <p className="text-xs text-foreground-secondary mt-1">{section.desc}</p>
      </div>
    );
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
            School Application
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
            Bring competitive high-school esports to your campus. High school Esports Club presidents and student club officers can apply on behalf of their school. Joining gets your students:
          </p>
          <ul className="mt-3 space-y-1.5 text-sm font-medium text-foreground-secondary">
            {[
              'Organized leagues in Valorant, League of Legends, Teamfight Tactics, Tetris, and Clash Royale with real standings',
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

          {/* Notice Banner */}
          <div className="mt-6 bg-accent/10 border border-accent/30 rounded-xl p-5 space-y-2 text-sm text-foreground">
            <p className="font-bold text-accent uppercase tracking-wider text-xs">Notice &amp; Instructions</p>
            <p className="font-semibold">
              [EZEsports Update // We&apos;re making some exciting changes and updates this summer! Keep an eye out for special announcements and upcoming news.]
            </p>
            <p className="text-foreground-secondary leading-relaxed">
              To complete this application, you must be a high school student leading your school&apos;s Esports Club for the <strong className="text-foreground">2026–2027</strong> school year. If you share leadership with a co-leader, please include their details under the <strong>&quot;Vice President&quot;</strong> section.
            </p>
            <p className="text-foreground font-semibold">
              EZEsports requires at least 3 points of contact, no less.
            </p>
            <p className="text-xs text-foreground-secondary">
              If you have any questions or need further clarification, feel free to reach out to <strong className="text-accent">&quot;angesumi&quot;</strong> on Discord or email <strong className="text-accent">info@ezesports.org</strong>.
            </p>
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
                  <p className="text-foreground-muted">
                    Discord: <span className="font-semibold text-foreground">angesumi</span>
                  </p>
                </div>
              </div>
            </aside>

            {/* Right column: 4 Layers Form */}
            <form onSubmit={handleSubmit} className="lg:col-span-8 space-y-6" noValidate>

              {/* LAYER 1: President Info */}
              <div id="section-president" className={sectionCardClass}>
                {sectionHeader('president')}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* President First Name */}
                  <div id="field-presidentFirstName" className={fieldWrapperClass('presidentFirstName', !!fieldErrors.presidentFirstName)}>
                    <label htmlFor="presidentFirstName" className={labelClass}>President First Name {requiredMark}</label>
                    <input
                      id="presidentFirstName"
                      name="presidentFirstName"
                      type="text"
                      placeholder="Jane"
                      value={form.presidentFirstName}
                      onChange={handleTextChange}
                      onFocus={() => setFocusedField('presidentFirstName')}
                      onBlur={() => setFocusedField(null)}
                      className={textInputClass(!!fieldErrors.presidentFirstName)}
                      required
                      aria-invalid={!!fieldErrors.presidentFirstName}
                      aria-describedby={fieldErrors.presidentFirstName ? 'presidentFirstName-error' : undefined}
                    />
                    {fieldErrors.presidentFirstName && (
                      <p id="presidentFirstName-error" className="mt-1.5 text-xs text-danger font-semibold">{fieldErrors.presidentFirstName}</p>
                    )}
                  </div>

                  {/* President Last Name */}
                  <div id="field-presidentLastName" className={fieldWrapperClass('presidentLastName', !!fieldErrors.presidentLastName)}>
                    <label htmlFor="presidentLastName" className={labelClass}>President Last Name {requiredMark}</label>
                    <input
                      id="presidentLastName"
                      name="presidentLastName"
                      type="text"
                      placeholder="Smith"
                      value={form.presidentLastName}
                      onChange={handleTextChange}
                      onFocus={() => setFocusedField('presidentLastName')}
                      onBlur={() => setFocusedField(null)}
                      className={textInputClass(!!fieldErrors.presidentLastName)}
                      required
                      aria-invalid={!!fieldErrors.presidentLastName}
                      aria-describedby={fieldErrors.presidentLastName ? 'presidentLastName-error' : undefined}
                    />
                    {fieldErrors.presidentLastName && (
                      <p id="presidentLastName-error" className="mt-1.5 text-xs text-danger font-semibold">{fieldErrors.presidentLastName}</p>
                    )}
                  </div>
                </div>

                {/* Name of School */}
                <div id="field-schoolName" className={fieldWrapperClass('schoolName', !!fieldErrors.schoolName)}>
                  <label htmlFor="schoolName" className={labelClass}>
                    Name of School (Ex: Brooklyn Technical High School) {requiredMark}
                  </label>
                  <input
                    id="schoolName"
                    name="schoolName"
                    type="text"
                    placeholder="Brooklyn Technical High School"
                    value={form.schoolName}
                    onChange={handleTextChange}
                    onFocus={() => setFocusedField('schoolName')}
                    onBlur={() => setFocusedField(null)}
                    className={textInputClass(!!fieldErrors.schoolName)}
                    required
                    aria-invalid={!!fieldErrors.schoolName}
                    aria-describedby={fieldErrors.schoolName ? 'schoolName-error' : undefined}
                  />
                  {fieldErrors.schoolName && (
                    <p id="schoolName-error" className="mt-1.5 text-xs text-danger font-semibold">{fieldErrors.schoolName}</p>
                  )}
                </div>

                {/* Graduation Year */}
                <div
                  id="field-presidentGradYear"
                  className={fieldWrapperClass('presidentGradYear', !!fieldErrors.presidentGradYear)}
                  role="group"
                  aria-labelledby="presidentGradYear-label"
                >
                  <span id="presidentGradYear-label" className={labelClass}>Graduation Year {requiredMark}</span>
                  <div className="flex flex-wrap gap-4 mt-2">
                    {GRAD_YEARS.map((yr) => (
                      <label key={yr} className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-foreground-secondary hover:text-foreground transition-colors">
                        <input
                          type="radio"
                          name="presidentGradYear"
                          value={yr}
                          checked={form.presidentGradYear === yr}
                          onChange={handleTextChange}
                          className="w-4.5 h-4.5 accent-accent cursor-pointer"
                        />
                        <span>{yr}</span>
                      </label>
                    ))}
                  </div>
                  {fieldErrors.presidentGradYear && (
                    <p className="mt-2 text-xs text-danger font-semibold">{fieldErrors.presidentGradYear}</p>
                  )}
                </div>

                {/* President Email */}
                <div id="field-presidentEmail" className={fieldWrapperClass('presidentEmail', !!fieldErrors.presidentEmail)}>
                  <label htmlFor="presidentEmail" className={labelClass}>
                    Please type your email below. (Fill this out with the email you check the most often!) {requiredMark}
                  </label>
                  <input
                    id="presidentEmail"
                    name="presidentEmail"
                    type="email"
                    placeholder="jsmith@gmail.com"
                    value={form.presidentEmail}
                    onChange={handleTextChange}
                    onFocus={() => setFocusedField('presidentEmail')}
                    onBlur={() => setFocusedField(null)}
                    className={textInputClass(!!fieldErrors.presidentEmail)}
                    required
                    aria-invalid={!!fieldErrors.presidentEmail}
                    aria-describedby={fieldErrors.presidentEmail ? 'presidentEmail-error' : undefined}
                  />
                  {fieldErrors.presidentEmail && (
                    <p id="presidentEmail-error" className="mt-1.5 text-xs text-danger font-semibold">{fieldErrors.presidentEmail}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* President Discord */}
                  <div id="field-presidentDiscord" className={fieldWrapperClass('presidentDiscord', !!fieldErrors.presidentDiscord)}>
                    <label htmlFor="presidentDiscord" className={labelClass}>Discord username (ex: angesumi) {requiredMark}</label>
                    <input
                      id="presidentDiscord"
                      name="presidentDiscord"
                      type="text"
                      placeholder="angesumi"
                      value={form.presidentDiscord}
                      onChange={handleTextChange}
                      onFocus={() => setFocusedField('presidentDiscord')}
                      onBlur={() => setFocusedField(null)}
                      className={textInputClass(!!fieldErrors.presidentDiscord)}
                      required
                      aria-invalid={!!fieldErrors.presidentDiscord}
                      aria-describedby={fieldErrors.presidentDiscord ? 'presidentDiscord-error' : undefined}
                    />
                    {fieldErrors.presidentDiscord && (
                      <p id="presidentDiscord-error" className="mt-1.5 text-xs text-danger font-semibold">{fieldErrors.presidentDiscord}</p>
                    )}
                  </div>

                  {/* Best place to reach you */}
                  <div id="field-presidentPreferredContact" className={fieldWrapperClass('presidentPreferredContact', !!fieldErrors.presidentPreferredContact)}>
                    <label htmlFor="presidentPreferredContact" className={labelClass}>
                      Where is the best place to reach you? (platform) {requiredMark}
                    </label>
                    <input
                      id="presidentPreferredContact"
                      name="presidentPreferredContact"
                      type="text"
                      placeholder="Discord / Email / SMS"
                      value={form.presidentPreferredContact}
                      onChange={handleTextChange}
                      onFocus={() => setFocusedField('presidentPreferredContact')}
                      onBlur={() => setFocusedField(null)}
                      className={textInputClass(!!fieldErrors.presidentPreferredContact)}
                      required
                      aria-invalid={!!fieldErrors.presidentPreferredContact}
                      aria-describedby={fieldErrors.presidentPreferredContact ? 'presidentPreferredContact-error' : undefined}
                    />
                    {fieldErrors.presidentPreferredContact && (
                      <p id="presidentPreferredContact-error" className="mt-1.5 text-xs text-danger font-semibold">{fieldErrors.presidentPreferredContact}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* LAYER 2: Vice President Info */}
              <div id="section-vicePresident" className={sectionCardClass}>
                {sectionHeader('vicePresident')}

                <div className="bg-surface-raised/40 border border-line/60 rounded-xl p-4 text-xs text-foreground-secondary space-y-1">
                  <p className="italic font-semibold text-foreground">also applies to co-presidents</p>
                  <p>
                    If this role does not apply to your club, please fill out below with a <strong className="text-foreground">manager</strong> (could be for a certain team, your club, etc.) or an officer that is most active and likely to interact with <strong className="text-foreground">EZEsports</strong>. Thank you for your time!
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* VP First Name */}
                  <div id="field-vpFirstName" className={fieldWrapperClass('vpFirstName', !!fieldErrors.vpFirstName)}>
                    <label htmlFor="vpFirstName" className={labelClass}>Vice President First Name {requiredMark}</label>
                    <input
                      id="vpFirstName"
                      name="vpFirstName"
                      type="text"
                      placeholder="Alex"
                      value={form.vpFirstName}
                      onChange={handleTextChange}
                      onFocus={() => setFocusedField('vpFirstName')}
                      onBlur={() => setFocusedField(null)}
                      className={textInputClass(!!fieldErrors.vpFirstName)}
                      required
                      aria-invalid={!!fieldErrors.vpFirstName}
                      aria-describedby={fieldErrors.vpFirstName ? 'vpFirstName-error' : undefined}
                    />
                    {fieldErrors.vpFirstName && (
                      <p id="vpFirstName-error" className="mt-1.5 text-xs text-danger font-semibold">{fieldErrors.vpFirstName}</p>
                    )}
                  </div>

                  {/* VP Last Name */}
                  <div id="field-vpLastName" className={fieldWrapperClass('vpLastName', !!fieldErrors.vpLastName)}>
                    <label htmlFor="vpLastName" className={labelClass}>Vice President Last Name {requiredMark}</label>
                    <input
                      id="vpLastName"
                      name="vpLastName"
                      type="text"
                      placeholder="Taylor"
                      value={form.vpLastName}
                      onChange={handleTextChange}
                      onFocus={() => setFocusedField('vpLastName')}
                      onBlur={() => setFocusedField(null)}
                      className={textInputClass(!!fieldErrors.vpLastName)}
                      required
                      aria-invalid={!!fieldErrors.vpLastName}
                      aria-describedby={fieldErrors.vpLastName ? 'vpLastName-error' : undefined}
                    />
                    {fieldErrors.vpLastName && (
                      <p id="vpLastName-error" className="mt-1.5 text-xs text-danger font-semibold">{fieldErrors.vpLastName}</p>
                    )}
                  </div>
                </div>

                {/* VP Graduation Year */}
                <div
                  id="field-vpGradYear"
                  className={fieldWrapperClass('vpGradYear', !!fieldErrors.vpGradYear)}
                  role="group"
                  aria-labelledby="vpGradYear-label"
                >
                  <span id="vpGradYear-label" className={labelClass}>Graduation Year {requiredMark}</span>
                  <div className="flex flex-wrap gap-4 mt-2">
                    {GRAD_YEARS.map((yr) => (
                      <label key={yr} className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-foreground-secondary hover:text-foreground transition-colors">
                        <input
                          type="radio"
                          name="vpGradYear"
                          value={yr}
                          checked={form.vpGradYear === yr}
                          onChange={handleTextChange}
                          className="w-4.5 h-4.5 accent-accent cursor-pointer"
                        />
                        <span>{yr}</span>
                      </label>
                    ))}
                  </div>
                  {fieldErrors.vpGradYear && (
                    <p className="mt-2 text-xs text-danger font-semibold">{fieldErrors.vpGradYear}</p>
                  )}
                </div>

                {/* VP Discord */}
                <div id="field-vpDiscord" className={fieldWrapperClass('vpDiscord', !!fieldErrors.vpDiscord)}>
                  <label htmlFor="vpDiscord" className={labelClass}>Discord Username (ex: angesumi) {requiredMark}</label>
                  <input
                    id="vpDiscord"
                    name="vpDiscord"
                    type="text"
                    placeholder="alextaylor"
                    value={form.vpDiscord}
                    onChange={handleTextChange}
                    onFocus={() => setFocusedField('vpDiscord')}
                    onBlur={() => setFocusedField(null)}
                    className={textInputClass(!!fieldErrors.vpDiscord)}
                    required
                    aria-invalid={!!fieldErrors.vpDiscord}
                    aria-describedby={fieldErrors.vpDiscord ? 'vpDiscord-error' : undefined}
                  />
                  {fieldErrors.vpDiscord && (
                    <p id="vpDiscord-error" className="mt-1.5 text-xs text-danger font-semibold">{fieldErrors.vpDiscord}</p>
                  )}
                </div>

                {/* VP Email */}
                <div id="field-vpEmail" className={fieldWrapperClass('vpEmail', !!fieldErrors.vpEmail)}>
                  <label htmlFor="vpEmail" className={labelClass}>
                    Please type your email below. (Fill this out with the email you check the most often!) {requiredMark}
                  </label>
                  <input
                    id="vpEmail"
                    name="vpEmail"
                    type="email"
                    placeholder="alext@gmail.com"
                    value={form.vpEmail}
                    onChange={handleTextChange}
                    onFocus={() => setFocusedField('vpEmail')}
                    onBlur={() => setFocusedField(null)}
                    className={textInputClass(!!fieldErrors.vpEmail)}
                    required
                    aria-invalid={!!fieldErrors.vpEmail}
                    aria-describedby={fieldErrors.vpEmail ? 'vpEmail-error' : undefined}
                  />
                  {fieldErrors.vpEmail && (
                    <p id="vpEmail-error" className="mt-1.5 text-xs text-danger font-semibold">{fieldErrors.vpEmail}</p>
                  )}
                </div>

                {/* VP Preferred Contact */}
                <div id="field-vpPreferredContact" className={fieldWrapperClass('vpPreferredContact', !!fieldErrors.vpPreferredContact)}>
                  <label htmlFor="vpPreferredContact" className={labelClass}>
                    Where is the best place to reach you? (platform) {requiredMark}
                  </label>
                  <input
                    id="vpPreferredContact"
                    name="vpPreferredContact"
                    type="text"
                    placeholder="Discord / Email / SMS"
                    value={form.vpPreferredContact}
                    onChange={handleTextChange}
                    onFocus={() => setFocusedField('vpPreferredContact')}
                    onBlur={() => setFocusedField(null)}
                    className={textInputClass(!!fieldErrors.vpPreferredContact)}
                    required
                    aria-invalid={!!fieldErrors.vpPreferredContact}
                    aria-describedby={fieldErrors.vpPreferredContact ? 'vpPreferredContact-error' : undefined}
                  />
                  {fieldErrors.vpPreferredContact && (
                    <p id="vpPreferredContact-error" className="mt-1.5 text-xs text-danger font-semibold">{fieldErrors.vpPreferredContact}</p>
                  )}
                </div>
              </div>

              {/* LAYER 3: 3rd Student Club Officer Info */}
              <div id="section-thirdOfficer" className={sectionCardClass}>
                {sectionHeader('thirdOfficer')}

                <div className="bg-surface-raised/40 border border-line/60 rounded-xl p-4 text-xs text-foreground-secondary">
                  <p>
                    Please fill this out with the <strong className="text-foreground">officer</strong> that is most <strong className="text-foreground">active</strong> and likely to interact with EZEsports! If you already filled the previous section with an officer, pick the second most active student. Thank you!
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Officer First Name */}
                  <div id="field-officerFirstName" className={fieldWrapperClass('officerFirstName', !!fieldErrors.officerFirstName)}>
                    <label htmlFor="officerFirstName" className={labelClass}>Officer First Name {requiredMark}</label>
                    <input
                      id="officerFirstName"
                      name="officerFirstName"
                      type="text"
                      placeholder="Jordan"
                      value={form.officerFirstName}
                      onChange={handleTextChange}
                      onFocus={() => setFocusedField('officerFirstName')}
                      onBlur={() => setFocusedField(null)}
                      className={textInputClass(!!fieldErrors.officerFirstName)}
                      required
                      aria-invalid={!!fieldErrors.officerFirstName}
                      aria-describedby={fieldErrors.officerFirstName ? 'officerFirstName-error' : undefined}
                    />
                    {fieldErrors.officerFirstName && (
                      <p id="officerFirstName-error" className="mt-1.5 text-xs text-danger font-semibold">{fieldErrors.officerFirstName}</p>
                    )}
                  </div>

                  {/* Officer Last Name */}
                  <div id="field-officerLastName" className={fieldWrapperClass('officerLastName', !!fieldErrors.officerLastName)}>
                    <label htmlFor="officerLastName" className={labelClass}>Officer Last Name {requiredMark}</label>
                    <input
                      id="officerLastName"
                      name="officerLastName"
                      type="text"
                      placeholder="Lee"
                      value={form.officerLastName}
                      onChange={handleTextChange}
                      onFocus={() => setFocusedField('officerLastName')}
                      onBlur={() => setFocusedField(null)}
                      className={textInputClass(!!fieldErrors.officerLastName)}
                      required
                      aria-invalid={!!fieldErrors.officerLastName}
                      aria-describedby={fieldErrors.officerLastName ? 'officerLastName-error' : undefined}
                    />
                    {fieldErrors.officerLastName && (
                      <p id="officerLastName-error" className="mt-1.5 text-xs text-danger font-semibold">{fieldErrors.officerLastName}</p>
                    )}
                  </div>
                </div>

                {/* Officer Graduation Year */}
                <div
                  id="field-officerGradYear"
                  className={fieldWrapperClass('officerGradYear', !!fieldErrors.officerGradYear)}
                  role="group"
                  aria-labelledby="officerGradYear-label"
                >
                  <span id="officerGradYear-label" className={labelClass}>Graduation Year {requiredMark}</span>
                  <div className="flex flex-wrap gap-4 mt-2">
                    {GRAD_YEARS.map((yr) => (
                      <label key={yr} className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-foreground-secondary hover:text-foreground transition-colors">
                        <input
                          type="radio"
                          name="officerGradYear"
                          value={yr}
                          checked={form.officerGradYear === yr}
                          onChange={handleTextChange}
                          className="w-4.5 h-4.5 accent-accent cursor-pointer"
                        />
                        <span>{yr}</span>
                      </label>
                    ))}
                  </div>
                  {fieldErrors.officerGradYear && (
                    <p className="mt-2 text-xs text-danger font-semibold">{fieldErrors.officerGradYear}</p>
                  )}
                </div>

                {/* Officer Email */}
                <div id="field-officerEmail" className={fieldWrapperClass('officerEmail', !!fieldErrors.officerEmail)}>
                  <label htmlFor="officerEmail" className={labelClass}>
                    Please type your email below. (Fill this out with the email you check the most often!) {requiredMark}
                  </label>
                  <input
                    id="officerEmail"
                    name="officerEmail"
                    type="email"
                    placeholder="jordanl@gmail.com"
                    value={form.officerEmail}
                    onChange={handleTextChange}
                    onFocus={() => setFocusedField('officerEmail')}
                    onBlur={() => setFocusedField(null)}
                    className={textInputClass(!!fieldErrors.officerEmail)}
                    required
                    aria-invalid={!!fieldErrors.officerEmail}
                    aria-describedby={fieldErrors.officerEmail ? 'officerEmail-error' : undefined}
                  />
                  {fieldErrors.officerEmail && (
                    <p id="officerEmail-error" className="mt-1.5 text-xs text-danger font-semibold">{fieldErrors.officerEmail}</p>
                  )}
                </div>

                {/* Officer Preferred Contact */}
                <div id="field-officerPreferredContact" className={fieldWrapperClass('officerPreferredContact', !!fieldErrors.officerPreferredContact)}>
                  <label htmlFor="officerPreferredContact" className={labelClass}>
                    Where is the best place to reach you? (platform) {requiredMark}
                  </label>
                  <input
                    id="officerPreferredContact"
                    name="officerPreferredContact"
                    type="text"
                    placeholder="Discord / Email / SMS"
                    value={form.officerPreferredContact}
                    onChange={handleTextChange}
                    onFocus={() => setFocusedField('officerPreferredContact')}
                    onBlur={() => setFocusedField(null)}
                    className={textInputClass(!!fieldErrors.officerPreferredContact)}
                    required
                    aria-invalid={!!fieldErrors.officerPreferredContact}
                    aria-describedby={fieldErrors.officerPreferredContact ? 'officerPreferredContact-error' : undefined}
                  />
                  {fieldErrors.officerPreferredContact && (
                    <p id="officerPreferredContact-error" className="mt-1.5 text-xs text-danger font-semibold">{fieldErrors.officerPreferredContact}</p>
                  )}
                </div>
              </div>

              {/* LAYER 4: Club Info */}
              <div id="section-clubInfo" className={sectionCardClass}>
                {sectionHeader('clubInfo')}

                <div className="bg-surface-raised/40 border border-line/60 rounded-xl p-4 text-xs text-foreground-secondary">
                  <p>
                    Every part is <strong className="text-foreground">crucial</strong>! Please double check to ensure that all information filled out is <strong className="text-foreground">accurate</strong>.
                  </p>
                </div>

                {/* Club Socials */}
                <div id="field-clubSocials" className={fieldWrapperClass('clubSocials', false)}>
                  <label htmlFor="clubSocials" className={labelClass}>
                    Please add your club&apos;s socials below.
                    <span className="text-xs text-foreground-secondary font-normal block mt-1 normal-case">
                      (Ex: Instagram: @username, Discord: discordserverlink, etc.)
                    </span>
                  </label>
                  <Textarea
                    id="clubSocials"
                    name="clubSocials"
                    rows={3}
                    placeholder={`Instagram: @bkltechnesports\nDiscord: https://discord.gg/...`}
                    value={form.clubSocials}
                    onChange={handleTextChange}
                    onFocus={() => setFocusedField('clubSocials')}
                    onBlur={() => setFocusedField(null)}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Name of Club Advisor */}
                  <div id="field-advisorName" className={fieldWrapperClass('advisorName', !!fieldErrors.advisorName)}>
                    <label htmlFor="advisorName" className={labelClass}>Name of Club Advisor (Mr./Ms. ...) {requiredMark}</label>
                    <input
                      id="advisorName"
                      name="advisorName"
                      type="text"
                      placeholder="Mr. John Davis"
                      value={form.advisorName}
                      onChange={handleTextChange}
                      onFocus={() => setFocusedField('advisorName')}
                      onBlur={() => setFocusedField(null)}
                      className={textInputClass(!!fieldErrors.advisorName)}
                      required
                      aria-invalid={!!fieldErrors.advisorName}
                      aria-describedby={fieldErrors.advisorName ? 'advisorName-error' : undefined}
                    />
                    {fieldErrors.advisorName && (
                      <p id="advisorName-error" className="mt-1.5 text-xs text-danger font-semibold">{fieldErrors.advisorName}</p>
                    )}
                  </div>

                  {/* Email of Club Advisor */}
                  <div id="field-advisorEmail" className={fieldWrapperClass('advisorEmail', !!fieldErrors.advisorEmail)}>
                    <label htmlFor="advisorEmail" className={labelClass}>
                      Email of Club Advisor (@schools.nyc.gov) {requiredMark}
                    </label>
                    <input
                      id="advisorEmail"
                      name="advisorEmail"
                      type="email"
                      placeholder="jdavis@schools.nyc.gov"
                      value={form.advisorEmail}
                      onChange={handleTextChange}
                      onFocus={() => setFocusedField('advisorEmail')}
                      onBlur={() => setFocusedField(null)}
                      className={textInputClass(!!fieldErrors.advisorEmail)}
                      required
                      aria-invalid={!!fieldErrors.advisorEmail}
                      aria-describedby={fieldErrors.advisorEmail ? 'advisorEmail-error' : undefined}
                    />
                    {fieldErrors.advisorEmail && (
                      <p id="advisorEmail-error" className="mt-1.5 text-xs text-danger font-semibold">{fieldErrors.advisorEmail}</p>
                    )}
                  </div>
                </div>

                {/* Estimated active student count */}
                <div id="field-activeStudentsCount" className={fieldWrapperClass('activeStudentsCount', !!fieldErrors.activeStudentsCount)}>
                  <label htmlFor="activeStudentsCount" className={labelClass}>
                    Estimated amount of students active in club / attending meetings (# input only) {requiredMark}
                  </label>
                  <input
                    id="activeStudentsCount"
                    name="activeStudentsCount"
                    type="text"
                    placeholder="25"
                    value={form.activeStudentsCount}
                    onChange={handleTextChange}
                    onFocus={() => setFocusedField('activeStudentsCount')}
                    onBlur={() => setFocusedField(null)}
                    className={textInputClass(!!fieldErrors.activeStudentsCount)}
                    required
                    aria-invalid={!!fieldErrors.activeStudentsCount}
                    aria-describedby={fieldErrors.activeStudentsCount ? 'activeStudentsCount-error' : undefined}
                  />
                  {fieldErrors.activeStudentsCount && (
                    <p id="activeStudentsCount-error" className="mt-1.5 text-xs text-danger font-semibold">{fieldErrors.activeStudentsCount}</p>
                  )}
                </div>

                {/* Interested Games Checkboxes */}
                <div
                  id="field-interestedGames"
                  className={fieldWrapperClass('interestedGames', !!fieldErrors.interestedGames)}
                  role="group"
                  aria-labelledby="interestedGames-label"
                >
                  <span id="interestedGames-label" className={labelClass}>
                    What games are you and your club members interested in competing for this year? {requiredMark}
                    <span className="text-xs text-foreground-secondary font-normal block mt-1 normal-case">
                      (note: we want to organize other games if there is interest, so please include games you feel confident organizing teams for)
                    </span>
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                    {[
                      { id: 'valorant', label: 'Valorant' },
                      { id: 'lol', label: 'League of Legends (LoL)' },
                      { id: 'tft', label: 'Teamfight Tactics (TFT)' },
                      { id: 'tetris', label: 'Tetris' },
                      { id: 'clashRoyale', label: 'Clash Royale' },
                    ].map((g) => (
                      <label key={g.id} className="flex items-center gap-2.5 cursor-pointer text-sm font-semibold text-foreground-secondary hover:text-foreground transition-colors">
                        <input
                          type="checkbox"
                          checked={form.interestedGames[g.id as keyof typeof form.interestedGames]}
                          onChange={(e) => handleGameCheckboxChange(g.id as keyof typeof form.interestedGames, e.target.checked)}
                          className="w-4.5 h-4.5 rounded border-line accent-accent cursor-pointer"
                        />
                        <span>{g.label}</span>
                      </label>
                    ))}

                    {/* Other option with write-in field */}
                    <div className="sm:col-span-2 flex flex-col sm:flex-row sm:items-center gap-2 mt-1">
                      <label className="flex items-center gap-2.5 cursor-pointer text-sm font-semibold text-foreground-secondary hover:text-foreground transition-colors shrink-0">
                        <input
                          type="checkbox"
                          checked={form.interestedGames.other}
                          onChange={(e) => handleGameCheckboxChange('other', e.target.checked)}
                          className="w-4.5 h-4.5 rounded border-line accent-accent cursor-pointer"
                        />
                        <span>Other:</span>
                      </label>
                      {form.interestedGames.other && (
                        <input
                          id="field-interestedGamesOther"
                          type="text"
                          name="interestedGamesOther"
                          placeholder="Specify game name..."
                          value={form.interestedGamesOther}
                          onChange={handleTextChange}
                          className="w-full sm:flex-1 px-3 py-1.5 bg-surface border border-line rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                        />
                      )}
                    </div>
                  </div>
                  {fieldErrors.interestedGames && (
                    <p className="mt-2 text-xs text-danger font-semibold">{fieldErrors.interestedGames}</p>
                  )}
                  {fieldErrors.interestedGamesOther && (
                    <p className="mt-2 text-xs text-danger font-semibold">{fieldErrors.interestedGamesOther}</p>
                  )}
                </div>

                {/* Feedback */}
                <div id="field-feedback" className={fieldWrapperClass('feedback', false)}>
                  <label htmlFor="feedback" className={labelClass}>
                    Feedback or suggestions for EZ Esports
                    <span className="text-xs text-foreground-secondary font-normal block mt-1 normal-case">
                      (Please include any feedback from you or your club about enhancing your school&apos;s experience with EZ Esports.)
                    </span>
                  </label>
                  <Textarea
                    id="feedback"
                    name="feedback"
                    rows={3}
                    placeholder="Share any thoughts, ideas, or feature requests..."
                    value={form.feedback}
                    onChange={handleTextChange}
                    onFocus={() => setFocusedField('feedback')}
                    onBlur={() => setFocusedField(null)}
                  />
                </div>

                {/* Rules & Terms Reference Link */}
                <div className="rounded-xl border border-line bg-accent/5 p-4 text-xs text-foreground-secondary flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span>Review league rules, terms of participation, and handbook:</span>
                  <Link
                    href="/about"
                    className="text-accent font-bold hover:underline shrink-0"
                  >
                    View Rulebook &amp; Terms →
                  </Link>
                </div>

                {/* Rules Consent Checkbox */}
                <div
                  id="field-agreedRules"
                  className={`rounded-xl border p-4 sm:p-5 transition-colors ${fieldErrors.agreedRules ? "border-danger bg-danger/5" : "border-line bg-accent/5"}`}
                  role="group"
                  aria-labelledby="agreedRules-label"
                  aria-describedby={fieldErrors.agreedRules ? 'agreedRules-error' : undefined}
                >
                  <span id="agreedRules-label" className={labelClass}>
                    League Rules &amp; Terms Consent {requiredMark}
                  </span>
                  <p className="text-xs text-foreground-secondary mb-3 leading-relaxed">
                    By applying on behalf of your school, you confirm that your club officers and members will abide by EZ Esports league rules, competitive integrity guidelines, and sportsmanship policies.
                  </p>
                  <label className="flex items-center gap-2.5 cursor-pointer text-sm font-semibold text-foreground-secondary hover:text-foreground transition-colors">
                    <input
                      type="checkbox"
                      checked={form.agreedRules}
                      onChange={(e) => handleRulesChange(e.target.checked)}
                      className="w-4.5 h-4.5 rounded border-line accent-accent cursor-pointer"
                      aria-invalid={!!fieldErrors.agreedRules}
                      aria-describedby={fieldErrors.agreedRules ? 'agreedRules-error' : undefined}
                    />
                    <span>I understand and agree to uphold the <Link href="/rules" target="_blank" className="text-accent font-bold hover:underline">league rules and terms of participation</Link>.</span>
                  </label>
                  {fieldErrors.agreedRules && (
                    <p id="agreedRules-error" className="mt-2 text-xs text-danger font-semibold">{fieldErrors.agreedRules}</p>
                  )}
                </div>

                {/* Submit Action Bar */}
                <div className="flex flex-col gap-3 pt-4 border-t border-line/50">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <Button
                      type="submit"
                      disabled={loading}
                      className="w-full sm:w-auto min-h-[46px] shadow-lg shadow-accent/5 hover:shadow-accent/20 hover:scale-[1.02] transition-all"
                    >
                      {loading ? 'Submitting…' : 'Submit Application'}
                    </Button>

                    <button
                      type="button"
                      onClick={() => {
                        setForm(initialForm);
                        setFieldErrors({});
                      }}
                      className="text-xs text-foreground-muted hover:text-foreground hover:underline font-semibold focus:outline-none transition-colors duration-200 cursor-pointer"
                    >
                      Clear Form Responses
                    </button>
                  </div>

                  {error && (
                    <p role="alert" className="text-danger text-sm font-semibold mt-2">{error}</p>
                  )}
                </div>
              </div>
            </form>
          </div>
        )}
      </div>
    </section>
  );
}

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button as AriaButton, FieldError, FileTrigger, Label, Radio, RadioGroup, Text } from 'react-aria-components';
import Button from '@/app/components/ui/Button';
import { Input, Textarea } from '@/app/components/ui/form';
import { ROUTES, SITE_CONFIG, SOCIAL_LINKS } from '@/app/lib/constants';
import {
  buildStaffApplicationDetails,
  GAME_DIRECTOR_POSITIONS,
  GAME_REGULATIONS_ROLE,
  LINKEDIN_URL_ERROR,
  normalizeLinkedInUrl,
  requiresGameDirector,
  STAFF_ROLES,
  UNPAID_VOLUNTEER_ACK_TEXT,
  WORK_SAMPLES_MAX_LENGTH,
} from '@/app/lib/staff-application-form';
import { checkResumeFile, formatBytes, RESUME_ACCEPT, RESUME_MAX_BYTES } from '@/app/lib/staff-resume';

const TWITCH_URL = SOCIAL_LINKS.find((l) => l.platform === 'twitch')?.url;

const initialForm = {
  name: '',
  preferredFirstName: '',
  email: '',
  phone: '',
  discordTag: '',
  role: '', // Primary role of interest
  gameDirector: '', // Follow-up when role is the Game Regulations Division
  message: '', // Why you want to join
  linkedin: '', // Optional; linkedin.com links only
  workSamples: '', // Optional links to GitHub, portfolio, designs
  availability: '', // hours per week
  agreedToTerms: false,
  agreedToPrivacy: false,
  acknowledgedUnpaidVolunteer: false,
};

type ConsentField = 'agreedToTerms' | 'agreedToPrivacy' | 'acknowledgedUnpaidVolunteer';

const SECTIONS = [
  { id: 'applicant', num: 1, title: 'Your Information', desc: 'How we can reach you.' },
  { id: 'role', num: 2, title: 'Role & Resume', desc: 'What you want to do, your resume, and your links.' },
  { id: 'experience', num: 3, title: 'Experience & Why', desc: 'Tell us about yourself in about 4-7 sentences.' },
  { id: 'review', num: 4, title: 'Review & Submit', desc: 'Agree to terms and send it in.' },
] as const;

type SectionId = (typeof SECTIONS)[number]['id'];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function StaffApplyForm() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<SectionId>('applicant');

  const [form, setForm] = useState(initialForm);
  // Kept apart from `form`: a File cannot go into the `details` JSON, and it
  // travels as its own multipart part.
  const [resume, setResume] = useState<File | null>(null);

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
    applicant: [!!form.name.trim(), EMAIL_RE.test(form.email), !!form.phone.trim()],
    role: [
      !!form.role,
      ...(requiresGameDirector(form.role) ? [!!form.gameDirector] : []),
      !!resume && !checkResumeFile(resume),
      !!form.availability,
    ],
    experience: [!!form.message.trim()],
    review: [form.agreedToTerms, form.agreedToPrivacy, form.acknowledgedUnpaidVolunteer],
  };

  const sectionComplete = (id: SectionId) => requiredChecks[id].every(Boolean);
  const allChecks = Object.values(requiredChecks).flat();
  const progress = Math.round((allChecks.filter(Boolean).length / allChecks.length) * 100);

  const scrollToSection = (id: SectionId) => {
    document.getElementById(`section-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const validate = () => {
    const errors: Record<string, string> = {};
    if (!form.name.trim()) errors.name = 'Full name is required.';
    if (!form.email.trim()) errors.email = 'Email address is required.';
    else if (!EMAIL_RE.test(form.email)) errors.email = 'Enter a valid email address.';
    if (!form.phone.trim()) errors.phone = 'Phone number is required.';
    if (!form.role) errors.role = 'Please select a primary role.';
    else if (requiresGameDirector(form.role) && !form.gameDirector) {
      errors.gameDirector = 'Please choose which game director position you want.';
    }
    const resumeError = checkResumeFile(resume);
    if (resumeError) errors.resume = resumeError;
    if (normalizeLinkedInUrl(form.linkedin) === null) errors.linkedin = LINKEDIN_URL_ERROR;
    if (!form.availability) errors.availability = 'Please select your weekly availability.';
    if (!form.message.trim()) errors.message = 'Please tell us why you want to join EZ Esports.';
    if (!form.agreedToTerms) errors.agreedToTerms = 'You must agree to the Terms of Service.';
    if (!form.agreedToPrivacy) errors.agreedToPrivacy = 'You must agree to the Privacy Policy.';
    if (!form.acknowledgedUnpaidVolunteer) {
      errors.acknowledgedUnpaidVolunteer = 'Please confirm you understand this is an unpaid volunteer position.';
    }

    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      // Scroll to the first error
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
      const body = new FormData();
      body.set('name', form.name);
      body.set('preferredFirstName', form.preferredFirstName);
      body.set('email', form.email);
      body.set('phone', form.phone);
      body.set('discordTag', form.discordTag);
      body.set('role', form.role);
      body.set('details', JSON.stringify(buildStaffApplicationDetails(form)));
      if (resume) body.set('resume', resume, resume.name);

      // No Content-Type header: the browser sets the multipart boundary.
      const res = await fetch('/api/apply/staff', { method: 'POST', body });
      if (!res.ok) {
        // 4xx responses carry an applicant-facing reason (bad PDF, too many
        // attempts); anything else falls back to the generic message.
        const data = await res.json().catch(() => null);
        const reason = res.status < 500 && typeof data?.error === 'string' ? data.error : null;
        throw new Error(reason ?? '');
      }
      setSubmitted(true);
    } catch (err) {
      const reason = err instanceof Error && err.message ? err.message : null;
      setError(
        reason
          ? `${reason} If this keeps happening, email us at info@ezesports.org.`
          : 'Something went wrong. Please try again or email us at info@ezesports.org.',
      );
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

  const handleSelectChange = (name: string, value: string) => {
    setForm((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const handleResumeSelect = (files: FileList | null) => {
    const file = files?.[0] ?? null;
    if (!file) return; // Cancelled picker: keep whatever was chosen before.
    setResume(file);
    const problem = checkResumeFile(file);
    setFieldErrors((prev) => {
      const next = { ...prev };
      if (problem) next.resume = problem;
      else delete next.resume;
      return next;
    });
  };

  const resetForm = () => {
    setForm(initialForm);
    setResume(null);
    setFieldErrors({});
  };

  const handleConsentChange = (field: ConsentField, checked: boolean) => {
    setForm((prev) => ({ ...prev, [field]: checked }));
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
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
      hasError
        ? 'border-danger'
        : isFocused
        ? 'border-accent'
        : 'border-transparent'
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

        {/* Careers-style header */}
        <div className="mb-10 md:mb-14 max-w-3xl">
          <span className="inline-block text-accent uppercase tracking-widest text-xs font-bold mb-3">
            Get Involved
          </span>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight bg-gradient-to-r from-foreground to-accent bg-clip-text text-transparent uppercase">
            Staff Application
          </h1>
          <p className="mt-3 text-base md:text-lg font-bold text-accent leading-snug">
            {SITE_CONFIG.description}
          </p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-4 text-xs font-semibold text-foreground-secondary">
            <span className="inline-flex items-center gap-1.5">
              <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              New York City (Remote / In-Person Events)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Volunteer · Part-time
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
          </div>
          <div className="mt-5 space-y-3 text-foreground-secondary text-sm md:text-base font-medium leading-relaxed">
            <p>
              Founded in 2021 by NYC high school students, EZ Esports runs about 300 interschool esports matches a year
              for thousands of students across dozens of NYCDOE schools, powered by hundreds of student, alumni, and
              teacher volunteers. We&apos;re a{' '}
              {TWITCH_URL ? (
                <a href={TWITCH_URL} target="_blank" rel="noopener noreferrer" className="text-accent font-semibold underline hover:text-accent-secondary">
                  Twitch Partner
                </a>
              ) : (
                'Twitch Partner'
              )}
              , have collaborated with organizations including Roc Nation, Gen.G, and Factor, and are preparing for our
              5th year in 2026–27.
            </p>
            <p>
              We&apos;re opening a small number of project-based roles for people who want real ownership of their work.
              Pick a division in Step 2.
            </p>
          </div>
          <ul className="mt-4 space-y-2 text-sm text-foreground-secondary">
            <li className="flex items-start gap-2">
              <svg className="w-4 h-4 mt-0.5 shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              <span>Responsibilities and time expectations are agreed with you before you join.</span>
            </li>
            <li className="flex items-start gap-2">
              <svg className="w-4 h-4 mt-0.5 shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              <span>
                Part-time and remote-friendly.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <svg className="w-4 h-4 mt-0.5 shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              <span>
                A fit if you care about scholastic esports, want hands-on experience building real systems used by
                thousands of students across NYC, and communicate and follow through.
              </span>
            </li>
          </ul>
          <p className="mt-4 text-sm">
            <Link href={ROUTES.leadership} className="text-accent font-semibold underline hover:text-accent-secondary">
              Meet the people who have led EZ Esports
            </Link>
          </p>
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
                Thank you for applying. We have registered your response. We will review your application and contact you at <strong className="text-foreground">{form.email}</strong> soon.
              </p>
            </div>
            <button
              onClick={() => {
                setSubmitted(false);
                resetForm();
              }}
              className="text-accent hover:underline text-sm font-semibold focus:outline-none cursor-pointer"
            >
              Submit another application
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

            {/* Left rail: sticky scroll-spy navigation + progress */}
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

              {/* What happens next */}
              <div className="hidden lg:block bg-surface/85 backdrop-blur-md rounded-2xl border border-line p-6 shadow-sm">
                <h3 className="text-sm font-bold text-foreground mb-4 uppercase tracking-wider">After You Apply</h3>
                <ol className="relative border-l-2 border-line ml-2.5 pl-5 space-y-5 text-sm">
                  <li className="relative">
                    <span className="absolute -left-[27px] top-1 h-2.5 w-2.5 rounded-full bg-accent ring-4 ring-surface" />
                    <p className="font-bold text-foreground">Application Review</p>
                    <p className="text-xs text-foreground-muted mt-0.5">We will review your application details, skills, and resume.</p>
                  </li>
                  <li className="relative">
                    <span className="absolute -left-[27px] top-1 h-2.5 w-2.5 rounded-full bg-line ring-4 ring-surface" />
                    <p className="font-bold text-foreground">Interview / Sync Call</p>
                    <p className="text-xs text-foreground-muted mt-0.5">A short chat to find the perfect fit and check availability.</p>
                  </li>
                  <li className="relative">
                    <span className="absolute -left-[27px] top-1 h-2.5 w-2.5 rounded-full bg-line ring-4 ring-surface" />
                    <p className="font-bold text-foreground">Onboarding</p>
                    <p className="text-xs text-foreground-muted mt-0.5">Get set up with team channels, roles, and training!</p>
                  </li>
                </ol>
              </div>

              {/* Assistance */}
              <div className="hidden lg:block bg-surface/85 backdrop-blur-md rounded-2xl border border-line p-6 shadow-sm">
                <h3 className="text-xs font-bold text-foreground mb-2 uppercase tracking-wider">Have Questions?</h3>
                <p className="text-xs text-foreground-muted mb-3 leading-relaxed">
                  Unsure about roles, qualifications, or requirements? Email us anytime.
                </p>
                <a href="mailto:info@ezesports.org" className="text-xs text-accent hover:underline font-bold transition-all">
                  info@ezesports.org
                </a>
              </div>
            </aside>

            {/* Right column: sectioned form */}
            <form onSubmit={handleSubmit} className="lg:col-span-8 space-y-6" noValidate>

              {/* Step 1: Your Information */}
              <div id="section-applicant" className={sectionCardClass}>
                {sectionHeader('applicant')}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Full name */}
                  <div id="field-name" className={fieldWrapperClass('name', !!fieldErrors.name)}>
                    <label htmlFor="name" className={labelClass}>Full name {requiredMark}</label>
                    <input
                      id="name"
                      name="name"
                      type="text"
                      placeholder="Jane Smith"
                      value={form.name}
                      onChange={handleTextChange}
                      onFocus={() => setFocusedField('name')}
                      onBlur={() => setFocusedField(null)}
                      className={textInputClass(!!fieldErrors.name)}
                      required
                      aria-invalid={!!fieldErrors.name}
                      aria-describedby={fieldErrors.name ? 'name-error' : undefined}
                    />
                    {fieldErrors.name && (
                      <p id="name-error" className="mt-1.5 text-xs text-danger font-semibold">{fieldErrors.name}</p>
                    )}
                  </div>

                  {/* Preferred first name */}
                  <div id="field-preferredFirstName" className={fieldWrapperClass('preferredFirstName', false)}>
                    <label htmlFor="preferredFirstName" className={labelClass}>Preferred first name</label>
                    <Input
                      id="preferredFirstName"
                      name="preferredFirstName"
                      type="text"
                      placeholder="Preferred name"
                      value={form.preferredFirstName}
                      onChange={handleTextChange}
                      onFocus={() => setFocusedField('preferredFirstName')}
                      onBlur={() => setFocusedField(null)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Email address */}
                  <div id="field-email" className={fieldWrapperClass('email', !!fieldErrors.email)}>
                    <label htmlFor="email" className={labelClass}>Email address {requiredMark}</label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="jsmith@domain.com"
                      value={form.email}
                      onChange={handleTextChange}
                      onFocus={() => setFocusedField('email')}
                      onBlur={() => setFocusedField(null)}
                      className={textInputClass(!!fieldErrors.email)}
                      required
                      aria-invalid={!!fieldErrors.email}
                      aria-describedby={fieldErrors.email ? 'email-error' : undefined}
                    />
                    {fieldErrors.email && (
                      <p id="email-error" className="mt-1.5 text-xs text-danger font-semibold">{fieldErrors.email}</p>
                    )}
                  </div>

                  {/* Phone number */}
                  <div id="field-phone" className={fieldWrapperClass('phone', !!fieldErrors.phone)}>
                    <label htmlFor="phone" className={labelClass}>Phone number {requiredMark}</label>
                    <input
                      id="phone"
                      name="phone"
                      type="text"
                      placeholder="(555) 555-5555"
                      value={form.phone}
                      onChange={handleTextChange}
                      onFocus={() => setFocusedField('phone')}
                      onBlur={() => setFocusedField(null)}
                      className={textInputClass(!!fieldErrors.phone)}
                      required
                      aria-invalid={!!fieldErrors.phone}
                      aria-describedby={fieldErrors.phone ? 'phone-error' : undefined}
                    />
                    {fieldErrors.phone && (
                      <p id="phone-error" className="mt-1.5 text-xs text-danger font-semibold">{fieldErrors.phone}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Discord username */}
                  <div id="field-discordTag" className={fieldWrapperClass('discordTag', false)}>
                    <label htmlFor="discordTag" className={labelClass}>Discord username</label>
                    <Input
                      id="discordTag"
                      name="discordTag"
                      type="text"
                      placeholder="username"
                      value={form.discordTag}
                      onChange={handleTextChange}
                      onFocus={() => setFocusedField('discordTag')}
                      onBlur={() => setFocusedField(null)}
                    />
                  </div>
                </div>
              </div>

              {/* Step 2: Role & Links */}
              <div id="section-role" className={sectionCardClass}>
                {sectionHeader('role')}

                {/* Primary role of interest */}
                <div
                  id="field-role"
                  className={fieldWrapperClass('role', !!fieldErrors.role)}
                  role="group"
                  aria-labelledby="role-label"
                  aria-describedby={fieldErrors.role ? 'role-error' : undefined}
                >
                  <span id="role-label" className={labelClass}>Primary Role of Interest {requiredMark}</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {STAFF_ROLES.map((roleOption) => (
                      <label key={roleOption} className="flex items-center gap-2.5 cursor-pointer text-sm font-semibold text-foreground-secondary hover:text-foreground transition-colors">
                        <input
                          type="radio"
                          name="role"
                          value={roleOption}
                          checked={form.role === roleOption}
                          onChange={() => handleSelectChange('role', roleOption)}
                          className="w-4.5 h-4.5 accent-accent cursor-pointer"
                          aria-describedby={roleOption === GAME_REGULATIONS_ROLE ? 'game-regulations-note' : undefined}
                        />
                        <span>{roleOption}</span>
                      </label>
                    ))}
                  </div>
                  {fieldErrors.role && (
                    <p id="role-error" className="mt-2 text-xs text-danger font-semibold">{fieldErrors.role}</p>
                  )}
                  <span id="game-regulations-note" className="sr-only">
                    Choosing this adds a follow-up question right after this list.
                  </span>
                </div>

                {/* Game Regulations follow-up. Rendered only while that division
                    is selected, directly after the role list in DOM order, so
                    keyboard and screen-reader users reach it next; the radio's
                    description tells them it is coming. */}
                {requiresGameDirector(form.role) && (
                  <RadioGroup
                    id="field-gameDirector"
                    value={form.gameDirector || null}
                    onChange={(value) => handleSelectChange('gameDirector', value)}
                    isRequired
                    isInvalid={!!fieldErrors.gameDirector}
                    validationBehavior="aria"
                    className={`ml-3 rounded-xl border bg-accent/5 p-4 sm:p-5 ${fieldErrors.gameDirector ? 'border-danger' : 'border-line'}`}
                  >
                    <Label className={labelClass}>Which game director position? {requiredMark}</Label>
                    <Text slot="description" className="block text-xs text-foreground-secondary mb-2">
                      Pick the game you want to direct.
                    </Text>
                    <div className="flex flex-col sm:flex-row sm:flex-wrap sm:gap-x-6">
                      {GAME_DIRECTOR_POSITIONS.map((position) => (
                        <Radio
                          key={position}
                          value={position}
                          className="group flex min-h-[44px] items-center gap-2.5 cursor-pointer text-sm font-semibold text-foreground-secondary outline-none transition-colors data-[hovered]:text-foreground data-[selected]:text-foreground"
                        >
                          <span
                            aria-hidden="true"
                            className="h-4.5 w-4.5 shrink-0 rounded-full border-2 border-foreground-muted bg-surface transition-all group-data-[selected]:border-[5px] group-data-[selected]:border-accent group-data-[focus-visible]:ring-2 group-data-[focus-visible]:ring-accent/40 group-data-[focus-visible]:ring-offset-1"
                          />
                          {position}
                        </Radio>
                      ))}
                    </div>
                    <FieldError className="mt-2 block text-xs text-danger font-semibold">{fieldErrors.gameDirector}</FieldError>
                  </RadioGroup>
                )}

                {/* Resume (required PDF). FileTrigger keeps the native file input
                    hidden and lets an RAC Button open it, so the control is
                    keyboard/touch accessible and matches the form's styling. */}
                <div id="field-resume" className={fieldWrapperClass('resume', !!fieldErrors.resume)}>
                  <span id="resume-label" className={labelClass}>Resume (PDF) {requiredMark}</span>
                  <p id="resume-hint" className="text-xs text-foreground-secondary mb-3">
                    Attach your resume as a PDF, up to {formatBytes(RESUME_MAX_BYTES)}.
                  </p>
                  <div className="flex flex-wrap items-center gap-3">
                    <FileTrigger acceptedFileTypes={RESUME_ACCEPT.split(',')} onSelect={handleResumeSelect}>
                      <AriaButton
                        id="resume"
                        aria-labelledby="resume-label resume"
                        aria-describedby={['resume-hint', 'resume-status', fieldErrors.resume ? 'resume-error' : null]
                          .filter(Boolean)
                          .join(' ')}
                        onFocus={() => setFocusedField('resume')}
                        onBlur={() => setFocusedField(null)}
                        className={`inline-flex min-h-[44px] items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-bold text-foreground bg-surface shadow-sm transition-colors cursor-pointer outline-none data-[hovered]:bg-accent/5 data-[focus-visible]:ring-2 data-[focus-visible]:ring-accent/40 ${
                          fieldErrors.resume ? 'border-danger' : 'border-line data-[hovered]:border-accent/50'
                        }`}
                      >
                        <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 4v12m0-12l-4 4m4-4l4 4" />
                        </svg>
                        {resume ? 'Replace PDF' : 'Choose PDF'}
                      </AriaButton>
                    </FileTrigger>
                    <span
                      id="resume-status"
                      aria-live="polite"
                      className={`min-w-0 break-all text-sm ${resume ? 'font-semibold text-foreground' : 'text-foreground-muted'}`}
                    >
                      {resume ? `${resume.name} (${formatBytes(resume.size)})` : 'No file chosen'}
                    </span>
                  </div>
                  {fieldErrors.resume && (
                    <p id="resume-error" className="mt-1.5 text-xs text-danger font-semibold">{fieldErrors.resume}</p>
                  )}
                </div>

                {/* LinkedIn (optional) */}
                <div id="field-linkedin" className={fieldWrapperClass('linkedin', !!fieldErrors.linkedin)}>
                  <label htmlFor="linkedin" className={labelClass}>LinkedIn profile</label>
                  <input
                    id="linkedin"
                    name="linkedin"
                    type="url"
                    inputMode="url"
                    autoComplete="url"
                    placeholder="https://linkedin.com/in/username"
                    value={form.linkedin}
                    onChange={handleTextChange}
                    onFocus={() => setFocusedField('linkedin')}
                    onBlur={() => setFocusedField(null)}
                    className={textInputClass(!!fieldErrors.linkedin)}
                    aria-invalid={!!fieldErrors.linkedin}
                    aria-describedby={fieldErrors.linkedin ? 'linkedin-error' : undefined}
                  />
                  {fieldErrors.linkedin && (
                    <p id="linkedin-error" className="mt-1.5 text-xs text-danger font-semibold">{fieldErrors.linkedin}</p>
                  )}
                </div>

                {/* Other links (optional) */}
                <div id="field-workSamples" className={fieldWrapperClass('workSamples', false)}>
                  <label htmlFor="workSamples" className={labelClass}>Other links</label>
                  <p id="workSamples-hint" className="text-xs text-foreground-secondary mb-2">
                    Optional. GitHub, a portfolio, designs, videos, or anything else that shows your work.
                  </p>
                  <input
                    id="workSamples"
                    name="workSamples"
                    type="text"
                    placeholder="https://github.com/username, https://yourportfolio.com"
                    value={form.workSamples}
                    onChange={handleTextChange}
                    onFocus={() => setFocusedField('workSamples')}
                    onBlur={() => setFocusedField(null)}
                    maxLength={WORK_SAMPLES_MAX_LENGTH}
                    className={textInputClass(false)}
                    aria-describedby="workSamples-hint"
                  />
                </div>

                {/* Weekly availability */}
                <div
                  id="field-availability"
                  className={fieldWrapperClass('availability', !!fieldErrors.availability)}
                  role="group"
                  aria-labelledby="availability-label"
                  aria-describedby={fieldErrors.availability ? 'availability-error' : undefined}
                >
                  <span id="availability-label" className={labelClass}>Expected Weekly Time Commitment {requiredMark}</span>
                  <div className="flex flex-wrap gap-4 mt-2">
                    {['5hrs', '10hrs', '15hrs', '20hrs', '30hrs'].map((hours) => (
                      <label key={hours} className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-foreground-secondary hover:text-foreground transition-colors">
                        <input
                          type="radio"
                          name="availability"
                          value={hours}
                          checked={form.availability === hours}
                          onChange={() => handleSelectChange('availability', hours)}
                          className="w-4.5 h-4.5 accent-accent cursor-pointer"
                        />
                        <span>{hours}</span>
                      </label>
                    ))}
                  </div>
                  {fieldErrors.availability && (
                    <p id="availability-error" className="mt-2 text-xs text-danger font-semibold">{fieldErrors.availability}</p>
                  )}
                </div>
              </div>

              {/* Step 3: Experience & Background */}
              <div id="section-experience" className={sectionCardClass}>
                {sectionHeader('experience')}

                <div id="field-message" className={fieldWrapperClass('message', !!fieldErrors.message)}>
                  <label htmlFor="message" className={labelClass}>
                    Why do you want to join EZ Esports? (approx. 4-7 sentences) {requiredMark}
                  </label>
                  <Textarea
                    id="message"
                    name="message"
                    rows={6}
                    placeholder="Include details about any relevant experience (e.g. running esports clubs, moderation, production, coding, graphic design) and what excites you about our mission (approx. 4-7 sentences)..."
                    value={form.message}
                    onChange={handleTextChange}
                    onFocus={() => setFocusedField('message')}
                    onBlur={() => setFocusedField(null)}
                    className={fieldErrors.message ? 'border-danger focus:ring-danger/20' : ''}
                    required
                    aria-invalid={!!fieldErrors.message}
                    aria-describedby={fieldErrors.message ? 'message-error' : undefined}
                  />
                  {fieldErrors.message && (
                    <p id="message-error" className="mt-1.5 text-xs text-danger font-semibold">{fieldErrors.message}</p>
                  )}
                </div>
              </div>

              {/* Step 4: Review & Submit */}
              <div id="section-review" className={sectionCardClass}>
                {sectionHeader('review')}

                {/* Guidelines Agreement: split into two independently-required
                    checkboxes (issue #107), mirroring the agreedToTerms/
                    agreedToPrivacy split already shipped for the school form
                    (issue #127, see ClubInfoSection.tsx) — each consent links
                    to its actual document and must be checked on its own. */}
                <div className="rounded-xl border border-line bg-accent/5 p-4 sm:p-5 space-y-4">
                  <span className={labelClass}>
                    Positive Environment Guidelines {requiredMark}
                  </span>
                  <p className="text-xs text-foreground-secondary leading-relaxed">
                    By applying, you commit to maintaining a supportive, inclusive, and fair scholastic esports environment. You agree to follow our staff guidelines, act professionally, and promote youth development across NYC high schools.
                  </p>

                  {/* Terms of Service */}
                  <div
                    id="field-agreedToTerms"
                    className={`border-l-2 pl-3 transition-colors ${fieldErrors.agreedToTerms ? 'border-danger' : 'border-transparent'}`}
                  >
                    <label className="flex items-start gap-2.5 cursor-pointer text-sm font-semibold text-foreground-secondary hover:text-foreground transition-colors">
                      <input
                        type="checkbox"
                        checked={form.agreedToTerms}
                        onChange={(e) => handleConsentChange('agreedToTerms', e.target.checked)}
                        className="w-4.5 h-4.5 mt-0.5 rounded border-line accent-accent cursor-pointer shrink-0"
                        aria-invalid={!!fieldErrors.agreedToTerms}
                        aria-describedby={fieldErrors.agreedToTerms ? 'agreedToTerms-error' : undefined}
                      />
                      <span>
                        I have read and agree to the EZ Esports{' '}
                        <Link
                          href="/terms"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-accent underline hover:text-accent-secondary"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Terms of Service
                        </Link>
                        . {requiredMark}
                      </span>
                    </label>
                    {fieldErrors.agreedToTerms && (
                      <p id="agreedToTerms-error" className="mt-1.5 ml-7 text-xs text-danger font-semibold">{fieldErrors.agreedToTerms}</p>
                    )}
                  </div>

                  {/* Privacy Policy */}
                  <div
                    id="field-agreedToPrivacy"
                    className={`border-l-2 pl-3 transition-colors ${fieldErrors.agreedToPrivacy ? 'border-danger' : 'border-transparent'}`}
                  >
                    <label className="flex items-start gap-2.5 cursor-pointer text-sm font-semibold text-foreground-secondary hover:text-foreground transition-colors">
                      <input
                        type="checkbox"
                        checked={form.agreedToPrivacy}
                        onChange={(e) => handleConsentChange('agreedToPrivacy', e.target.checked)}
                        className="w-4.5 h-4.5 mt-0.5 rounded border-line accent-accent cursor-pointer shrink-0"
                        aria-invalid={!!fieldErrors.agreedToPrivacy}
                        aria-describedby={fieldErrors.agreedToPrivacy ? 'agreedToPrivacy-error' : undefined}
                      />
                      <span>
                        I have read and agree to the EZ Esports{' '}
                        <Link
                          href="/privacy"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-accent underline hover:text-accent-secondary"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Privacy Policy
                        </Link>
                        . {requiredMark}
                      </span>
                    </label>
                    {fieldErrors.agreedToPrivacy && (
                      <p id="agreedToPrivacy-error" className="mt-1.5 ml-7 text-xs text-danger font-semibold">{fieldErrors.agreedToPrivacy}</p>
                    )}
                  </div>

                  {/* Unpaid volunteer acknowledgement */}
                  <div
                    id="field-acknowledgedUnpaidVolunteer"
                    className={`border-l-2 pl-3 transition-colors ${fieldErrors.acknowledgedUnpaidVolunteer ? 'border-danger' : 'border-transparent'}`}
                  >
                    <label className="flex items-start gap-2.5 cursor-pointer text-sm font-semibold text-foreground-secondary hover:text-foreground transition-colors">
                      <input
                        type="checkbox"
                        checked={form.acknowledgedUnpaidVolunteer}
                        onChange={(e) => handleConsentChange('acknowledgedUnpaidVolunteer', e.target.checked)}
                        className="w-4.5 h-4.5 mt-0.5 rounded border-line accent-accent cursor-pointer shrink-0"
                        aria-invalid={!!fieldErrors.acknowledgedUnpaidVolunteer}
                        aria-describedby={fieldErrors.acknowledgedUnpaidVolunteer ? 'acknowledgedUnpaidVolunteer-error' : undefined}
                      />
                      <span>
                        {UNPAID_VOLUNTEER_ACK_TEXT} {requiredMark}
                      </span>
                    </label>
                    {fieldErrors.acknowledgedUnpaidVolunteer && (
                      <p id="acknowledgedUnpaidVolunteer-error" className="mt-1.5 ml-7 text-xs text-danger font-semibold">{fieldErrors.acknowledgedUnpaidVolunteer}</p>
                    )}
                  </div>
                </div>

                {/* Submit button & reset */}
                <div className="flex flex-col gap-3 pt-2 border-t border-line/50">
                  <div className="flex flex-wrap items-center justify-between gap-4 pt-4">
                    <Button
                      type="submit"
                      disabled={loading}
                      className="w-full sm:w-auto min-h-[46px] shadow-lg shadow-accent/5 hover:shadow-accent/20 hover:scale-[1.02] transition-all"
                    >
                      {loading ? 'Submitting…' : 'Submit Staff Application'}
                    </Button>

                    <button
                      type="button"
                      onClick={resetForm}
                      className="text-xs text-foreground-muted hover:text-foreground hover:underline font-semibold focus:outline-none transition-colors duration-200"
                    >
                      Clear Form Response
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

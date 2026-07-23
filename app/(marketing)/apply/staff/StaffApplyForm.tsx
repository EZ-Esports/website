'use client';

import { useEffect, useState } from 'react';
import Button from '@/app/components/ui/Button';
import { Input, Textarea } from '@/app/components/ui/form';

const initialForm = {
  name: '',
  preferredFirstName: '',
  email: '',
  phone: '',
  discordTag: '',
  role: '', // Primary role of interest
  roleOther: '',
  message: '', // Experience, skills, why you want to join
  linkedin: '', // Resume / Portfolio / LinkedIn link
  availability: '', // hours per week
  agreedRules: false,
};

const SECTIONS = [
  { id: 'applicant', num: 1, title: 'Your Information', desc: 'How we can reach you.' },
  { id: 'role', num: 2, title: 'Role & Links', desc: 'What you want to do and your links.' },
  { id: 'experience', num: 3, title: 'Experience & Why', desc: 'Tell us about your background.' },
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
      !!form.role && (form.role !== 'Other' || !!form.roleOther.trim()),
      !!form.availability
    ],
    experience: [!!form.message.trim()],
    review: [form.agreedRules],
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
    if (form.role === 'Other' && !form.roleOther.trim()) errors.role = 'Please specify your other role.';
    if (!form.availability) errors.availability = 'Please select your weekly availability.';
    if (!form.message.trim()) errors.message = 'Please provide details about your background and experience.';
    if (!form.agreedRules) errors.agreedRules = 'You must agree to the positive environment guidelines.';

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

    const compiledRole = form.role === 'Other' ? `Other: ${form.roleOther}` : form.role;
    const compiledMessage = `
Preferred first name: ${form.preferredFirstName || 'N/A'}
Phone number: ${form.phone || 'N/A'}
Discord tag: ${form.discordTag || 'N/A'}
LinkedIn / Portfolio: ${form.linkedin || 'N/A'}
Weekly availability: ${form.availability}

Background & Motivation:
${form.message}
`.trim();

    try {
      const res = await fetch('/api/apply/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          preferredFirstName: form.preferredFirstName,
          email: form.email,
          phone: form.phone,
          discordTag: form.discordTag,
          role: compiledRole,
          message: compiledMessage,
        }),
      });
      if (!res.ok) throw new Error('Submission failed');
      setSubmitted(true);
    } catch {
      setError('Something went wrong. Please try again or email us at info@ezesports.org.');
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
          <p className="text-foreground-secondary text-sm md:text-base mt-5 font-medium leading-relaxed">
            Help shape the future of scholastic esports in NYC. Join a team of passionate high school club officers, alumni, and volunteers dedicated to making gaming competitive, supportive, and accessible for every student.
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
                setForm(initialForm);
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
                    <p className="text-xs text-foreground-muted mt-0.5">We will review your application details, skills, and portfolio.</p>
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
                    {[
                      'Tournament Organizer / Administrator',
                      'Production Crew / Shoutcaster',
                      'Web Development & Tech Support',
                      'Social Media & Marketing Specialist',
                      'Graphic Design / Video Editor',
                      'Community Moderator',
                    ].map((roleOption) => (
                      <label key={roleOption} className="flex items-center gap-2.5 cursor-pointer text-sm font-semibold text-foreground-secondary hover:text-foreground transition-colors">
                        <input
                          type="radio"
                          name="role"
                          value={roleOption}
                          checked={form.role === roleOption}
                          onChange={() => handleSelectChange('role', roleOption)}
                          className="w-4.5 h-4.5 accent-accent cursor-pointer"
                        />
                        <span>{roleOption}</span>
                      </label>
                    ))}

                    {/* Other option inline */}
                    <div className="sm:col-span-2 flex items-center gap-2">
                      <label className="flex items-center gap-2.5 cursor-pointer text-sm font-semibold text-foreground-secondary hover:text-foreground transition-colors shrink-0">
                        <input
                          type="radio"
                          name="role"
                          value="Other"
                          checked={form.role === 'Other'}
                          onChange={() => handleSelectChange('role', 'Other')}
                          className="w-4.5 h-4.5 accent-accent cursor-pointer"
                        />
                        <span>Other:</span>
                      </label>
                      {form.role === 'Other' && (
                        <input
                          type="text"
                          placeholder="Please specify role"
                          value={form.roleOther}
                          onChange={handleTextChange}
                          name="roleOther"
                          className="border-b border-line focus:border-b-2 focus:border-accent focus:outline-none py-0.5 text-xs bg-transparent flex-1 text-foreground"
                        />
                      )}
                    </div>
                  </div>
                  {fieldErrors.role && (
                    <p id="role-error" className="mt-2 text-xs text-danger font-semibold">{fieldErrors.role}</p>
                  )}
                </div>

                {/* LinkedIn / Resume / Portfolio link */}
                <div id="field-linkedin" className={fieldWrapperClass('linkedin', false)}>
                  <label htmlFor="linkedin" className={labelClass}>LinkedIn profile or Portfolio/Resume link</label>
                  <Input
                    id="linkedin"
                    name="linkedin"
                    type="text"
                    placeholder="https://linkedin.com/in/username or https://portfolio.com"
                    value={form.linkedin}
                    onChange={handleTextChange}
                    onFocus={() => setFocusedField('linkedin')}
                    onBlur={() => setFocusedField(null)}
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
                    {['< 2 hours', '2-5 hours', '5-10 hours', '10+ hours'].map((hours) => (
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
                    Tell us about your background, skills, and why you want to join EZ Esports {requiredMark}
                  </label>
                  <Textarea
                    id="message"
                    name="message"
                    rows={6}
                    placeholder="Include details about any relevant experience (e.g. running esports clubs, moderation, production, coding, graphic design) and what excites you about our mission..."
                    value={form.message}
                    onChange={handleTextChange}
                    onFocus={() => setFocusedField('message')}
                    onBlur={() => setFocusedField(null)}
                    className={fieldErrors.message ? 'border-danger focus:ring-danger/20' : ''}
                    required
                  />
                  {fieldErrors.message && (
                    <p id="message-error" className="mt-1.5 text-xs text-danger font-semibold">{fieldErrors.message}</p>
                  )}
                </div>
              </div>

              {/* Step 4: Review & Submit */}
              <div id="section-review" className={sectionCardClass}>
                {sectionHeader('review')}

                {/* Guidelines Agreement */}
                <div
                  id="field-agreedRules"
                  className={`rounded-xl border p-4 sm:p-5 transition-colors ${
                    fieldErrors.agreedRules ? 'border-danger bg-danger/5' : 'border-line bg-accent/5'
                  }`}
                  role="group"
                  aria-labelledby="agreedRules-label"
                  aria-describedby={fieldErrors.agreedRules ? 'agreedRules-error' : undefined}
                >
                  <span id="agreedRules-label" className={labelClass}>
                    Positive Environment Guidelines {requiredMark}
                  </span>
                  <p className="text-xs text-foreground-secondary mb-3 leading-relaxed">
                    By applying, you commit to maintaining a supportive, inclusive, and fair scholastic esports environment. You agree to follow our staff guidelines, act professionally, and promote youth development across NYC high schools.
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
                    <span>I understand and agree to uphold these values.</span>
                  </label>
                  {fieldErrors.agreedRules && (
                    <p id="agreedRules-error" className="mt-2 text-xs text-danger font-semibold">{fieldErrors.agreedRules}</p>
                  )}
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
                      onClick={() => {
                        setForm(initialForm);
                        setFieldErrors({});
                      }}
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

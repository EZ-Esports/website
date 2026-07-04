'use client';

import { useEffect, useState } from 'react';
import Button from '@/app/components/ui/Button';

const initialForm = {
  name: '',
  preferredFirstName: '',
  email: '',
  phone: '',
  discordTag: '',
  school: '',
  schoolCode: '',
  location: '', // Bronx, Queens, Manhattan, Brooklyn, Staten Island, Other
  locationOther: '',
  role: '',
  learnSource: '', // LinkedIn, Instagram, Twitch, Youtube, Web search, Friend/teacher/parent, Other
  learnSourceOther: '',
  linkedin: '',
  captainsCoaches: '',
  teamInfo: '',
  needPlayerHelp: '', // Yes, No
  commPlatforms: {
    email: false,
    discord: false,
    text: false,
  },
  divisions: {
    tft: false,
    tetris: false,
    lol: false,
    valorant: false,
  },
  agreedRules: false,
  additionalShare: '',
};

const SECTIONS = [
  { id: 'applicant', num: 1, title: 'Your Information', desc: 'How we can reach you during onboarding.' },
  { id: 'school', num: 2, title: 'School Information', desc: 'Tell us which campus you represent.' },
  { id: 'team', num: 3, title: 'Team Details', desc: 'Coaches, captains, and roster status.' },
  { id: 'preferences', num: 4, title: 'League Preferences', desc: 'Divisions and how you want to communicate.' },
  { id: 'review', num: 5, title: 'Review & Submit', desc: 'Agree to the rules and send it in.' },
] as const;

type SectionId = (typeof SECTIONS)[number]['id'];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ApplyForm() {
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
    school: [
      !!form.school.trim(),
      !!form.location && (form.location !== 'Other' || !!form.locationOther.trim()),
      !!form.role.trim(),
    ],
    team: [!!form.needPlayerHelp],
    preferences: [
      !!form.learnSource && (form.learnSource !== 'Other' || !!form.learnSourceOther.trim()),
      Object.values(form.commPlatforms).some((v) => v),
      Object.values(form.divisions).some((v) => v),
    ],
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
    if (!form.school.trim()) errors.school = 'School name is required.';
    if (!form.location) errors.location = 'Please select your school location.';
    if (form.location === 'Other' && !form.locationOther.trim()) errors.location = 'Please specify other location.';
    if (!form.role.trim()) errors.role = 'Please specify your role within your school.';
    if (!form.learnSource) errors.learnSource = 'Please specify how you learned about us.';
    if (form.learnSource === 'Other' && !form.learnSourceOther.trim()) errors.learnSource = 'Please specify other learn source.';
    if (!form.needPlayerHelp) errors.needPlayerHelp = 'Please select if you need help finding players.';

    const hasComm = Object.values(form.commPlatforms).some(v => v);
    if (!hasComm) errors.commPlatforms = 'Please select at least one preferred communication platform.';

    const hasDiv = Object.values(form.divisions).some(v => v);
    if (!hasDiv) errors.divisions = 'Please select at least one division you want to compete in.';

    if (!form.agreedRules) errors.agreedRules = 'You must agree to the rules and terms of service.';

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

    const compiledMessage = `
Preferred first name: ${form.preferredFirstName || 'N/A'}
Phone number: ${form.phone || 'N/A'}
Discord tag: ${form.discordTag || 'N/A'}
School code: ${form.schoolCode || 'N/A'}
School location: ${form.location === 'Other' ? `Other: ${form.locationOther}` : form.location}
How did you learn about us: ${form.learnSource === 'Other' ? `Other: ${form.learnSourceOther}` : form.learnSource}
LinkedIn profile: ${form.linkedin || 'N/A'}

Captains / Coaches:
${form.captainsCoaches || 'N/A'}

Anything to know about team:
${form.teamInfo || 'N/A'}

Need help finding players: ${form.needPlayerHelp}
Preferred communication platform: ${Object.keys(form.commPlatforms).filter(k => form.commPlatforms[k as keyof typeof form.commPlatforms]).join(', ')}
Interested Divisions: ${Object.keys(form.divisions).filter(k => form.divisions[k as keyof typeof form.divisions]).join(', ')}
Rules Agreement: ${form.agreedRules ? 'Agreed' : 'Disagreed'}

Additional Notes:
${form.additionalShare || 'N/A'}
`.trim();

    try {
      const res = await fetch('/api/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicantName: form.name,
          schoolName: form.school,
          role: form.role,
          email: form.email,
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

  const handleCheckboxChange = (group: 'commPlatforms' | 'divisions', name: string, checked: boolean) => {
    setForm((prev) => ({
      ...prev,
      [group]: {
        ...prev[group],
        [name]: checked,
      },
    }));
    if (fieldErrors[group]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[group];
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
    `w-full px-4 py-3 bg-white border rounded-xl text-[#2d0015] placeholder-slate-400 focus:outline-none focus:ring-2 transition-all text-sm shadow-sm ${
      hasError
        ? 'border-red-500 focus:ring-red-500/20'
        : 'border-[#f4cccc] focus:ring-[#b5005a]/20 focus:border-[#b5005a]/50'
    }`;

  const textareaClass = (hasError: boolean) =>
    `w-full p-3 bg-white border rounded-xl text-[#2d0015] placeholder-slate-400 focus:outline-none focus:ring-2 transition-all text-sm resize-y shadow-sm ${
      hasError
        ? 'border-red-500 focus:ring-red-500/20'
        : 'border-[#f4cccc] focus:ring-[#b5005a]/20 focus:border-[#b5005a]/50'
    }`;

  const fieldWrapperClass = (fieldId: string, hasError: boolean) => {
    const isFocused = focusedField === fieldId;
    return `transition-all duration-300 border-l-2 pl-3 w-full ${
      hasError
        ? 'border-red-500'
        : isFocused
        ? 'border-[#b5005a]'
        : 'border-transparent'
    }`;
  };

  const labelClass = 'block text-xs sm:text-sm font-bold text-[#2d0015] mb-2 tracking-wide uppercase';
  const requiredMark = <span className="text-[#b5005a] ml-1" aria-hidden="true">*</span>;

  const sectionCardClass =
    'bg-white/90 backdrop-blur-md rounded-2xl border border-[#f4cccc]/75 p-6 sm:p-8 shadow-sm space-y-5 scroll-mt-28';

  const sectionHeader = (id: SectionId) => {
    const section = SECTIONS.find((s) => s.id === id)!;
    return (
      <div className="border-b border-[#f4cccc]/50 pb-4 mb-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#b5005a] mb-1">
          Step {section.num} of {SECTIONS.length}
        </p>
        <h3 className="text-lg sm:text-xl font-black text-[#2d0015] tracking-tight">{section.title}</h3>
        <p className="text-xs text-[#5e404e] mt-1">{section.desc}</p>
      </div>
    );
  };

  return (
    <section className="min-h-screen bg-gradient-to-br from-[#fff0f5] via-[#ffeef6] to-[#ffdceb] pt-12 md:pt-16 pb-16 md:pb-24 relative z-10">
      <div className="container mx-auto px-4 max-w-6xl">

        {/* Careers-style header: title, meta, description, benefits */}
        <div className="mb-10 md:mb-14 max-w-3xl">
          <span className="inline-block text-[#b5005a] uppercase tracking-widest text-xs font-bold mb-3">
            Registration Portal
          </span>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight bg-gradient-to-r from-zinc-900 to-[#b5005a] bg-clip-text text-transparent uppercase">
            School Application
          </h1>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-4 text-xs font-semibold text-[#5e404e]">
            <span className="inline-flex items-center gap-1.5">
              <svg className="w-4 h-4 text-[#b5005a]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              New York City
            </span>
            <span className="inline-flex items-center gap-1.5">
              <svg className="w-4 h-4 text-[#b5005a]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              ~5 min to complete
            </span>
            <span className="inline-flex items-center gap-1.5">
              <svg className="w-4 h-4 text-[#b5005a]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              {SECTIONS.length} sections
            </span>
            <span className="inline-flex items-center gap-1.5">
              <svg className="w-4 h-4 text-[#b5005a]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Free for schools
            </span>
          </div>
          <p className="text-[#5e404e] text-sm md:text-base mt-5 font-medium leading-relaxed">
            Bring competitive high-school esports to your campus. Any teacher, faculty advisor, administrator, or
            student club officer can apply on behalf of their school. Joining gets your students:
          </p>
          <ul className="mt-3 space-y-1.5 text-sm font-medium text-[#5e404e]">
            {[
              'Organized leagues in Valorant, League of Legends, TFT, and Tetris with real standings',
              'Live-streamed matches broadcast to audiences across NYC',
              'Community and pathways into gaming and technology careers',
            ].map((benefit) => (
              <li key={benefit} className="flex items-start gap-2.5">
                <svg className="w-4 h-4 mt-0.5 shrink-0 text-[#b5005a]" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span>{benefit}</span>
              </li>
            ))}
          </ul>
        </div>

        {submitted ? (
          <div className="max-w-2xl mx-auto bg-white/95 border border-[#f4cccc] rounded-2xl p-8 text-center space-y-6 shadow-xl backdrop-blur-md">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto animate-bounce">
              <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-black text-[#2d0015]">Application Received!</h2>
              <p className="text-[#5e404e] text-sm mt-3 leading-relaxed">
                Thank you for applying. We have registered your response. We will review your application and contact you at <strong className="text-zinc-900">{form.email}</strong> soon.
              </p>
            </div>
            <button
              onClick={() => {
                setSubmitted(false);
                setForm(initialForm);
              }}
              className="text-[#b5005a] hover:underline text-sm font-semibold focus:outline-none cursor-pointer"
            >
              Submit another application
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

            {/* Left rail: sticky scroll-spy navigation + progress (big-tech careers style) */}
            <aside className="lg:col-span-4 space-y-6 lg:sticky lg:top-24">
              <nav
                aria-label="Application sections"
                className="bg-white/85 backdrop-blur-md rounded-2xl border border-[#f4cccc] p-6 shadow-sm"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold text-[#2d0015] uppercase tracking-wider">Application</h3>
                  <span className="text-xs font-bold text-[#b5005a] tabular-nums">{progress}%</span>
                </div>
                <div
                  className="h-1.5 rounded-full bg-[#ffeef6] overflow-hidden mb-5"
                  role="progressbar"
                  aria-valuenow={progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Required fields completed"
                >
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#b5005a] to-ez-purple transition-all duration-500"
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
                              ? 'bg-[#ffeef6] text-[#2d0015] font-bold'
                              : 'text-[#5e404e] font-semibold hover:bg-[#fff5fa] hover:text-[#2d0015]'
                          }`}
                        >
                          <span
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-colors ${
                              isComplete
                                ? 'bg-emerald-500 text-white'
                                : isActive
                                ? 'bg-[#b5005a] text-white'
                                : 'bg-[#ffeef6] text-[#b5005a] border border-[#f4cccc]'
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
              <div className="hidden lg:block bg-white/85 backdrop-blur-md rounded-2xl border border-[#f4cccc] p-6 shadow-sm">
                <h3 className="text-sm font-bold text-[#2d0015] mb-4 uppercase tracking-wider">After You Apply</h3>
                <ol className="relative border-l-2 border-[#f4cccc] ml-2.5 pl-5 space-y-5 text-sm">
                  <li className="relative">
                    <span className="absolute -left-[27px] top-1 h-2.5 w-2.5 rounded-full bg-[#b5005a] ring-4 ring-[#fff0f5]" />
                    <p className="font-bold text-[#2d0015]">Consultation call</p>
                    <p className="text-xs text-slate-500 mt-0.5">Short meeting to review league rules &amp; format.</p>
                  </li>
                  <li className="relative">
                    <span className="absolute -left-[27px] top-1 h-2.5 w-2.5 rounded-full bg-[#f4cccc] ring-4 ring-[#fff0f5]" />
                    <p className="font-bold text-[#2d0015]">Roster registration</p>
                    <p className="text-xs text-slate-500 mt-0.5">Register players and assign coaches/captains.</p>
                  </li>
                  <li className="relative">
                    <span className="absolute -left-[27px] top-1 h-2.5 w-2.5 rounded-full bg-[#f4cccc] ring-4 ring-[#fff0f5]" />
                    <p className="font-bold text-[#2d0015]">Season kickoff</p>
                    <p className="text-xs text-slate-500 mt-0.5">Match schedules are generated &amp; games start!</p>
                  </li>
                </ol>
              </div>

              {/* Assistance */}
              <div className="hidden lg:block bg-white/85 backdrop-blur-md rounded-2xl border border-[#f4cccc] p-6 shadow-sm">
                <h3 className="text-xs font-bold text-[#2d0015] mb-2 uppercase tracking-wider">Need Assistance?</h3>
                <p className="text-xs text-slate-500 mb-3 leading-relaxed">
                  Have questions about DBN codes, student eligibility, or system specs? We are here to help.
                </p>
                <a href="mailto:info@ezesports.org" className="text-xs text-[#b5005a] hover:underline font-bold transition-all">
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
                    />
                    {fieldErrors.name && (
                      <p className="mt-1.5 text-xs text-red-600 font-semibold">{fieldErrors.name}</p>
                    )}
                  </div>

                  {/* Preferred first name */}
                  <div id="field-preferredFirstName" className={fieldWrapperClass('preferredFirstName', false)}>
                    <label htmlFor="preferredFirstName" className={labelClass}>Preferred first name</label>
                    <input
                      id="preferredFirstName"
                      name="preferredFirstName"
                      type="text"
                      placeholder="Preferred name"
                      value={form.preferredFirstName}
                      onChange={handleTextChange}
                      onFocus={() => setFocusedField('preferredFirstName')}
                      onBlur={() => setFocusedField(null)}
                      className={textInputClass(false)}
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
                      placeholder="jsmith@school.edu"
                      value={form.email}
                      onChange={handleTextChange}
                      onFocus={() => setFocusedField('email')}
                      onBlur={() => setFocusedField(null)}
                      className={textInputClass(!!fieldErrors.email)}
                      required
                    />
                    {fieldErrors.email && (
                      <p className="mt-1.5 text-xs text-red-600 font-semibold">{fieldErrors.email}</p>
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
                    />
                    {fieldErrors.phone && (
                      <p className="mt-1.5 text-xs text-red-600 font-semibold">{fieldErrors.phone}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Discord tag */}
                  <div id="field-discordTag" className={fieldWrapperClass('discordTag', false)}>
                    <label htmlFor="discordTag" className={labelClass}>Discord username</label>
                    <input
                      id="discordTag"
                      name="discordTag"
                      type="text"
                      placeholder="username"
                      value={form.discordTag}
                      onChange={handleTextChange}
                      onFocus={() => setFocusedField('discordTag')}
                      onBlur={() => setFocusedField(null)}
                      className={textInputClass(false)}
                    />
                  </div>

                  {/* LinkedIn Profile */}
                  <div id="field-linkedin" className={fieldWrapperClass('linkedin', false)}>
                    <label htmlFor="linkedin" className={labelClass}>LinkedIn profile link</label>
                    <input
                      id="linkedin"
                      name="linkedin"
                      type="text"
                      placeholder="https://linkedin.com/in/username"
                      value={form.linkedin}
                      onChange={handleTextChange}
                      onFocus={() => setFocusedField('linkedin')}
                      onBlur={() => setFocusedField(null)}
                      className={textInputClass(false)}
                    />
                  </div>
                </div>
              </div>

              {/* Step 2: School Information */}
              <div id="section-school" className={sectionCardClass}>
                {sectionHeader('school')}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* School name */}
                  <div id="field-school" className={fieldWrapperClass('school', !!fieldErrors.school)}>
                    <label htmlFor="school" className={labelClass}>School name {requiredMark}</label>
                    <input
                      id="school"
                      name="school"
                      type="text"
                      placeholder="Brooklyn Technical High School"
                      value={form.school}
                      onChange={handleTextChange}
                      onFocus={() => setFocusedField('school')}
                      onBlur={() => setFocusedField(null)}
                      className={textInputClass(!!fieldErrors.school)}
                      required
                    />
                    {fieldErrors.school && (
                      <p className="mt-1.5 text-xs text-red-600 font-semibold">{fieldErrors.school}</p>
                    )}
                  </div>

                  {/* School code */}
                  <div id="field-schoolCode" className={fieldWrapperClass('schoolCode', false)}>
                    <label htmlFor="schoolCode" className={labelClass}>School Code / DBN</label>
                    <input
                      id="schoolCode"
                      name="schoolCode"
                      type="text"
                      placeholder="13K430"
                      value={form.schoolCode}
                      onChange={handleTextChange}
                      onFocus={() => setFocusedField('schoolCode')}
                      onBlur={() => setFocusedField(null)}
                      className={textInputClass(false)}
                    />
                  </div>
                </div>

                {/* Role within school */}
                <div id="field-role" className={fieldWrapperClass('role', !!fieldErrors.role)}>
                  <label htmlFor="role" className={labelClass}>
                    What is your role within your school? {requiredMark}
                  </label>
                  <input
                    id="role"
                    name="role"
                    type="text"
                    placeholder="e.g. School Principal, Athletic Director, Esports Club Advisor"
                    value={form.role}
                    onChange={handleTextChange}
                    onFocus={() => setFocusedField('role')}
                    onBlur={() => setFocusedField(null)}
                    className={textInputClass(!!fieldErrors.role)}
                    required
                  />
                  {fieldErrors.role && (
                    <p className="mt-1.5 text-xs text-red-600 font-semibold">{fieldErrors.role}</p>
                  )}
                </div>

                {/* Where is your school located? */}
                <div id="field-location" className={fieldWrapperClass('location', !!fieldErrors.location)}>
                  <span className={labelClass}>Where is your school located? {requiredMark}</span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {['Bronx', 'Queens', 'Manhattan', 'Brooklyn', 'Staten Island'].map((borough) => (
                      <label key={borough} className="flex items-center gap-2.5 cursor-pointer text-sm font-semibold text-[#4a2e3b] hover:text-[#2d0015] transition-colors">
                        <input
                          type="radio"
                          name="location"
                          value={borough}
                          checked={form.location === borough}
                          onChange={() => handleSelectChange('location', borough)}
                          className="w-4.5 h-4.5 accent-[#b5005a] cursor-pointer"
                        />
                        <span>{borough}</span>
                      </label>
                    ))}

                    {/* Other option inline */}
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-2.5 cursor-pointer text-sm font-semibold text-[#4a2e3b] hover:text-[#2d0015] transition-colors shrink-0">
                        <input
                          type="radio"
                          name="location"
                          value="Other"
                          checked={form.location === 'Other'}
                          onChange={() => handleSelectChange('location', 'Other')}
                          className="w-4.5 h-4.5 accent-[#b5005a] cursor-pointer"
                        />
                        <span>Other:</span>
                      </label>
                      {form.location === 'Other' && (
                        <input
                          type="text"
                          placeholder="Specify borough"
                          value={form.locationOther}
                          onChange={(e) => handleTextChange(e)}
                          name="locationOther"
                          className="border-b border-[#f4cccc] focus:border-b-2 focus:border-[#b5005a] focus:outline-none py-0.5 text-xs bg-transparent flex-1 text-[#2d0015]"
                        />
                      )}
                    </div>
                  </div>
                  {fieldErrors.location && (
                    <p className="mt-2 text-xs text-red-600 font-semibold">{fieldErrors.location}</p>
                  )}
                </div>
              </div>

              {/* Step 3: Team Details */}
              <div id="section-team" className={sectionCardClass}>
                {sectionHeader('team')}

                {/* List out intended captains/coaches */}
                <div id="field-captainsCoaches" className={fieldWrapperClass('captainsCoaches', false)}>
                  <label htmlFor="captainsCoaches" className={labelClass}>
                    Intended Captains and/or Coaches List
                    <span className="text-xs text-[#5e404e] font-normal leading-relaxed block mt-1 lowercase first-letter:uppercase">
                      Please list in format: [Game name] Name, Email, Phone number
                    </span>
                  </label>
                  <textarea
                    id="captainsCoaches"
                    name="captainsCoaches"
                    rows={3}
                    placeholder="e.g. [Valorant] Coach Jane Doe, jdoe@school.edu, (555) 555-5555"
                    value={form.captainsCoaches}
                    onChange={handleTextChange}
                    onFocus={() => setFocusedField('captainsCoaches')}
                    onBlur={() => setFocusedField(null)}
                    className={textareaClass(false)}
                  />
                </div>

                {/* Anything we should know about your team? */}
                <div id="field-teamInfo" className={fieldWrapperClass('teamInfo', false)}>
                  <label htmlFor="teamInfo" className={labelClass}>Anything we should know about your team?</label>
                  <textarea
                    id="teamInfo"
                    name="teamInfo"
                    rows={3}
                    placeholder="Tell us about your team experience, current equipment setup, or history..."
                    value={form.teamInfo}
                    onChange={handleTextChange}
                    onFocus={() => setFocusedField('teamInfo')}
                    onBlur={() => setFocusedField(null)}
                    className={textareaClass(false)}
                  />
                </div>

                {/* Do you need help finding extra players or forming a full team? */}
                <div id="field-needPlayerHelp" className={fieldWrapperClass('needPlayerHelp', !!fieldErrors.needPlayerHelp)}>
                  <span className={labelClass}>Do you need help finding extra players or forming a full team? {requiredMark}</span>
                  <div className="flex gap-6 mt-2">
                    {['Yes', 'No'].map((opt) => (
                      <label key={opt} className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-[#4a2e3b] hover:text-[#2d0015] transition-colors">
                        <input
                          type="radio"
                          name="needPlayerHelp"
                          value={opt}
                          checked={form.needPlayerHelp === opt}
                          onChange={() => handleSelectChange('needPlayerHelp', opt)}
                          className="w-4.5 h-4.5 accent-[#b5005a] cursor-pointer"
                        />
                        <span>{opt}</span>
                      </label>
                    ))}
                  </div>
                  {fieldErrors.needPlayerHelp && (
                    <p className="mt-2 text-xs text-red-600 font-semibold">{fieldErrors.needPlayerHelp}</p>
                  )}
                </div>
              </div>

              {/* Step 4: League Preferences */}
              <div id="section-preferences" className={sectionCardClass}>
                {sectionHeader('preferences')}

                {/* How did you first learn about EZ Esports? */}
                <div id="field-learnSource" className={fieldWrapperClass('learnSource', !!fieldErrors.learnSource)}>
                  <span className={labelClass}>How did you first learn about EZ Esports? {requiredMark}</span>
                  <div className="grid grid-cols-2 gap-3">
                    {['LinkedIn', 'Instagram', 'Twitch', 'Youtube', 'Web search', 'Friend/teacher/parent'].map((src) => (
                      <label key={src} className="flex items-center gap-2.5 cursor-pointer text-sm font-semibold text-[#4a2e3b] hover:text-[#2d0015] transition-colors">
                        <input
                          type="radio"
                          name="learnSource"
                          value={src}
                          checked={form.learnSource === src}
                          onChange={() => handleSelectChange('learnSource', src)}
                          className="w-4.5 h-4.5 accent-[#b5005a] cursor-pointer"
                        />
                        <span>{src}</span>
                      </label>
                    ))}

                    {/* Other option inline */}
                    <div className="col-span-2 flex items-center gap-2">
                      <label className="flex items-center gap-2.5 cursor-pointer text-sm font-semibold text-[#4a2e3b] hover:text-[#2d0015] transition-colors shrink-0">
                        <input
                          type="radio"
                          name="learnSource"
                          value="Other"
                          checked={form.learnSource === 'Other'}
                          onChange={() => handleSelectChange('learnSource', 'Other')}
                          className="w-4.5 h-4.5 accent-[#b5005a] cursor-pointer"
                        />
                        <span>Other:</span>
                      </label>
                      {form.learnSource === 'Other' && (
                        <input
                          type="text"
                          placeholder="Please specify"
                          value={form.learnSourceOther}
                          onChange={(e) => handleTextChange(e)}
                          name="learnSourceOther"
                          className="border-b border-[#f4cccc] focus:border-b-2 focus:border-[#b5005a] focus:outline-none py-0.5 text-xs bg-transparent flex-1 text-[#2d0015]"
                        />
                      )}
                    </div>
                  </div>
                  {fieldErrors.learnSource && (
                    <p className="mt-2 text-xs text-red-600 font-semibold">{fieldErrors.learnSource}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
                  {/* Preferred communication platform */}
                  <div id="field-commPlatforms" className={fieldWrapperClass('commPlatforms', !!fieldErrors.commPlatforms)}>
                    <span className={labelClass}>Preferred Communication platform {requiredMark}</span>
                    <div className="space-y-2.5">
                      {[
                        { id: 'email', label: 'Email' },
                        { id: 'discord', label: 'Discord Server' },
                        { id: 'text', label: 'SMS Texting' }
                      ].map((plat) => (
                        <label key={plat.id} className="flex items-center gap-2.5 cursor-pointer text-sm font-semibold text-[#4a2e3b] hover:text-[#2d0015] transition-colors">
                          <input
                            type="checkbox"
                            checked={form.commPlatforms[plat.id as keyof typeof form.commPlatforms]}
                            onChange={(e) => handleCheckboxChange('commPlatforms', plat.id, e.target.checked)}
                            className="w-4.5 h-4.5 rounded border-[#f4cccc] accent-[#b5005a] cursor-pointer"
                          />
                          <span>{plat.label}</span>
                        </label>
                      ))}
                    </div>
                    {fieldErrors.commPlatforms && (
                      <p className="mt-2 text-xs text-red-600 font-semibold">{fieldErrors.commPlatforms}</p>
                    )}
                  </div>

                  {/* Interested divisions */}
                  <div id="field-divisions" className={fieldWrapperClass('divisions', !!fieldErrors.divisions)}>
                    <span className={labelClass}>Interested Divisions {requiredMark}</span>
                    <div className="space-y-2.5">
                      {[
                        { id: 'tft', label: 'TFT (Teamfight Tactics)' },
                        { id: 'tetris', label: 'Tetris' },
                        { id: 'lol', label: 'LoL (League of Legends)' },
                        { id: 'valorant', label: 'VALORANT' }
                      ].map((div) => (
                        <label key={div.id} className="flex items-center gap-2.5 cursor-pointer text-sm font-semibold text-[#4a2e3b] hover:text-[#2d0015] transition-colors">
                          <input
                            type="checkbox"
                            checked={form.divisions[div.id as keyof typeof form.divisions]}
                            onChange={(e) => handleCheckboxChange('divisions', div.id, e.target.checked)}
                            className="w-4.5 h-4.5 rounded border-[#f4cccc] accent-[#b5005a] cursor-pointer"
                          />
                          <span>{div.label}</span>
                        </label>
                      ))}
                    </div>
                    {fieldErrors.divisions && (
                      <p className="mt-2 text-xs text-red-600 font-semibold">{fieldErrors.divisions}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Step 5: Review & Submit */}
              <div id="section-review" className={sectionCardClass}>
                {sectionHeader('review')}

                {/* Additional share */}
                <div id="field-additionalShare" className={fieldWrapperClass('additionalShare', false)}>
                  <label htmlFor="additionalShare" className={labelClass}>
                    Anything else you want to share?
                  </label>
                  <textarea
                    id="additionalShare"
                    name="additionalShare"
                    rows={3}
                    placeholder="Type comments, questions, or specific scheduling requests..."
                    value={form.additionalShare}
                    onChange={handleTextChange}
                    onFocus={() => setFocusedField('additionalShare')}
                    onBlur={() => setFocusedField(null)}
                    className={textareaClass(false)}
                  />
                </div>

                {/* Please review our rulebooks */}
                <div
                  id="field-agreedRules"
                  className={`rounded-xl border p-4 sm:p-5 transition-colors ${
                    fieldErrors.agreedRules ? 'border-red-500 bg-red-50/50' : 'border-[#f4cccc] bg-[#fff5fa]'
                  }`}
                >
                  <span className={labelClass}>
                    Rulebooks &amp; Terms Agreement {requiredMark}
                  </span>
                  <a
                    href="https://www.ezesports.org/rules"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[#b5005a] hover:underline font-bold inline-block mb-3.5 transition-colors"
                  >
                    Click to review rules and terms of service
                  </a>
                  <label className="flex items-center gap-2.5 cursor-pointer text-sm font-semibold text-[#4a2e3b] hover:text-[#2d0015] transition-colors">
                    <input
                      type="checkbox"
                      checked={form.agreedRules}
                      onChange={(e) => handleRulesChange(e.target.checked)}
                      className="w-4.5 h-4.5 rounded border-[#f4cccc] accent-[#b5005a] cursor-pointer"
                    />
                    <span>I understand and agree to all tournament rules.</span>
                  </label>
                  {fieldErrors.agreedRules && (
                    <p className="mt-2 text-xs text-red-600 font-semibold">{fieldErrors.agreedRules}</p>
                  )}
                </div>

                {/* Action buttons & error feedback */}
                <div className="flex flex-col gap-3 pt-2 border-t border-[#f4cccc]/50">
                  <div className="flex flex-wrap items-center justify-between gap-4 pt-4">
                    <Button
                      type="submit"
                      disabled={loading}
                      className="w-full sm:w-auto min-h-[46px] shadow-lg shadow-ez-pink/5 hover:shadow-ez-pink/20 hover:scale-[1.02] transition-all"
                    >
                      {loading ? 'Submitting…' : 'Submit Application'}
                    </Button>

                    <button
                      type="button"
                      onClick={() => {
                        setForm(initialForm);
                        setFieldErrors({});
                      }}
                      className="text-xs text-slate-500 hover:text-[#2d0015] hover:underline font-semibold focus:outline-none transition-colors duration-200"
                    >
                      Clear Form Response
                    </button>
                  </div>

                  {error && (
                    <p role="alert" className="text-red-600 text-sm font-semibold mt-2">{error}</p>
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

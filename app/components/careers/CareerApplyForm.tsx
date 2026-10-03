'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { Button as AriaButton, FileTrigger } from 'react-aria-components';
import Button from '@/app/components/ui/Button';
import Card from '@/app/components/ui/Card';
import { Input, Textarea } from '@/app/components/ui/form';
import {
  checkResumeFile,
  formatBytes,
  RESUME_ACCEPT,
  RESUME_MAX_BYTES,
} from '@/app/lib/staff-resume';
import {
  checkWhyJoinAnswer,
  EMAIL_RE,
  LINKEDIN_URL_ERROR,
  normalizeLinkedInUrl,
  REFERRAL_FIELD_MAX_LENGTH,
  UNPAID_VOLUNTEER_ACK_TEXT,
  WHY_JOIN_MAX_LENGTH,
  WORK_SAMPLES_MAX_LENGTH,
} from '@/app/lib/staff-application-form';
import {
  HiOutlineCheckCircle,
  HiOutlineDocumentArrowUp,
  HiOutlineExclamationCircle,
  HiOutlineArrowUpTray,
  HiOutlinePaperClip,
} from 'react-icons/hi2';

interface CareerApplyFormProps {
  careerPostingId?: string;
  roleTitle: string;
  department?: string;
}

export default function CareerApplyForm({
  careerPostingId,
  roleTitle,
  department,
}: CareerApplyFormProps) {
  const [form, setForm] = useState({
    name: '',
    preferredFirstName: '',
    email: '',
    phone: '',
    discordTag: '',
    message: '',
    linkedin: '',
    workSamples: '',
    referredBy: '',
    availability: '5–10 hours / week',
    agreedToTerms: false,
    agreedToPrivacy: false,
    acknowledgedUnpaidVolunteer: false,
  });

  const [resume, setResume] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const isSubmittingRef = useRef(false);

  const handleTextChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
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

  const handleCheckboxChange = (name: 'agreedToTerms' | 'agreedToPrivacy' | 'acknowledgedUnpaidVolunteer') => {
    setForm((prev) => ({ ...prev, [name]: !prev[name] }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const validate = () => {
    const errors: Record<string, string> = {};
    if (!form.name.trim()) errors.name = 'Full name is required.';
    if (!form.email.trim()) errors.email = 'Email address is required.';
    else if (!EMAIL_RE.test(form.email)) errors.email = 'Enter a valid email address.';
    if (!form.phone.trim()) errors.phone = 'Phone number is required.';

    const resumeError = checkResumeFile(resume);
    if (resumeError) errors.resume = resumeError;

    if (form.linkedin.trim() && normalizeLinkedInUrl(form.linkedin) === null) {
      errors.linkedin = LINKEDIN_URL_ERROR;
    }

    if (form.workSamples.trim().length > WORK_SAMPLES_MAX_LENGTH) {
      errors.workSamples = `Must be ${WORK_SAMPLES_MAX_LENGTH} characters or fewer.`;
    }

    if (form.referredBy.trim().length > REFERRAL_FIELD_MAX_LENGTH) {
      errors.referredBy = `Must be ${REFERRAL_FIELD_MAX_LENGTH} characters or fewer.`;
    }

    const whyJoinError = checkWhyJoinAnswer(form.message);
    if (whyJoinError) errors.message = whyJoinError;

    if (!form.agreedToTerms) errors.agreedToTerms = 'You must agree to the Terms of Service.';
    if (!form.agreedToPrivacy) errors.agreedToPrivacy = 'You must agree to the Privacy Policy.';
    if (!form.acknowledgedUnpaidVolunteer) {
      errors.acknowledgedUnpaidVolunteer = 'Please confirm you understand this is an unpaid volunteer position.';
    }

    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current || loading) return;

    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      const firstKey = Object.keys(errors)[0];
      const el = document.getElementById(`field-${firstKey}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setFieldErrors({});
    isSubmittingRef.current = true;
    setLoading(true);
    setError('');

    try {
      const details = {
        version: 4,
        gameDirector: '',
        preferredFirstName: form.preferredFirstName.trim(),
        discordTag: form.discordTag.trim(),
        linkedin: form.linkedin.trim() ? normalizeLinkedInUrl(form.linkedin) : '',
        workSamples: form.workSamples.trim(),
        referredBy: form.referredBy.trim(),
        availability: form.availability,
        consent: {
          agreedToTerms: true,
          agreedToPrivacy: true,
          acknowledgedUnpaidVolunteer: true,
        },
        backgroundMotivation: form.message.trim(),
      };

      const body = new FormData();
      body.set('name', form.name.trim());
      body.set('preferredFirstName', form.preferredFirstName.trim());
      body.set('email', form.email.trim());
      body.set('phone', form.phone.trim());
      body.set('discordTag', form.discordTag.trim());
      body.set('role', roleTitle);
      if (careerPostingId) {
        body.set('careerPostingId', careerPostingId);
      }
      body.set('details', JSON.stringify(details));
      if (resume) {
        body.set('resume', resume, resume.name);
      }

      const res = await fetch('/api/apply/staff', { method: 'POST', body });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const reason = res.status < 500 && typeof data?.error === 'string' ? data.error : null;
        throw new Error(reason ?? 'Submission failed.');
      }

      setSubmitted(true);
    } catch (err) {
      const reason = err instanceof Error && err.message ? err.message : null;
      setError(
        reason
          ? `${reason} If this keeps happening, email us at info@ezesports.org.`
          : 'Something went wrong. Please try again or email us at info@ezesports.org.'
      );
    } finally {
      isSubmittingRef.current = false;
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <Card className="bg-surface-raised/40 border border-line p-8 sm:p-12 text-center max-w-2xl mx-auto">
        <div className="w-16 h-16 rounded-full bg-accent/15 text-accent flex items-center justify-center mx-auto mb-6">
          <HiOutlineCheckCircle className="w-10 h-10" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-black text-white mb-3">
          Application Received!
        </h2>
        <p className="text-foreground-secondary text-sm sm:text-base mb-6 leading-relaxed">
          Thank you for applying for <span className="text-white font-bold">{roleTitle}</span>! Our team will review your application and resume. We typically reach out via email or Discord within 5–7 business days.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/careers"
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-accent text-black font-extrabold text-xs uppercase tracking-wider hover:bg-accent/90 transition-all text-center"
          >
            Explore Other Openings
          </Link>
          <a
            href="https://discord.com/invite/RajSZqNyvu"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-surface-raised hover:bg-surface border border-line text-white font-bold text-xs uppercase tracking-wider transition-all text-center"
          >
            Join League Discord
          </a>
        </div>
      </Card>
    );
  }

  return (
    <Card className="bg-surface-raised/30 border border-line p-6 sm:p-10">
      <div className="mb-8 pb-6 border-b border-line/60">
        <span className="text-xs font-bold text-accent uppercase tracking-wider">
          Application Form
        </span>
        <h2 className="text-2xl font-black text-white mt-1">
          Apply for {roleTitle}
        </h2>
        {department && (
          <p className="text-xs text-foreground-muted mt-1 font-medium">
            Department: {department}
          </p>
        )}
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs sm:text-sm flex items-start gap-3">
          <HiOutlineExclamationCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8" noValidate>
        {/* Section 1: Contact Information */}
        <div className="space-y-4">
          <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-accent/20 text-accent text-xs flex items-center justify-center font-bold">
              1
            </span>
            <span>Your Contact Info</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div id="field-name">
              <label htmlFor="input-name" className="block text-xs font-bold text-foreground-secondary mb-1.5 uppercase tracking-wide">
                Full Name <span className="text-accent">*</span>
              </label>
              <Input
                id="input-name"
                name="name"
                value={form.name}
                onChange={handleTextChange}
                placeholder="Jane Doe"
                className={fieldErrors.name ? 'border-red-500/60' : ''}
              />
              {fieldErrors.name && (
                <p className="mt-1 text-xs text-red-400">{fieldErrors.name}</p>
              )}
            </div>

            <div id="field-preferredFirstName">
              <label htmlFor="input-pref" className="block text-xs font-bold text-foreground-secondary mb-1.5 uppercase tracking-wide">
                Preferred First Name <span className="text-foreground-muted text-[10px] lowercase">(optional)</span>
              </label>
              <Input
                id="input-pref"
                name="preferredFirstName"
                value={form.preferredFirstName}
                onChange={handleTextChange}
                placeholder="e.g. Janey"
              />
            </div>

            <div id="field-email">
              <label htmlFor="input-email" className="block text-xs font-bold text-foreground-secondary mb-1.5 uppercase tracking-wide">
                Email Address <span className="text-accent">*</span>
              </label>
              <Input
                id="input-email"
                type="email"
                name="email"
                value={form.email}
                onChange={handleTextChange}
                placeholder="jane@example.com"
                className={fieldErrors.email ? 'border-red-500/60' : ''}
              />
              {fieldErrors.email && (
                <p className="mt-1 text-xs text-red-400">{fieldErrors.email}</p>
              )}
            </div>

            <div id="field-phone">
              <label htmlFor="input-phone" className="block text-xs font-bold text-foreground-secondary mb-1.5 uppercase tracking-wide">
                Phone Number <span className="text-accent">*</span>
              </label>
              <Input
                id="input-phone"
                type="tel"
                name="phone"
                value={form.phone}
                onChange={handleTextChange}
                placeholder="(555) 123-4567"
                className={fieldErrors.phone ? 'border-red-500/60' : ''}
              />
              {fieldErrors.phone && (
                <p className="mt-1 text-xs text-red-400">{fieldErrors.phone}</p>
              )}
            </div>

            <div id="field-discordTag" className="sm:col-span-2">
              <label htmlFor="input-discord" className="block text-xs font-bold text-foreground-secondary mb-1.5 uppercase tracking-wide">
                Discord Username <span className="text-foreground-muted text-[10px] lowercase">(e.g. username or username#1234)</span>
              </label>
              <Input
                id="input-discord"
                name="discordTag"
                value={form.discordTag}
                onChange={handleTextChange}
                placeholder="discorduser"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Resume & Links */}
        <div className="space-y-4 pt-6 border-t border-line/60">
          <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-accent/20 text-accent text-xs flex items-center justify-center font-bold">
              2
            </span>
            <span>Resume & Background</span>
          </h3>

          <div id="field-resume" className="space-y-2">
            <label className="block text-xs font-bold text-foreground-secondary uppercase tracking-wide">
              Resume (PDF) <span className="text-accent">*</span>
            </label>

            <div className={`p-5 rounded-xl border border-dashed transition-all ${
              fieldErrors.resume
                ? 'border-red-500/50 bg-red-500/5'
                : resume
                ? 'border-accent/50 bg-accent/5'
                : 'border-line hover:border-line/80 bg-surface/40'
            }`}>
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-surface-raised flex items-center justify-center text-accent shrink-0">
                    {resume ? <HiOutlinePaperClip className="w-5 h-5" /> : <HiOutlineDocumentArrowUp className="w-5 h-5" />}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white truncate max-w-xs sm:max-w-sm">
                      {resume ? resume.name : 'Upload your resume'}
                    </p>
                    <p className="text-[11px] text-foreground-muted">
                      {resume
                        ? `${formatBytes(resume.size)} • PDF ready`
                        : `PDF only, up to ${formatBytes(RESUME_MAX_BYTES)}`}
                    </p>
                  </div>
                </div>

                <FileTrigger
                  acceptedFileTypes={[RESUME_ACCEPT]}
                  onSelect={(e) => {
                    const files = Array.from(e ?? []);
                    if (files.length > 0) {
                      setResume(files[0]);
                      if (fieldErrors.resume) {
                        setFieldErrors((prev) => {
                          const next = { ...prev };
                          delete next.resume;
                          return next;
                        });
                      }
                    }
                  }}
                >
                  <AriaButton className="px-4 py-2 rounded-lg bg-surface-raised hover:bg-surface border border-line text-white font-bold text-xs uppercase tracking-wider transition-all inline-flex items-center gap-1.5 cursor-pointer">
                    <HiOutlineArrowUpTray className="w-4 h-4 text-accent" />
                    <span>{resume ? 'Change PDF' : 'Select PDF'}</span>
                  </AriaButton>
                </FileTrigger>
              </div>
            </div>
            {fieldErrors.resume && (
              <p className="text-xs text-red-400">{fieldErrors.resume}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div id="field-linkedin">
              <label htmlFor="input-linkedin" className="block text-xs font-bold text-foreground-secondary mb-1.5 uppercase tracking-wide">
                LinkedIn URL <span className="text-foreground-muted text-[10px] lowercase">(optional)</span>
              </label>
              <Input
                id="input-linkedin"
                name="linkedin"
                value={form.linkedin}
                onChange={handleTextChange}
                placeholder="https://linkedin.com/in/..."
                className={fieldErrors.linkedin ? 'border-red-500/60' : ''}
              />
              {fieldErrors.linkedin && (
                <p className="mt-1 text-xs text-red-400">{fieldErrors.linkedin}</p>
              )}
            </div>

            <div id="field-availability">
              <label htmlFor="select-availability" className="block text-xs font-bold text-foreground-secondary mb-1.5 uppercase tracking-wide">
                Weekly Commitment <span className="text-accent">*</span>
              </label>
              <select
                id="select-availability"
                name="availability"
                value={form.availability}
                onChange={handleTextChange}
                className="w-full bg-surface border border-line rounded-lg px-3.5 py-2.5 text-xs text-foreground focus:outline-none focus:border-accent transition-colors"
              >
                <option value="1–3 hours / week">1–3 hours / week</option>
                <option value="3–5 hours / week">3–5 hours / week</option>
                <option value="5–10 hours / week">5–10 hours / week</option>
                <option value="10+ hours / week">10+ hours / week</option>
              </select>
            </div>

            <div id="field-workSamples" className="sm:col-span-2">
              <label htmlFor="input-samples" className="block text-xs font-bold text-foreground-secondary mb-1.5 uppercase tracking-wide">
                Portfolio, GitHub, or Relevant Links <span className="text-foreground-muted text-[10px] lowercase">(optional)</span>
              </label>
              <Input
                id="input-samples"
                name="workSamples"
                value={form.workSamples}
                onChange={handleTextChange}
                placeholder="https://github.com/..., https://portfolio.com"
                className={fieldErrors.workSamples ? 'border-red-500/60' : ''}
              />
              {fieldErrors.workSamples && (
                <p className="mt-1 text-xs text-red-400">{fieldErrors.workSamples}</p>
              )}
            </div>

            <div id="field-referredBy" className="sm:col-span-2">
              <label htmlFor="input-referredBy" className="block text-xs font-bold text-foreground-secondary mb-1.5 uppercase tracking-wide">
                Referred By <span className="text-foreground-muted text-[10px] lowercase">(optional)</span>
              </label>
              <Input
                id="input-referredBy"
                name="referredBy"
                value={form.referredBy}
                onChange={handleTextChange}
                placeholder="Name of EZ Esports staff member"
                className={fieldErrors.referredBy ? 'border-red-500/60' : ''}
              />
              {fieldErrors.referredBy && (
                <p className="mt-1 text-xs text-red-400">{fieldErrors.referredBy}</p>
              )}
            </div>
          </div>
        </div>

        {/* Section 3: Why Join */}
        <div className="space-y-4 pt-6 border-t border-line/60">
          <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-accent/20 text-accent text-xs flex items-center justify-center font-bold">
              3
            </span>
            <span>Why EZ Esports?</span>
          </h3>

          <div id="field-message">
            <label htmlFor="textarea-message" className="block text-xs font-bold text-foreground-secondary mb-1.5 uppercase tracking-wide">
              Tell us why you want to join and what you hope to accomplish (4–7 sentences) <span className="text-accent">*</span>
            </label>
            <Textarea
              id="textarea-message"
              name="message"
              rows={5}
              value={form.message}
              onChange={handleTextChange}
              placeholder="Share your interest in esports, community building, or the skills you want to bring..."
              className={fieldErrors.message ? 'border-red-500/60' : ''}
            />
            <div className="flex items-center justify-between mt-1 text-[11px] text-foreground-muted">
              <span>{fieldErrors.message ? <span className="text-red-400">{fieldErrors.message}</span> : 'Up to 1,500 characters.'}</span>
              <span>{form.message.length} / {WHY_JOIN_MAX_LENGTH}</span>
            </div>
          </div>
        </div>

        {/* Section 4: Acknowledgements & Submit */}
        <div className="space-y-4 pt-6 border-t border-line/60">
          <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-accent/20 text-accent text-xs flex items-center justify-center font-bold">
              4
            </span>
            <span>Agreements & Confirmation</span>
          </h3>

          <div className="space-y-3 bg-surface/40 p-4 rounded-xl border border-line">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.agreedToTerms}
                onChange={() => handleCheckboxChange('agreedToTerms')}
                className="mt-1 accent-accent cursor-pointer"
              />
              <span className="text-xs text-foreground-secondary leading-relaxed">
                I agree to the{' '}
                <Link href="/terms" target="_blank" className="text-accent underline font-semibold hover:text-white">
                  Terms of Service
                </Link>
                . <span className="text-accent">*</span>
              </span>
            </label>
            {fieldErrors.agreedToTerms && (
              <p className="text-xs text-red-400 pl-6">{fieldErrors.agreedToTerms}</p>
            )}

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.agreedToPrivacy}
                onChange={() => handleCheckboxChange('agreedToPrivacy')}
                className="mt-1 accent-accent cursor-pointer"
              />
              <span className="text-xs text-foreground-secondary leading-relaxed">
                I agree to the{' '}
                <Link href="/privacy" target="_blank" className="text-accent underline font-semibold hover:text-white">
                  Privacy Policy
                </Link>
                . <span className="text-accent">*</span>
              </span>
            </label>
            {fieldErrors.agreedToPrivacy && (
              <p className="text-xs text-red-400 pl-6">{fieldErrors.agreedToPrivacy}</p>
            )}

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.acknowledgedUnpaidVolunteer}
                onChange={() => handleCheckboxChange('acknowledgedUnpaidVolunteer')}
                className="mt-1 accent-accent cursor-pointer"
              />
              <span className="text-xs text-foreground-secondary leading-relaxed">
                {UNPAID_VOLUNTEER_ACK_TEXT} <span className="text-accent">*</span>
              </span>
            </label>
            {fieldErrors.acknowledgedUnpaidVolunteer && (
              <p className="text-xs text-red-400 pl-6">{fieldErrors.acknowledgedUnpaidVolunteer}</p>
            )}
          </div>

          <div className="pt-4">
            <Button
              type="submit"
              variant="primary"
              size="md"
              className="w-full justify-center"
              disabled={loading}
            >
              {loading ? 'Submitting Application…' : `Submit Application for ${roleTitle}`}
            </Button>
          </div>
        </div>
      </form>
    </Card>
  );
}

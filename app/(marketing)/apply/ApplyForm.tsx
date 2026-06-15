'use client';

import { useState } from 'react';
import ContentSection from '@/app/components/sections/ContentSection';
import Button from '@/app/components/ui/Button';

export default function ApplyForm() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    name: '',
    school: '',
    role: '',
    email: '',
    message: '',
  });

  const validate = () => {
    const errors: Record<string, string> = {};
    if (!form.name.trim()) errors.name = 'Your name is required.';
    if (!form.school.trim()) errors.school = 'School name is required.';
    if (!form.role) errors.role = 'Please select your role.';
    if (!form.email.trim()) errors.email = 'Email address is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.email = 'Enter a valid email address.';
    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicantName: form.name,
          schoolName: form.school,
          role: form.role,
          email: form.email,
          message: form.message,
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => { const next = { ...prev }; delete next[name]; return next; });
    }
  };

  const inputClass = (hasError: boolean) =>
    `w-full px-4 py-3 rounded-lg bg-background border text-foreground placeholder-foreground-secondary/50 focus:outline-none focus:ring-2 transition-all ${
      hasError
        ? 'border-red-500/70 focus:ring-red-500/40 focus:border-red-500/70'
        : 'border-custom-border/80 focus:ring-ez-pink/40 focus:border-ez-pink/60'
    }`;
  const labelClass = 'block text-sm font-semibold text-foreground mb-1.5';
  const requiredMark = <span className="text-red-400 ml-0.5" aria-hidden="true">*</span>;

  return (
    <ContentSection heading="APPLY TO JOIN" description="" theme="light">
      <div className="max-w-2xl mx-auto">
        {submitted ? (
          <div className="text-center py-12 space-y-6">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-black text-foreground mb-2">Application Submitted!</h2>
              <p className="text-foreground-secondary text-base">
                Thanks for reaching out — we&apos;ll review your application and get back to you at{' '}
                <strong className="text-foreground">{form.email}</strong> within a few business days.
              </p>
            </div>
            <div className="text-sm text-foreground-secondary space-y-1">
              <p className="font-semibold text-foreground">What happens next?</p>
              <ol className="list-decimal list-inside space-y-1 text-left max-w-sm mx-auto">
                <li>Our team reviews your application.</li>
                <li>We&apos;ll email you to schedule an intro call.</li>
                <li>Your school gets onboarded for the next season.</li>
              </ol>
            </div>
            <button
              onClick={() => { setSubmitted(false); setForm({ name: '', school: '', role: '', email: '', message: '' }); }}
              className="text-ez-pink hover:underline text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-ez-pink/50 rounded"
            >
              Submit another application
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6" noValidate aria-label="School application form">
            <p className="text-xs text-foreground-secondary">
              Fields marked <span className="text-red-400">*</span> are required.
            </p>

            <div>
              <label htmlFor="name" className={labelClass}>Your Name {requiredMark}</label>
              <input
                id="name"
                name="name"
                type="text"
                required
                aria-required="true"
                aria-invalid={!!fieldErrors.name}
                aria-describedby={fieldErrors.name ? 'name-error' : undefined}
                placeholder="Jane Smith"
                value={form.name}
                onChange={handleChange}
                className={inputClass(!!fieldErrors.name)}
              />
              {fieldErrors.name && (
                <p id="name-error" role="alert" className="mt-1.5 text-xs text-red-400">{fieldErrors.name}</p>
              )}
            </div>

            <div>
              <label htmlFor="school" className={labelClass}>School Name {requiredMark}</label>
              <input
                id="school"
                name="school"
                type="text"
                required
                aria-required="true"
                aria-invalid={!!fieldErrors.school}
                aria-describedby={fieldErrors.school ? 'school-error' : undefined}
                placeholder="Brooklyn Tech High School"
                value={form.school}
                onChange={handleChange}
                className={inputClass(!!fieldErrors.school)}
              />
              {fieldErrors.school && (
                <p id="school-error" role="alert" className="mt-1.5 text-xs text-red-400">{fieldErrors.school}</p>
              )}
            </div>

            <div>
              <label htmlFor="role" className={labelClass}>Your Role {requiredMark}</label>
              <select
                id="role"
                name="role"
                required
                aria-required="true"
                aria-invalid={!!fieldErrors.role}
                aria-describedby={fieldErrors.role ? 'role-error' : undefined}
                value={form.role}
                onChange={handleChange}
                className={inputClass(!!fieldErrors.role)}
              >
                <option value="">Select your role</option>
                <option value="principal">Principal</option>
                <option value="assistant-principal">Assistant Principal</option>
                <option value="teacher">Teacher / Club Advisor</option>
                <option value="coach">Coach</option>
                <option value="parent">Parent / Guardian</option>
              </select>
              {fieldErrors.role && (
                <p id="role-error" role="alert" className="mt-1.5 text-xs text-red-400">{fieldErrors.role}</p>
              )}
            </div>

            <div>
              <label htmlFor="email" className={labelClass}>Email Address {requiredMark}</label>
              <input
                id="email"
                name="email"
                type="email"
                required
                aria-required="true"
                aria-invalid={!!fieldErrors.email}
                aria-describedby={fieldErrors.email ? 'email-error' : undefined}
                placeholder="jsmith@school.edu"
                value={form.email}
                onChange={handleChange}
                className={inputClass(!!fieldErrors.email)}
              />
              {fieldErrors.email && (
                <p id="email-error" role="alert" className="mt-1.5 text-xs text-red-400">{fieldErrors.email}</p>
              )}
            </div>

            <div>
              <label htmlFor="message" className={labelClass}>Message / Tell us about your school&apos;s interest</label>
              <textarea
                id="message"
                name="message"
                rows={4}
                placeholder="We have about 20 students interested in competitive gaming..."
                value={form.message}
                onChange={handleChange}
                className={inputClass(false)}
              />
            </div>

            <div className="sm:flex sm:justify-start flex-col gap-2">
              <Button type="submit" variant="primary" className="w-full sm:w-auto" disabled={loading}>
                {loading ? 'Submitting…' : 'Submit Application'}
              </Button>
              {error && (
                <p role="alert" className="text-red-400 text-sm mt-2">{error}</p>
              )}
            </div>
          </form>
        )}
      </div>
    </ContentSection>
  );
}

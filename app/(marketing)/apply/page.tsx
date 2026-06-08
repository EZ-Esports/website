'use client';

import { useState } from 'react';
import Hero from '@/app/components/sections/Hero';
import ContentSection from '@/app/components/sections/ContentSection';
import Card from '@/app/components/ui/Card';
import Button from '@/app/components/ui/Button';

export default function ApplyPage() {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    name: '',
    school: '',
    role: '',
    email: '',
    message: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const inputClass =
    'w-full px-4 py-3 rounded-lg bg-background border border-custom-border/80 text-foreground placeholder-foreground-secondary/50 focus:outline-none focus:ring-2 focus:ring-ez-pink/40 focus:border-ez-pink/60 transition-all';
  const labelClass = 'block text-sm font-semibold text-foreground mb-2';

  return (
    <>
      <Hero
        title="Bring EZ Esports to Your School"
        backgroundImage="/images/hero-background.png"
        size="medium"
      />

      <ContentSection heading="WHY JOIN EZ ESPORTS" description="" theme="dark">
        <div className="grid md:grid-cols-3 gap-6">
          <Card>
            <h3 className="text-foreground font-bold text-lg mb-3">Organized Competition</h3>
            <p className="text-foreground-secondary text-sm leading-relaxed">
              Structured leagues across League of Legends, Valorant, and Teamfight Tactics with real standings and match schedules.
            </p>
          </Card>
          <Card>
            <h3 className="text-foreground font-bold text-lg mb-3">Live Streaming</h3>
            <p className="text-foreground-secondary text-sm leading-relaxed">
              Professional broadcast infrastructure that showcases your students to audiences across NYC.
            </p>
          </Card>
          <Card>
            <h3 className="text-foreground font-bold text-lg mb-3">Community &amp; Career Paths</h3>
            <p className="text-foreground-secondary text-sm leading-relaxed">
              Connect students with the broader esports ecosystem and pathways into gaming and technology careers.
            </p>
          </Card>
        </div>
      </ContentSection>

      <ContentSection heading="APPLY TO JOIN" description="" theme="light">
        <div className="max-w-2xl mx-auto">
          {submitted ? (
            <div className="text-center py-12">
              <p className="text-foreground font-semibold text-lg">Thanks! We&apos;ll be in touch soon.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="name" className={labelClass}>Your Name</label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  placeholder="Jane Smith"
                  value={form.name}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="school" className={labelClass}>School Name</label>
                <input
                  id="school"
                  name="school"
                  type="text"
                  required
                  placeholder="Brooklyn Tech High School"
                  value={form.school}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="role" className={labelClass}>Your Role</label>
                <select
                  id="role"
                  name="role"
                  required
                  value={form.role}
                  onChange={handleChange}
                  className={inputClass}
                >
                  <option value="">Select your role</option>
                  <option value="principal">Principal</option>
                  <option value="assistant-principal">Assistant Principal</option>
                  <option value="teacher">Teacher / Club Advisor</option>
                  <option value="coach">Coach</option>
                  <option value="parent">Parent / Guardian</option>
                </select>
              </div>

              <div>
                <label htmlFor="email" className={labelClass}>Email Address</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder="jsmith@school.edu"
                  value={form.email}
                  onChange={handleChange}
                  className={inputClass}
                />
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
                  className={inputClass}
                />
              </div>

              <div className="sm:flex sm:justify-start">
                <Button type="submit" variant="primary" className="w-full sm:w-auto">
                  Submit Application
                </Button>
              </div>
            </form>
          )}
        </div>
      </ContentSection>
    </>
  );
}

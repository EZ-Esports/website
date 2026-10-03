'use client';

import { useState } from 'react';
import { input, primaryBtn, secondaryBtn } from './styles';
import { createCareerPostingAction, updateCareerPostingAction } from '@/app/(admin)/admin/careers/actions';
import type { AdminCareerPostingWithStats, CareerPostingStatus } from '@/app/types/careers';
import { slugify } from '@/app/lib/text-utils';
import { HiOutlineXMark } from 'react-icons/hi2';

interface CareerPostingModalProps {
  posting?: AdminCareerPostingWithStats | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const DEPARTMENTS = [
  'Software Engineering',
  'Productions & Broadcast',
  'Operations & Logistics',
  'Game Regulations',
  'Marketing & Creative',
  'Community & Events',
  'Legal & Governance',
];

export default function CareerPostingModal({
  posting,
  isOpen,
  onClose,
  onSuccess,
}: CareerPostingModalProps) {
  const isEditing = !!posting;

  const [title, setTitle] = useState(posting?.title || '');
  const [slug, setSlug] = useState(posting?.slug || '');
  const [department, setDepartment] = useState(posting?.department || DEPARTMENTS[0]);
  const [location, setLocation] = useState(posting?.location || 'Remote (NYC High School League)');
  const [commitment, setCommitment] = useState(posting?.commitment || '5–10 hours / week');
  const [employmentType, setEmploymentType] = useState(posting?.employmentType || 'Volunteer / High School Internship');
  const [summary, setSummary] = useState(posting?.summary || '');
  const [description, setDescription] = useState(posting?.description || '');
  const [status, setStatus] = useState<CareerPostingStatus>(posting?.status || 'published');
  const [displayOrder, setDisplayOrder] = useState<number>(posting?.displayOrder ?? 0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextTitle = e.target.value;
    setTitle(nextTitle);
    if (!isEditing && (!slug || slug === slugify(title))) {
      setSlug(slugify(nextTitle));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    if (!title.trim() || !department.trim() || !summary.trim() || !description.trim()) {
      setError('Title, department, summary, and description are required.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (isEditing) {
        const res = await updateCareerPostingAction(posting.id, {
          title,
          slug,
          department,
          location,
          commitment,
          employmentType,
          summary,
          description,
          status,
          displayOrder,
        });

        if (!res.success) {
          setError(res.error || 'Failed to update posting.');
          return;
        }
      } else {
        const res = await createCareerPostingAction({
          title,
          slug,
          department,
          location,
          commitment,
          employmentType,
          summary,
          description,
          status,
          displayOrder,
        });

        if (!res.success) {
          setError(res.error || 'Failed to create posting.');
          return;
        }
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
      <div className="bg-surface border border-line rounded-2xl w-full max-w-3xl my-8 overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-line flex items-center justify-between bg-surface-raised/40">
          <div>
            <h3 className="text-base font-black text-white uppercase tracking-wider">
              {isEditing ? 'Edit Career Opening' : 'New Career Opening'}
            </h3>
            <p className="text-xs text-foreground-muted mt-0.5">
              {isEditing ? `Modifying ${posting.title}` : 'Post an open staff role to the public careers portal.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-foreground-muted hover:text-white hover:bg-surface-raised transition-colors cursor-pointer"
          >
            <HiOutlineXMark className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-foreground-secondary mb-1.5 uppercase tracking-wide">
                Role Title <span className="text-accent">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={handleTitleChange}
                placeholder="e.g. Lead Software Engineer"
                className={input}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-foreground-secondary mb-1.5 uppercase tracking-wide">
                URL Slug <span className="text-accent">*</span>
              </label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="e.g. software-engineer"
                className={input}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-foreground-secondary mb-1.5 uppercase tracking-wide">
                Department <span className="text-accent">*</span>
              </label>
              <input
                type="text"
                list="dept-options"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="Select or enter department"
                className={input}
                required
              />
              <datalist id="dept-options">
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-xs font-bold text-foreground-secondary mb-1.5 uppercase tracking-wide">
                Location
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Remote (NYC High School League)"
                className={input}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-foreground-secondary mb-1.5 uppercase tracking-wide">
                Weekly Commitment
              </label>
              <input
                type="text"
                value={commitment}
                onChange={(e) => setCommitment(e.target.value)}
                placeholder="5–10 hours / week"
                className={input}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-foreground-secondary mb-1.5 uppercase tracking-wide">
                Employment Type
              </label>
              <input
                type="text"
                value={employmentType}
                onChange={(e) => setEmploymentType(e.target.value)}
                placeholder="Volunteer / High School Internship"
                className={input}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-foreground-secondary mb-1.5 uppercase tracking-wide">
                Publication Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as CareerPostingStatus)}
                className={input}
              >
                <option value="published">Published (Visible on site)</option>
                <option value="draft">Draft (Hidden)</option>
                <option value="closed">Closed (Applications closed)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-foreground-secondary mb-1.5 uppercase tracking-wide">
                Display Order <span className="text-foreground-muted text-[10px]">(Lower numbers appear first)</span>
              </label>
              <input
                type="number"
                value={displayOrder}
                onChange={(e) => setDisplayOrder(parseInt(e.target.value, 10) || 0)}
                className={input}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-foreground-secondary mb-1.5 uppercase tracking-wide">
              Summary <span className="text-accent">*</span>
              <span className="text-foreground-muted text-[10px] lowercase ml-2">(Short 1–2 sentence blurb for listing cards)</span>
            </label>
            <textarea
              rows={2}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Brief summary of the role..."
              className={input}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-foreground-secondary mb-1.5 uppercase tracking-wide">
              Job Description & Requirements (Markdown supported) <span className="text-accent">*</span>
            </label>
            <textarea
              rows={8}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="### Overview&#10;Describe the role...&#10;&#10;### Responsibilities&#10;- Lead development of...&#10;&#10;### Qualifications&#10;- Experience with..."
              className={`${input} font-mono text-xs`}
              required
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-line flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className={secondaryBtn}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className={primaryBtn}
            >
              {loading ? 'Saving…' : isEditing ? 'Save Changes' : 'Create Opening'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

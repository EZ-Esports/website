'use client';

import { useEffect, useState } from 'react';
import { ghostBtn, iconBtn, input, label as labelClass, primaryBtn } from './styles';
import { AdminNotice, PendingLabel, RequiredMark } from './AdminUI';
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

export interface CareerPostingFormValues {
  title: string;
  slug: string;
  department: string;
  location: string;
  commitment: string;
  employmentType: string;
  summary: string;
  description: string;
  status: CareerPostingStatus;
  displayOrder: number;
}

/** Initial form state: the posting's current values when editing, defaults for a new opening. */
export function postingToFormValues(posting?: AdminCareerPostingWithStats | null): CareerPostingFormValues {
  return {
    title: posting?.title || '',
    slug: posting?.slug || '',
    department: posting?.department || DEPARTMENTS[0],
    location: posting?.location || 'Remote (NYC High School League)',
    commitment: posting?.commitment || '5–10 hours / week',
    employmentType: posting?.employmentType || 'Volunteer / High School Internship',
    summary: posting?.summary || '',
    description: posting?.description || '',
    status: posting?.status || 'published',
    displayOrder: posting?.displayOrder ?? 0,
  };
}

// The form seeds its state from `posting` once, on mount. It is only mounted while the
// dialog is open (and keyed per posting), so every open starts from the right values and
// clean loading/error state instead of inheriting the previous session's.
export default function CareerPostingModal({ isOpen, posting, ...rest }: CareerPostingModalProps) {
  if (!isOpen) return null;
  return <CareerPostingForm key={posting?.id ?? 'new'} posting={posting} {...rest} />;
}

function CareerPostingForm({ posting, onClose, onSuccess }: Omit<CareerPostingModalProps, 'isOpen'>) {
  const isEditing = !!posting;
  const initial = postingToFormValues(posting);

  const [title, setTitle] = useState(initial.title);
  const [slug, setSlug] = useState(initial.slug);
  const [department, setDepartment] = useState(initial.department);
  const [location, setLocation] = useState(initial.location);
  const [commitment, setCommitment] = useState(initial.commitment);
  const [employmentType, setEmploymentType] = useState(initial.employmentType);
  const [summary, setSummary] = useState(initial.summary);
  const [description, setDescription] = useState(initial.description);
  const [status, setStatus] = useState<CareerPostingStatus>(initial.status);
  const [displayOrder, setDisplayOrder] = useState<number>(initial.displayOrder);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

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
    // Not a RAC overlay (that would change its focus/Escape behaviour); it borrows
    // the admin modal look and an enter animation via admin-fade-in / admin-modal-pop.
    <div className="admin-fade-in fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="career-posting-modal-title"
        className="admin-modal-pop my-8 flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-surface-raised text-left shadow-2xl shadow-black/60 ring-1 ring-line/70"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-line/60 px-6 py-5">
          <div>
            <h2 id="career-posting-modal-title" className="text-lg font-semibold text-foreground">
              {isEditing ? 'Edit career opening' : 'New career opening'}
            </h2>
            <p className="mt-0.5 text-sm text-foreground-secondary">
              {isEditing ? `Modifying ${posting.title}` : 'Post an open staff role to the public careers portal.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className={`${iconBtn} -mr-2 -mt-1`}
          >
            <HiOutlineXMark aria-hidden className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1">
          {error && <AdminNotice tone="danger">{error}</AdminNotice>}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label htmlFor="career-title" className={labelClass}>
                Role title <RequiredMark />
              </label>
              <input
                id="career-title"
                type="text"
                value={title}
                onChange={handleTitleChange}
                placeholder="e.g. Lead Software Engineer"
                className={input}
                required
              />
            </div>

            <div>
              <label htmlFor="career-slug" className={labelClass}>
                URL slug <RequiredMark />
              </label>
              <input
                id="career-slug"
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="e.g. software-engineer"
                className={input}
                required
              />
            </div>

            <div>
              <label htmlFor="career-department" className={labelClass}>
                Department <RequiredMark />
              </label>
              <input
                id="career-department"
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
              <label htmlFor="career-location" className={labelClass}>
                Location
              </label>
              <input
                id="career-location"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Remote (NYC High School League)"
                className={input}
              />
            </div>

            <div>
              <label htmlFor="career-commitment" className={labelClass}>
                Weekly commitment
              </label>
              <input
                id="career-commitment"
                type="text"
                value={commitment}
                onChange={(e) => setCommitment(e.target.value)}
                placeholder="5–10 hours / week"
                className={input}
              />
            </div>

            <div>
              <label htmlFor="career-employment-type" className={labelClass}>
                Employment type
              </label>
              <input
                id="career-employment-type"
                type="text"
                value={employmentType}
                onChange={(e) => setEmploymentType(e.target.value)}
                placeholder="Volunteer / High School Internship"
                className={input}
              />
            </div>

            <div>
              <label htmlFor="career-status" className={labelClass}>
                Publication status
              </label>
              <select
                id="career-status"
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
              <label htmlFor="career-display-order" className={labelClass}>
                Display order <span className="font-normal text-foreground-secondary">(lower numbers appear first)</span>
              </label>
              <input
                id="career-display-order"
                type="number"
                value={displayOrder}
                onChange={(e) => setDisplayOrder(parseInt(e.target.value, 10) || 0)}
                className={input}
              />
            </div>
          </div>

          <div>
            <label htmlFor="career-summary" className={labelClass}>
              Summary <RequiredMark />
              <span className="ml-1 font-normal text-foreground-secondary">(1–2 sentences for listing cards)</span>
            </label>
            <textarea
                id="career-summary"
              rows={2}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Brief summary of the role..."
              className={input}
              required
            />
          </div>

          <div>
            <label htmlFor="career-description" className={labelClass}>
              Job description & requirements (Markdown supported) <RequiredMark />
            </label>
            <textarea
                id="career-description"
              rows={8}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="### Overview&#10;Describe the role...&#10;&#10;### Responsibilities&#10;- Lead development of...&#10;&#10;### Qualifications&#10;- Experience with..."
              className={`${input} font-mono`}
              required
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 border-t border-line/60 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className={ghostBtn}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              aria-busy={loading}
              className={primaryBtn}
            >
              <PendingLabel pending={loading} label={isEditing ? 'Save changes' : 'Create opening'} pendingLabel="Saving…" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

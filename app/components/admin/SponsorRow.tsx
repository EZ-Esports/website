'use client';

import { useState, useTransition, useRef, useEffect } from 'react';
import ConfirmDeleteButton from '@/app/components/admin/ConfirmDeleteButton';
import { updateSponsor, toggleSponsorActive, deleteSponsor } from '@/app/(admin)/admin/sponsors/actions';
import ImageUpload from '@/app/components/admin/ImageUpload';

const tierBadgeClass: Record<string, string> = {
  platinum: 'bg-foreground-secondary/10 text-foreground-secondary',
  gold: 'bg-yellow-500/10 text-yellow-400',
  community: 'bg-blue-500/10 text-blue-400',
};

const tierLabel: Record<string, string> = {
  platinum: 'Platinum',
  gold: 'Gold',
  community: 'Community',
};

interface Sponsor {
  id: string;
  name: string;
  logoUrl: string | null;
  storageKey: string | null;
  tier: 'platinum' | 'gold' | 'community';
  websiteUrl: string | null;
  isActive: boolean | null;
  displayOrder: number | null;
}

const inputClass =
  'w-full px-3 py-2 rounded-lg bg-[#111111] border border-line text-white placeholder-foreground-muted text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent/60 transition-all';

export default function SponsorRow({ sponsor }: { sponsor: Sponsor }) {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const editBtnRef = useRef<HTMLButtonElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) firstFieldRef.current?.focus();
  }, [editing]);

  const closeEditing = () => {
    setEditing(false);
    setTimeout(() => editBtnRef.current?.focus(), 0);
  };

  const handleSave = (formData: FormData) => {
    setSaveError(null);
    startTransition(async () => {
      const res = await updateSponsor(sponsor.id, formData);
      if (res && !res.success) {
        setSaveError(res.error || 'Could not save changes.');
        return;
      }
      closeEditing();
    });
  };

  const handleToggleActive = () => {
    setToggleError(null);
    startTransition(async () => {
      const res = await toggleSponsorActive(sponsor.id, !sponsor.isActive);
      if (res && !res.success) setToggleError(res.error || 'Could not update status.');
    });
  };

  if (editing) {
    return (
      <tr className="bg-surface-raised/60">
        <td colSpan={6} className="py-4 px-3">
          <form action={handleSave} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-foreground-secondary uppercase tracking-wider mb-1">
                Name <span className="text-accent">*</span>
              </label>
              <input ref={firstFieldRef} name="name" required defaultValue={sponsor.name} className={inputClass} />
            </div>
            <div>
              <ImageUpload
                name="logoUrl"
                storageKeyName="storageKey"
                currentSrc={sponsor.logoUrl ?? undefined}
                currentStorageKey={sponsor.storageKey ?? undefined}
                label="Change Logo"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-foreground-secondary uppercase tracking-wider mb-1">Tier</label>
              <select name="tier" defaultValue={sponsor.tier} className={inputClass}>
                <option value="platinum">Platinum</option>
                <option value="gold">Gold</option>
                <option value="community">Community</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-foreground-secondary uppercase tracking-wider mb-1">Website URL</label>
              <input name="websiteUrl" defaultValue={sponsor.websiteUrl ?? ''} placeholder="https://…" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-bold text-foreground-secondary uppercase tracking-wider mb-1">Display Order</label>
              <input name="displayOrder" type="number" defaultValue={sponsor.displayOrder ?? 0} className={inputClass} />
            </div>
            <div className="flex items-end gap-2">
              <button
                type="submit"
                disabled={isPending}
                className="px-4 py-2 bg-accent text-on-accent rounded-lg font-bold text-xs uppercase tracking-wider hover:bg-accent/80 transition-all cursor-pointer disabled:opacity-50"
              >
                {isPending ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                onClick={closeEditing}
                className="px-4 py-2 bg-surface-raised hover:bg-line font-bold text-xs uppercase tracking-wider rounded-lg text-foreground border border-line hover:border-line transition-all cursor-pointer"
              >
                Cancel
              </button>
            </div>
            {saveError && (
              <p role="alert" className="sm:col-span-3 text-xs text-red-400">{saveError}</p>
            )}
          </form>
        </td>
      </tr>
    );
  }

  return (
    <tr className="hover:bg-surface-raised/40 transition-colors">
      <td className="py-3 pr-4 font-semibold text-white">{sponsor.name}</td>
      <td className="py-3 pr-4">
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${tierBadgeClass[sponsor.tier] ?? 'bg-line text-foreground-secondary'}`}>
          {tierLabel[sponsor.tier] ?? sponsor.tier}
        </span>
      </td>
      <td className="py-3 pr-4">
        {sponsor.websiteUrl ? (
          <a
            href={sponsor.websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground-secondary hover:text-white transition-colors truncate max-w-[180px] block"
          >
            {sponsor.websiteUrl}
          </a>
        ) : (
          <span className="text-foreground-muted">—</span>
        )}
      </td>
      <td className="py-3 pr-4">
        <button
          onClick={handleToggleActive}
          disabled={isPending}
          className={`text-xs font-bold px-2.5 py-1 rounded-full cursor-pointer transition-all disabled:opacity-50 ${
            sponsor.isActive ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20' : 'bg-line text-foreground-muted hover:bg-line'
          }`}
        >
          {sponsor.isActive ? 'Active' : 'Inactive'}
        </button>
        {toggleError && (
          <p role="alert" className="text-[10px] text-red-400 mt-1">{toggleError}</p>
        )}
      </td>
      <td className="py-3 pr-4 text-foreground-secondary">{sponsor.displayOrder}</td>
      <td className="py-3 text-right">
        <div className="flex items-center justify-end gap-2">
          <button
            ref={editBtnRef}
            onClick={() => setEditing(true)}
            className="px-3 py-1.5 bg-surface-raised hover:bg-line font-bold text-xs uppercase tracking-wider rounded-lg text-foreground border border-line hover:border-line transition-all cursor-pointer"
          >
            Edit
          </button>
          <ConfirmDeleteButton
            action={() => deleteSponsor(sponsor.id)}
            message={`Delete sponsor "${sponsor.name}"? This cannot be undone.`}
            label="Delete"
            className="px-3 py-1.5 bg-surface-raised hover:bg-red-950/20 font-bold text-xs uppercase tracking-wider rounded-lg text-foreground-secondary hover:text-red-400 border border-line hover:border-red-900/40 transition-all cursor-pointer"
          />
        </div>
      </td>
    </tr>
  );
}

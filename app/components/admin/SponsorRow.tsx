'use client';

import { useState, useTransition } from 'react';
import ConfirmDeleteButton from '@/app/components/admin/ConfirmDeleteButton';
import { updateSponsor, toggleSponsorActive, deleteSponsor } from '@/app/(admin)/admin/sponsors/actions';
import ImageUpload from '@/app/components/admin/ImageUpload';

const tierBadgeClass: Record<string, string> = {
  platinum: 'bg-slate-300/10 text-slate-300',
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
  'w-full px-3 py-2 rounded-lg bg-[#111111] border border-zinc-800 text-white placeholder-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-ez-pink/40 focus:border-ez-pink/60 transition-all';

export default function SponsorRow({ sponsor }: { sponsor: Sponsor }) {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSave = (formData: FormData) => {
    startTransition(async () => {
      await updateSponsor(sponsor.id, formData);
      setEditing(false);
    });
  };

  const handleToggleActive = () => {
    startTransition(() => toggleSponsorActive(sponsor.id, !sponsor.isActive));
  };

  if (editing) {
    return (
      <tr className="bg-zinc-900/60">
        <td colSpan={6} className="py-4 px-3">
          <form action={handleSave} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                Name <span className="text-ez-pink">*</span>
              </label>
              <input name="name" required defaultValue={sponsor.name} className={inputClass} />
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
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Tier</label>
              <select name="tier" defaultValue={sponsor.tier} className={inputClass}>
                <option value="platinum">Platinum</option>
                <option value="gold">Gold</option>
                <option value="community">Community</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Website URL</label>
              <input name="websiteUrl" defaultValue={sponsor.websiteUrl ?? ''} placeholder="https://…" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Display Order</label>
              <input name="displayOrder" type="number" defaultValue={sponsor.displayOrder ?? 0} className={inputClass} />
            </div>
            <div className="flex items-end gap-2">
              <button
                type="submit"
                disabled={isPending}
                className="px-4 py-2 bg-ez-pink text-ez-black rounded-lg font-bold text-xs uppercase tracking-wider hover:bg-ez-pink/80 transition-all cursor-pointer disabled:opacity-50"
              >
                {isPending ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 font-bold text-xs uppercase tracking-wider rounded-lg text-slate-200 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        </td>
      </tr>
    );
  }

  return (
    <tr className="hover:bg-zinc-900/40 transition-colors">
      <td className="py-3 pr-4 font-semibold text-white">{sponsor.name}</td>
      <td className="py-3 pr-4">
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${tierBadgeClass[sponsor.tier] ?? 'bg-zinc-800 text-zinc-400'}`}>
          {tierLabel[sponsor.tier] ?? sponsor.tier}
        </span>
      </td>
      <td className="py-3 pr-4">
        {sponsor.websiteUrl ? (
          <a
            href={sponsor.websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-400 hover:text-white transition-colors truncate max-w-[180px] block"
          >
            {sponsor.websiteUrl}
          </a>
        ) : (
          <span className="text-zinc-600">—</span>
        )}
      </td>
      <td className="py-3 pr-4">
        <button
          onClick={handleToggleActive}
          disabled={isPending}
          className={`text-xs font-bold px-2.5 py-1 rounded-full cursor-pointer transition-all disabled:opacity-50 ${
            sponsor.isActive ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20' : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700'
          }`}
        >
          {sponsor.isActive ? 'Active' : 'Inactive'}
        </button>
      </td>
      <td className="py-3 pr-4 text-slate-400">{sponsor.displayOrder}</td>
      <td className="py-3 text-right">
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => setEditing(true)}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 font-bold text-xs uppercase tracking-wider rounded-lg text-slate-200 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer"
          >
            Edit
          </button>
          <ConfirmDeleteButton
            action={() => deleteSponsor(sponsor.id)}
            message={`Delete sponsor "${sponsor.name}"? This cannot be undone.`}
            label="Delete"
            className="px-3 py-1.5 bg-slate-900 hover:bg-red-950/20 font-bold text-xs uppercase tracking-wider rounded-lg text-slate-300 hover:text-red-400 border border-slate-800 hover:border-red-900/40 transition-all cursor-pointer"
          />
        </div>
      </td>
    </tr>
  );
}

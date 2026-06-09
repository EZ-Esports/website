'use client';

import { useState } from 'react';
import Image from 'next/image';
import ConfirmDeleteButton from '@/app/components/admin/ConfirmDeleteButton';
import { updateGalleryImage, toggleGalleryImageActive, deleteGalleryImage } from '@/app/(admin)/admin/gallery/actions';

interface GalleryImage {
  id: string;
  src: string;
  caption: string | null;
  schoolName: string | null;
  eventName: string | null;
  displayOrder: number | null;
  setId: number | null;
  isActive: boolean | null;
}

interface GalleryImageCardProps {
  img: GalleryImage;
}

const inputClass =
  'w-full px-3 py-2 rounded-lg bg-[#111111] border border-zinc-800 text-white placeholder-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-ez-pink/40 focus:border-ez-pink/60 transition-all';
const editBtnClass =
  'px-3 py-1.5 bg-slate-900 hover:bg-slate-800 font-bold text-xs uppercase tracking-wider rounded-lg text-slate-200 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer';
const deleteBtnClass =
  'px-3 py-1.5 bg-slate-900 hover:bg-red-950/20 font-bold text-xs uppercase tracking-wider rounded-lg text-slate-300 hover:text-red-400 border border-slate-800 hover:border-red-900/40 transition-all cursor-pointer';

export default function GalleryImageCard({ img }: GalleryImageCardProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [pending, setPending] = useState(false);

  const boundUpdate = updateGalleryImage.bind(null, img.id);
  const boundToggle = toggleGalleryImageActive.bind(null, img.id, !img.isActive);
  const boundDelete = deleteGalleryImage.bind(null, img.id);

  return (
    <div className="bg-[#1a1a1a] border border-zinc-800 rounded-xl overflow-hidden group hover:border-zinc-700 transition-all duration-300">
      <div className="relative w-full aspect-square bg-zinc-900">
        <Image
          src={img.src}
          alt={img.caption ?? ''}
          width={200}
          height={200}
          className="w-full h-full object-cover"
          unoptimized
        />
      </div>
      <div className="p-3 space-y-1.5">
        <p className="text-white text-xs font-semibold leading-tight truncate">
          {img.caption || <span className="text-zinc-500 italic">No caption</span>}
        </p>
        {img.schoolName && <p className="text-zinc-400 text-xs truncate">{img.schoolName}</p>}
        {img.eventName && <p className="text-zinc-500 text-xs truncate">{img.eventName}</p>}
        <div className="flex items-center justify-between pt-1 gap-1 flex-wrap">
          <form action={boundToggle} className="inline-block">
            <button
              type="submit"
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full cursor-pointer border transition-all ${
                img.isActive
                  ? 'bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20'
                  : 'bg-zinc-800 text-zinc-500 border-zinc-700 hover:bg-zinc-700'
              }`}
            >
              {img.isActive ? 'Active' : 'Inactive'}
            </button>
          </form>
          <div className="flex items-center gap-1">
            <button onClick={() => setEditOpen((v) => !v)} className={editBtnClass}>
              {editOpen ? 'Cancel' : 'Edit'}
            </button>
            <ConfirmDeleteButton
              action={boundDelete}
              message="Delete this image? This cannot be undone."
              label="Delete"
              className={deleteBtnClass}
            />
          </div>
        </div>

        {editOpen && (
          <form
            action={async (fd) => {
              setPending(true);
              await boundUpdate(fd);
              setPending(false);
              setEditOpen(false);
            }}
            className="mt-3 space-y-2 border-t border-zinc-800 pt-3"
          >
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Image URL</label>
              <input
                name="src"
                type="text"
                required
                defaultValue={img.src}
                placeholder='"/images/gallery/gallery-12.png" or Supabase Storage URL'
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Caption</label>
              <input name="caption" type="text" defaultValue={img.caption ?? ''} className={inputClass} />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">School</label>
              <input name="schoolName" type="text" defaultValue={img.schoolName ?? ''} className={inputClass} />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Event</label>
              <input name="eventName" type="text" defaultValue={img.eventName ?? ''} className={inputClass} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Set</label>
                <select name="setId" defaultValue={img.setId ?? 1} className={inputClass}>
                  <option value="1">Set 1</option>
                  <option value="2">Set 2</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Order</label>
                <input
                  name="displayOrder"
                  type="number"
                  defaultValue={img.displayOrder ?? 0}
                  className={inputClass}
                />
              </div>
            </div>
            <button type="submit" disabled={pending} className={`${editBtnClass} w-full justify-center`}>
              {pending ? 'Saving…' : 'Save Changes'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

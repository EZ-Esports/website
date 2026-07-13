'use client';

import { useState, useTransition, useEffect, useRef } from 'react';
import Image from 'next/image';
import ConfirmDeleteButton from '@/app/components/admin/ConfirmDeleteButton';
import { updateGalleryImage, toggleGalleryImageActive, deleteGalleryImage } from '@/app/(admin)/admin/gallery/actions';
import ImageUpload from '@/app/components/admin/ImageUpload';

interface GalleryImage {
  id: string;
  src: string;
  storageKey: string | null;
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
  'w-full px-3 py-2 rounded-lg bg-[#111111] border border-line text-white placeholder-foreground-muted text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent/60 transition-all';
const editBtnClass =
  'px-3 py-1.5 bg-surface-raised hover:bg-line font-bold text-xs uppercase tracking-wider rounded-lg text-foreground border border-line hover:border-line transition-all cursor-pointer';
const deleteBtnClass =
  'px-3 py-1.5 bg-surface-raised hover:bg-red-950/20 font-bold text-xs uppercase tracking-wider rounded-lg text-foreground-secondary hover:text-red-400 border border-line hover:border-red-900/40 transition-all cursor-pointer';

export default function GalleryImageCard({ img }: GalleryImageCardProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [togglePending, startToggle] = useTransition();
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const editBtnRef = useRef<HTMLButtonElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editOpen) firstFieldRef.current?.focus();
  }, [editOpen]);

  const toggleEdit = () => {
    setEditOpen((open) => {
      const next = !open;
      if (!next) {
        // Closing (Cancel): clear any prior error and return focus to the trigger.
        setEditError(null);
        setTimeout(() => editBtnRef.current?.focus(), 0);
      }
      return next;
    });
  };

  const boundUpdate = updateGalleryImage.bind(null, img.id);
  const boundDelete = deleteGalleryImage.bind(null, img.id);

  const handleToggleActive = () => {
    setToggleError(null);
    startToggle(async () => {
      const res = await toggleGalleryImageActive(img.id, !img.isActive);
      if (res && !res.success) setToggleError(res.error || 'Could not update status.');
    });
  };

  return (
    <div className="bg-[#1a1a1a] border border-line rounded-xl overflow-hidden group hover:border-line transition-all duration-300">
      <div className="relative w-full aspect-square bg-surface-raised">
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
          {img.caption || <span className="text-foreground-muted italic">No caption</span>}
        </p>
        {img.schoolName && <p className="text-foreground-secondary text-xs truncate">{img.schoolName}</p>}
        {img.eventName && <p className="text-foreground-muted text-xs truncate">{img.eventName}</p>}
        <div className="flex items-center justify-between pt-1 gap-1 flex-wrap">
          <button
            type="button"
            onClick={handleToggleActive}
            disabled={togglePending}
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full cursor-pointer border transition-all disabled:opacity-50 ${
              img.isActive
                ? 'bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20'
                : 'bg-line text-foreground-muted border-line hover:bg-line'
            }`}
          >
            {img.isActive ? 'Active' : 'Inactive'}
          </button>
          <div className="flex items-center gap-1">
            <button ref={editBtnRef} onClick={toggleEdit} className={editBtnClass}>
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

        {toggleError && (
          <p role="alert" className="text-[10px] text-red-400">{toggleError}</p>
        )}

        {editOpen && (
          <form
            action={async (fd) => {
              setPending(true);
              setEditError(null);
              const res = await boundUpdate(fd);
              setPending(false);
              if (res && !res.success) {
                setEditError(res.error || 'Could not save changes.');
                return;
              }
              setEditOpen(false);
              setTimeout(() => editBtnRef.current?.focus(), 0);
            }}
            className="mt-3 space-y-2 border-t border-line pt-3"
          >
            <div>
              <ImageUpload
                name="src"
                storageKeyName="storageKey"
                currentSrc={img.src}
                currentStorageKey={img.storageKey ?? undefined}
                label="Change Image"
              />
            </div>
            <div>
              {/* Caption is required — also serves as image alt text (WCAG) */}
              <label className="block text-[10px] font-bold text-foreground-secondary uppercase tracking-wider mb-1">
                Caption / Alt Text <span className="text-accent">*</span>
              </label>
              <input ref={firstFieldRef} name="caption" type="text" required defaultValue={img.caption ?? ''} className={inputClass} />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-foreground-secondary uppercase tracking-wider mb-1">School</label>
              <input name="schoolName" type="text" defaultValue={img.schoolName ?? ''} className={inputClass} />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-foreground-secondary uppercase tracking-wider mb-1">Event</label>
              <input name="eventName" type="text" defaultValue={img.eventName ?? ''} className={inputClass} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-foreground-secondary uppercase tracking-wider mb-1">Set</label>
                <select name="setId" defaultValue={img.setId ?? 1} className={inputClass}>
                  <option value="1">Set 1</option>
                  <option value="2">Set 2</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-foreground-secondary uppercase tracking-wider mb-1">Order</label>
                <input
                  name="displayOrder"
                  type="number"
                  defaultValue={img.displayOrder ?? 0}
                  className={inputClass}
                />
              </div>
            </div>
            <button type="submit" disabled={pending} className="w-full px-3 py-1.5 bg-accent hover:bg-accent/80 font-bold text-xs uppercase tracking-wider rounded-lg text-on-accent transition-all cursor-pointer disabled:opacity-50">
              {pending ? 'Saving…' : 'Save Changes'}
            </button>
            {editError && (
              <p role="alert" className="text-[10px] text-red-400">{editError}</p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}

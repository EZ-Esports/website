'use client';

import { useState, useTransition, useEffect, useRef } from 'react';
import Image from 'next/image';
import { HiChevronLeft, HiChevronRight } from 'react-icons/hi2';
import ConfirmDeleteButton from '@/app/components/admin/ConfirmDeleteButton';
import RowIconButton from '@/app/components/admin/RowIconButton';
import { updateGalleryImage, toggleGalleryImageActive, deleteGalleryImage } from '@/app/(admin)/admin/gallery/actions';
import ImageUpload from '@/app/components/admin/ImageUpload';
import { AdminNotice, PendingLabel, RequiredMark } from '@/app/components/admin/AdminUI';
import { cardHover, chip, chipButton, chipDot, fieldError, focusRing, input, label as labelClass, primaryBtnSm } from '@/app/components/admin/styles';
import { cx } from '@/app/lib/cx';

interface GalleryImage {
  id: string;
  src: string;
  storageKey: string | null;
  caption: string | null;
  schoolName: string | null;
  eventName: string | null;
  displayOrder: number | null;
  isActive: boolean | null;
}

interface GalleryImageCardProps {
  img: GalleryImage;
  index: number;
  totalCount: number;
  onOrderChange: (currentIndex: number, newIndex: number) => void;
}

const inputClass = input;

/** Reorder arrow: aria-disabled at the ends (not `disabled`) so keyboard focus is never dropped. */
const moveBtn = cx(
  'inline-flex h-7 w-7 items-center justify-center rounded-md text-foreground-secondary transition-colors duration-150 cursor-pointer',
  'hover:text-foreground hover:bg-line/70 aria-disabled:opacity-30 aria-disabled:cursor-not-allowed aria-disabled:hover:bg-transparent',
  focusRing,
);

export default function GalleryImageCard({ img, index, totalCount, onOrderChange }: GalleryImageCardProps) {
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
    // No hover lift while the edit form is open: the card is a workspace then, not a target.
    <div className={cx('group flex h-full flex-col overflow-hidden rounded-xl bg-admin-panel', editOpen ? 'ring-1 ring-accent/30' : cardHover)}>
      <div className="relative w-full aspect-square overflow-hidden bg-surface-raised">
        <Image
          src={img.src}
          alt={img.caption ?? ''}
          width={200}
          height={200}
          sizes="(max-width: 640px) 100vw, 200px"
          className="h-full w-full object-cover transition-[scale] duration-500 ease-out group-hover:scale-[1.03] motion-reduce:transition-none"
        />
      </div>
      <div className="p-3 flex flex-col flex-grow gap-3">
        <div className="space-y-1.5">
          <div className="flex items-start justify-between gap-1">
            <p id={`caption-${img.id}`} className="flex-grow text-sm font-medium leading-snug text-foreground line-clamp-2">
              {img.caption || <span className="text-foreground-secondary">No caption</span>}
            </p>
            <span className={cx(chip('accent', 'sm'), 'shrink-0 self-start tabular-nums')}>
              #{index + 1}
            </span>
          </div>
          {img.schoolName && <p className="truncate text-xs text-foreground-secondary">{img.schoolName}</p>}
          {img.eventName && <p className="truncate text-xs text-foreground-secondary">{img.eventName}</p>}
        </div>

        {totalCount > 1 && (
          <div className="flex items-center justify-between gap-2 rounded-lg bg-surface-sunken/70 p-1">
            <button
              type="button"
              onClick={() => index > 0 && onOrderChange(index, index - 1)}
              aria-disabled={index === 0}
              aria-label="Move earlier in the gallery order"
              aria-describedby={`caption-${img.id}`}
              className={moveBtn}
            >
              <HiChevronLeft aria-hidden className="w-4 h-4" />
            </button>
            <span className="text-xs text-foreground-secondary tabular-nums">
              Position <span className="font-medium text-foreground">{index + 1}</span> of {totalCount}
            </span>
            <button
              type="button"
              onClick={() => index < totalCount - 1 && onOrderChange(index, index + 1)}
              aria-disabled={index === totalCount - 1}
              aria-label="Move later in the gallery order"
              aria-describedby={`caption-${img.id}`}
              className={moveBtn}
            >
              <HiChevronRight aria-hidden className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="mt-auto space-y-2">
          <div className="flex items-center justify-between pt-1 gap-1 flex-wrap">
            <button
              type="button"
              onClick={handleToggleActive}
              disabled={togglePending}
              title={img.isActive ? 'Click to hide from the public gallery' : 'Click to show in the public gallery'}
              className={chipButton(img.isActive ? 'success' : 'neutral')}
            >
              <span aria-hidden className={chipDot} />
              {img.isActive ? 'Active' : 'Inactive'}
            </button>
            <div className="flex items-center gap-2">
              <RowIconButton
                ref={editBtnRef}
                kind={editOpen ? 'cancel' : 'edit'}
                onClick={toggleEdit}
                aria-expanded={editOpen}
                label={editOpen ? 'Cancel editing image' : 'Edit image'}
              />
              <ConfirmDeleteButton
                action={boundDelete}
                message="Delete this image? This cannot be undone."
                label="Delete image"
              />
            </div>
          </div>

          {toggleError && (
            <p role="alert" aria-live="polite" className={fieldError}>{toggleError}</p>
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
              className="admin-fade-in mt-3 space-y-3 border-t border-line/60 pt-3"
            >
              <div>
                <ImageUpload
                  section="gallery"
                  entityId={img.id}
                  name="src"
                  storageKeyName="storageKey"
                  currentSrc={img.src}
                  currentStorageKey={img.storageKey ?? undefined}
                  label="Change image"
                />
              </div>
              <div>
                {/* Caption is required — also serves as image alt text (WCAG) */}
                <label htmlFor={`caption-input-${img.id}`} className={labelClass}>
                  Caption / alt text <RequiredMark />
                </label>
                <input ref={firstFieldRef} id={`caption-input-${img.id}`} name="caption" type="text" required defaultValue={img.caption ?? ''} className={inputClass} />
              </div>
              <div>
                <label htmlFor={`school-input-${img.id}`} className={labelClass}>School</label>
                <input id={`school-input-${img.id}`} name="schoolName" type="text" defaultValue={img.schoolName ?? ''} className={inputClass} />
              </div>
              <div>
                <label htmlFor={`event-input-${img.id}`} className={labelClass}>Event</label>
                <input id={`event-input-${img.id}`} name="eventName" type="text" defaultValue={img.eventName ?? ''} className={inputClass} />
              </div>
              <button type="submit" disabled={pending} aria-busy={pending} className={cx(primaryBtnSm, 'w-full')}>
                <PendingLabel pending={pending} label="Save changes" pendingLabel="Saving…" />
              </button>
              {editError && <AdminNotice tone="danger">{editError}</AdminNotice>}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

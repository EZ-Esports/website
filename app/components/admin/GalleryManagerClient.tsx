'use client';

import { useState, useMemo, useTransition } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import GalleryImageCard from '@/app/components/admin/GalleryImageCard';
import { updateGalleryImagesOrder } from '@/app/(admin)/admin/gallery/actions';

export interface GalleryImage {
  id: string;
  src: string;
  storageKey: string | null;
  caption: string | null;
  schoolName: string | null;
  eventName: string | null;
  displayOrder: number | null;
  isActive: boolean | null;
}

interface GalleryManagerClientProps {
  initialImages: GalleryImage[];
}

export function moveItem<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

export function deriveDisplayImages(
  initialImages: GalleryImage[],
  draftOrder: string[] | null
): GalleryImage[] {
  if (!draftOrder) {
    return initialImages;
  }
  const imageMap = new Map(initialImages.map((img) => [img.id, img]));
  const preserved: GalleryImage[] = [];
  const seenIds = new Set<string>();

  for (const id of draftOrder) {
    const img = imageMap.get(id);
    if (img && !seenIds.has(id)) {
      preserved.push(img);
      seenIds.add(id);
    }
  }

  const added = initialImages.filter((img) => !seenIds.has(img.id));
  return [...preserved, ...added];
}

export function isDraftDirty(
  initialIds: string[],
  draftOrder: string[] | null
): boolean {
  if (!draftOrder) return false;
  if (draftOrder.length !== initialIds.length) return true;
  return draftOrder.some((id, i) => id !== initialIds[i]);
}

export function canMoveItem({
  pending,
  currentIndex,
  newIndex,
  totalCount,
}: {
  pending: boolean;
  currentIndex: number;
  newIndex: number;
  totalCount: number;
}): boolean {
  return !pending && newIndex >= 0 && newIndex < totalCount && newIndex !== currentIndex;
}

export default function GalleryManagerClient({ initialImages }: GalleryManagerClientProps) {
  const [draftOrder, setDraftOrder] = useState<string[] | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const initialIds = useMemo(() => initialImages.map((img) => img.id), [initialImages]);
  const isDirty = isDraftDirty(initialIds, draftOrder);
  const reduceMotion = useReducedMotion();

  const displayImages = useMemo(
    () => deriveDisplayImages(initialImages, draftOrder),
    [initialImages, draftOrder]
  );

  const handleMove = (currentIndex: number, newIndex: number) => {
    if (!canMoveItem({ pending, currentIndex, newIndex, totalCount: displayImages.length })) return;
    setSuccess(false);
    setError(null);
    const currentOrder = displayImages.map((img) => img.id);
    setDraftOrder(moveItem(currentOrder, currentIndex, newIndex));
  };

  const handleReset = () => {
    setDraftOrder(null);
    setError(null);
    setSuccess(false);
  };

  const handleSaveChanges = () => {
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      try {
        const orderedIds = displayImages.map((img) => img.id);
        const res = await updateGalleryImagesOrder(orderedIds);
        if (res?.success) {
          setDraftOrder(null);
          setSuccess(true);
          setTimeout(() => setSuccess(false), 3000);
        } else {
          setError(res?.error || 'Failed to update image order.');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update image order.');
      }
    });
  };

  return (
    <div className="space-y-6 relative pb-24">
      {error && (
        <div role="alert" className="p-4 bg-red-950/20 border border-red-900/40 rounded-xl text-red-400 text-sm">
          {error}
        </div>
      )}

      {success && (
        <div role="status" className="p-4 bg-green-950/20 border border-green-900/40 rounded-xl text-green-400 text-sm">
          Gallery order saved successfully!
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
        {displayImages.map((img, index) => (
          <motion.div
            key={img.id}
            layout={reduceMotion ? false : 'position'}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="h-full"
          >
            <GalleryImageCard img={img} index={index} totalCount={displayImages.length} onOrderChange={handleMove} />
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {isDirty && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#161616]/95 backdrop-blur-md border border-line px-6 py-4 rounded-2xl shadow-2xl flex items-center justify-between gap-6 max-w-xl w-[calc(100%-2rem)]"
          >
            <div className="flex-grow">
              <p className="text-sm font-bold text-white">Unsaved order changes</p>
              <p className="text-xs text-foreground-secondary">Use the arrow buttons to reposition an image, then save.</p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={handleReset}
                disabled={pending}
                className="px-4 py-2 border border-line text-foreground-secondary hover:text-white rounded-lg text-sm font-semibold transition-all cursor-pointer disabled:opacity-50"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={handleSaveChanges}
                disabled={pending}
                className="px-5 py-2 bg-accent hover:bg-accent/80 text-on-accent rounded-lg text-sm font-bold transition-all cursor-pointer shadow-lg shadow-accent/20 disabled:opacity-50"
              >
                {pending ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

'use client';

import { useState, useEffect, useTransition } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import GalleryImageCard from '@/app/components/admin/GalleryImageCard';
import { updateGalleryImagesOrder } from '@/app/(admin)/admin/gallery/actions';

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

interface GalleryManagerClientProps {
  initialImages: GalleryImage[];
}

function moveItem(images: GalleryImage[], fromIndex: number, toIndex: number): GalleryImage[] {
  const next = [...images];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

export default function GalleryManagerClient({ initialImages }: GalleryManagerClientProps) {
  const [images, setImages] = useState<GalleryImage[]>(initialImages);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const isDirty = images.map((img) => img.id).join(',') !== initialImages.map((img) => img.id).join(',');
  const reduceMotion = useReducedMotion();

  // Keep in sync with server-side changes (new/deleted images, edited fields).
  // With no unsaved reorder pending, there's nothing local to protect — always trust
  // the latest server data and order outright. With a reorder pending, only step in if
  // the id set actually changed (someone added or deleted an image mid-drag): merge by
  // keeping the local order for images that still exist, refreshing their fields,
  // dropping removed ones, and appending newly added ones to the end. If the id set is
  // unchanged, leave the in-progress local reorder alone.
  useEffect(() => {
    if (!isDirty) {
      setImages(initialImages);
      return;
    }

    const incomingIds = new Set(initialImages.map((img) => img.id));
    const idsMatch = images.length === initialImages.length && images.every((img) => incomingIds.has(img.id));
    if (idsMatch) return;

    const byId = new Map(initialImages.map((img) => [img.id, img]));
    const preserved = images.filter((img) => byId.has(img.id)).map((img) => byId.get(img.id)!);
    const preservedIds = new Set(preserved.map((img) => img.id));
    const added = initialImages.filter((img) => !preservedIds.has(img.id));
    setImages([...preserved, ...added]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialImages]);

  const handleSliderChange = (currentIndex: number, newIndex: number) => {
    if (newIndex < 0 || newIndex >= images.length || newIndex === currentIndex) return;
    setSuccess(false);
    setError(null);
    setImages((current) => moveItem(current, currentIndex, newIndex));
  };

  const handleReset = () => {
    setImages(initialImages);
    setError(null);
    setSuccess(false);
  };

  const handleSaveChanges = () => {
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const orderedIds = images.map((img) => img.id);
      const res = await updateGalleryImagesOrder(orderedIds);
      if (res && !res.success) {
        setError(res.error || 'Failed to update image order.');
      } else {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
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
        {images.map((img, index) => (
          <motion.div
            key={img.id}
            layout={reduceMotion ? false : 'position'}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="h-full"
          >
            <GalleryImageCard img={img} index={index} totalCount={images.length} onOrderChange={handleSliderChange} />
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
              <p className="text-xs text-foreground-secondary">Drag a slider to reposition an image, then save.</p>
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

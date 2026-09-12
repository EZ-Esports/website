'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import type { Image as ImageType } from '@/app/types';
import Badge from '@/app/components/ui/Badge';
import { Overlay, Modal, Dialog } from '@/app/components/ui/overlay';

interface GalleryGridProps {
  items: ImageType[];
}

export default function GalleryGrid({ items }: GalleryGridProps) {
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);

  const closeLightbox = useCallback(() => setSelectedImageIndex(null), []);

  const showNext = useCallback(() => {
    setSelectedImageIndex((i) => (i === null ? null : (i + 1) % items.length));
  }, [items.length]);

  const showPrev = useCallback(() => {
    setSelectedImageIndex((i) => (i === null ? null : (i - 1 + items.length) % items.length));
  }, [items.length]);

  // Global keyboard navigation for the lightbox
  useEffect(() => {
    if (selectedImageIndex === null) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        showNext();
      } else if (e.key === 'ArrowLeft') {
        showPrev();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedImageIndex, showNext, showPrev]);

  if (!items || items.length === 0) {
    return (
      <div className="text-center py-16 text-foreground-secondary">
        <p className="text-lg font-semibold">No gallery photos found.</p>
        <p className="text-sm text-foreground-muted mt-2">Check back soon as new event photos are uploaded!</p>
      </div>
    );
  }

  return (
    <div>
      {/* Photo Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
        {items.map((item, index) => (
          <button
            key={item.id || index}
            type="button"
            onClick={() => setSelectedImageIndex(index)}
            aria-label={`View photo: ${item.alt}`}
            className="group rounded-2xl overflow-hidden bg-surface-raised/40 border border-line/80 hover:border-accent/50 shadow-md hover:shadow-xl transition-all duration-300 flex flex-col text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <div className="relative aspect-[16/10] w-full overflow-hidden block">
              <Image
                src={item.src}
                alt={item.alt}
                fill
                unoptimized
                sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                className="object-cover transition-transform duration-500 group-hover:scale-105 pointer-events-none"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                <Badge
                  variant="accent"
                  size="sm"
                  className="opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-md"
                >
                  View Photo
                </Badge>
              </div>
            </div>
            <div className="p-3 sm:p-4 flex flex-col flex-grow justify-between bg-surface-raised/20 w-full">
              <p className="text-xs sm:text-sm font-medium text-foreground-secondary line-clamp-2">
                {item.alt}
              </p>
            </div>
          </button>
        ))}
      </div>

      {/* Lightbox Modal */}
      <Overlay
        isOpen={selectedImageIndex !== null}
        onOpenChange={(open) => !open && closeLightbox()}
        isDismissable
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm p-4 cursor-zoom-out"
      >
        <Modal className="outline-none max-w-5xl w-full flex items-center justify-center cursor-default">
          <Dialog
            className="outline-none relative w-full flex flex-col items-center justify-center"
            aria-label={selectedImageIndex !== null ? items[selectedImageIndex]?.alt : 'Photo viewer'}
            aria-describedby={selectedImageIndex !== null ? 'lightbox-caption' : undefined}
          >
            {selectedImageIndex !== null && (
              <>
                {/* Close Button */}
                <button
                  type="button"
                  onClick={closeLightbox}
                  className="absolute top-2 right-2 md:-top-12 md:right-0 text-foreground/80 hover:text-foreground p-2 bg-surface-raised/40 hover:bg-surface-raised/80 rounded-full border border-line/60 transition-colors cursor-pointer z-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  aria-label="Close photo viewer"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>

                {/* Navigation Controls */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    showPrev();
                  }}
                  className="absolute left-2 md:-left-14 top-1/2 -translate-y-1/2 text-foreground/80 hover:text-foreground p-2.5 md:p-3 bg-surface-raised/40 hover:bg-surface-raised/80 rounded-full border border-line/60 transition-colors cursor-pointer z-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  aria-label="Previous photo"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    showNext();
                  }}
                  className="absolute right-2 md:-right-14 top-1/2 -translate-y-1/2 text-foreground/80 hover:text-foreground p-2.5 md:p-3 bg-surface-raised/40 hover:bg-surface-raised/80 rounded-full border border-line/60 transition-colors cursor-pointer z-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  aria-label="Next photo"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                {/* Active Image and Caption */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={selectedImageIndex}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.15 }}
                    className="flex flex-col items-center max-w-full"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="relative max-h-[75vh] w-auto flex items-center justify-center">
                      <Image
                        src={items[selectedImageIndex].src}
                        alt={items[selectedImageIndex].alt}
                        width={1200}
                        height={800}
                        unoptimized
                        priority
                        className="object-contain max-h-[75vh] w-auto h-auto rounded-lg shadow-2xl select-none"
                      />
                    </div>
                    <div id="lightbox-caption" className="mt-3 text-center text-foreground-secondary text-xs sm:text-sm max-w-xl px-4">
                      <span className="font-semibold text-foreground/90">{selectedImageIndex + 1} / {items.length}</span>
                      {items[selectedImageIndex].alt && (
                        <span> • {items[selectedImageIndex].alt}</span>
                      )}
                    </div>
                  </motion.div>
                </AnimatePresence>
              </>
            )}
          </Dialog>
        </Modal>
      </Overlay>
    </div>
  );
}

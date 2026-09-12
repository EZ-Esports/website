'use client';

import { useState } from 'react';
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

  const closeLightbox = () => setSelectedImageIndex(null);

  const navigateLightbox = (direction: 'next' | 'prev', e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedImageIndex === null) return;
    let newIndex = direction === 'next' ? selectedImageIndex + 1 : selectedImageIndex - 1;
    if (newIndex >= items.length) newIndex = 0;
    if (newIndex < 0) newIndex = items.length - 1;
    setSelectedImageIndex(newIndex);
  };

  const handleLightboxKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') {
      setSelectedImageIndex((i) => (i === null ? null : (i + 1) % items.length));
    }
    if (e.key === 'ArrowLeft') {
      setSelectedImageIndex((i) => (i === null ? null : (i - 1 + items.length) % items.length));
    }
  };

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
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
        {items.map((item, index) => (
          <div
            key={item.id || index}
            className="group rounded-2xl overflow-hidden bg-surface-raised/40 border border-line/80 hover:border-accent/50 shadow-md hover:shadow-xl transition-all duration-300 flex flex-col"
          >
            <button
              type="button"
              onClick={() => setSelectedImageIndex(index)}
              aria-label={`View photo: ${item.alt}`}
              className="relative aspect-[16/10] w-full overflow-hidden block cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
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
            </button>
            <div className="p-3 sm:p-4 flex flex-col flex-grow justify-between bg-surface-raised/20">
              <p className="text-xs sm:text-sm font-medium text-foreground-secondary line-clamp-2">
                {item.alt}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Lightbox Modal */}
      <Overlay
        isOpen={selectedImageIndex !== null}
        onOpenChange={(open) => !open && closeLightbox()}
        isDismissable
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm p-4 cursor-zoom-out animate-fade-in"
      >
        <Modal className="contents">
          <div className="contents" onKeyDown={handleLightboxKeyDown}>
            <Dialog
              className="outline-none"
              aria-label={selectedImageIndex !== null ? items[selectedImageIndex]?.alt : 'Photo viewer'}
              aria-describedby={selectedImageIndex !== null ? 'lightbox-caption' : undefined}
            >
              {selectedImageIndex !== null && (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={selectedImageIndex}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="contents"
                  >
                    {/* Close Button */}
                    <button
                      onClick={closeLightbox}
                      className="absolute top-6 right-6 text-foreground hover:text-accent p-2 bg-surface-sunken/40 rounded-full border border-line/60 transition-colors cursor-pointer z-50"
                      aria-label="Close photo viewer"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>

                    {/* Navigation Controls */}
                    <button
                      onClick={(e) => navigateLightbox('prev', e)}
                      className="absolute left-4 md:left-8 top-1/2 -translate-y-1/2 text-foreground hover:text-accent p-3 bg-surface-sunken/40 rounded-full border border-line/60 transition-colors cursor-pointer z-50"
                      aria-label="Previous photo"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>

                    <button
                      onClick={(e) => navigateLightbox('next', e)}
                      className="absolute right-4 md:right-8 top-1/2 -translate-y-1/2 text-foreground hover:text-accent p-3 bg-surface-sunken/40 rounded-full border border-line/60 transition-colors cursor-pointer z-50"
                      aria-label="Next photo"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>

                    {/* Active Image */}
                    <div
                      className="relative max-w-5xl max-h-[80vh] w-full h-full flex items-center justify-center cursor-default"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Image
                        src={items[selectedImageIndex].src}
                        alt={items[selectedImageIndex].alt}
                        width={1200}
                        height={800}
                        unoptimized
                        priority
                        className="object-contain max-h-[80vh] w-auto h-auto rounded-lg shadow-2xl select-none"
                      />
                      <div id="lightbox-caption" className="absolute bottom-[-40px] left-0 right-0 text-center text-foreground-secondary text-sm">
                        {selectedImageIndex + 1} / {items.length} • {items[selectedImageIndex].alt}
                      </div>
                    </div>
                  </motion.div>
                </AnimatePresence>
              )}
            </Dialog>
          </div>
        </Modal>
      </Overlay>
    </div>
  );
}

'use client';

import { useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import type { Image as ImageType, GridColumns } from '@/app/types';
import Section from '@/app/components/ui/Section';
import { SectionHeader } from '@/app/components/ui/SectionHeader';
import Badge from '@/app/components/ui/Badge';
import { Overlay, Modal, Dialog } from '@/app/components/ui/overlay';

interface MediaGridProps {
  items: ImageType[];
  columns?: GridColumns;
  /** Optional heading rendered above the gallery via the shared SectionHeader primitive. */
  eyebrow?: string;
  heading?: string;
}

interface IndexedImage extends ImageType {
  originalIndex: number;
}

function prepareTrackItems(row: IndexedImage[], minCount = 8): IndexedImage[] {
  if (row.length === 0) return [];
  const repetitions = Math.ceil(minCount / row.length);
  return Array.from({ length: repetitions }, () => row).flat();
}

function MarqueeCard({
  item,
  onSelect,
}: {
  item: IndexedImage;
  onSelect: (index: number) => void;
}) {
  return (
    <div className="w-64 sm:w-80 md:w-96 shrink-0 select-none">
      <div className="aspect-[16/10] rounded-2xl overflow-hidden relative border border-line/80 hover:border-accent/50 group/card transition-all duration-300 bg-surface-raised/40 shadow-md hover:shadow-xl">
        <button
          type="button"
          onClick={() => onSelect(item.originalIndex)}
          aria-label={`View photo: ${item.alt}`}
          className="w-full h-full relative block cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Image
            src={item.src}
            alt={item.alt}
            fill
            unoptimized
            loading="lazy"
            sizes="(max-width: 640px) 256px, (max-width: 768px) 320px, 384px"
            className="object-cover transition-transform duration-500 group-hover/card:scale-105 pointer-events-none"
          />

          <div className="absolute inset-0 bg-black/0 group-hover/card:bg-black/30 transition-colors flex items-center justify-center">
            <Badge
              variant="accent"
              size="sm"
              className="opacity-0 group-hover/card:opacity-100 transition-all duration-200 shadow-md"
            >
              View Photo
            </Badge>
          </div>
        </button>
      </div>
    </div>
  );
}

export default function MediaGrid({ items, eyebrow, heading }: MediaGridProps) {
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);

  if (!items || items.length === 0) return null;

  const indexedItems: IndexedImage[] = items.map((item, originalIndex) => ({
    ...item,
    originalIndex,
  }));

  const row1Raw = indexedItems.filter((_, i) => i % 2 === 0);
  const row2Raw = indexedItems.filter((_, i) => i % 2 !== 0);

  const row1 = prepareTrackItems(row1Raw.length > 0 ? row1Raw : indexedItems);
  const row2 = prepareTrackItems(row2Raw.length > 0 ? row2Raw : indexedItems);

  // Lightbox controls
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
    if (e.key === 'ArrowRight') setSelectedImageIndex((i) => (i === null ? null : (i + 1) % items.length));
    if (e.key === 'ArrowLeft') setSelectedImageIndex((i) => (i === null ? null : (i - 1 + items.length) % items.length));
  };

  return (
    <Section tone="default" className="border-t border-line/30 overflow-hidden">
      {heading && <SectionHeader eyebrow={eyebrow} title={heading} />}

      {/* Dual Infinite Marquee Container */}
      <div className="relative group/marquee pause-on-hover py-2">
        {/* Left Gradient Fade Mask */}
        <div
          className="pointer-events-none absolute inset-y-0 left-0 w-12 sm:w-28 md:w-36 bg-gradient-to-r from-surface to-transparent z-10"
          aria-hidden="true"
        />

        {/* Right Gradient Fade Mask */}
        <div
          className="pointer-events-none absolute inset-y-0 right-0 w-12 sm:w-28 md:w-36 bg-gradient-to-l from-surface to-transparent z-10"
          aria-hidden="true"
        />

        <div className="space-y-4 sm:space-y-6">
          {/* Top Row: Scrolls Left */}
          <div className="overflow-hidden flex">
            <div className="flex shrink-0 gap-4 sm:gap-6 pr-4 sm:pr-6 animate-marquee-left">
              {row1.map((item, idx) => (
                <MarqueeCard key={`row1-a-${item.id || idx}-${idx}`} item={item} onSelect={setSelectedImageIndex} />
              ))}
            </div>
            <div className="flex shrink-0 gap-4 sm:gap-6 pr-4 sm:pr-6 animate-marquee-left" aria-hidden="true">
              {row1.map((item, idx) => (
                <MarqueeCard key={`row1-b-${item.id || idx}-${idx}`} item={item} onSelect={setSelectedImageIndex} />
              ))}
            </div>
          </div>

          {/* Bottom Row: Scrolls Right */}
          <div className="overflow-hidden flex">
            <div className="flex shrink-0 gap-4 sm:gap-6 pr-4 sm:pr-6 animate-marquee-right">
              {row2.map((item, idx) => (
                <MarqueeCard key={`row2-a-${item.id || idx}-${idx}`} item={item} onSelect={setSelectedImageIndex} />
              ))}
            </div>
            <div className="flex shrink-0 gap-4 sm:gap-6 pr-4 sm:pr-6 animate-marquee-right" aria-hidden="true">
              {row2.map((item, idx) => (
                <MarqueeCard key={`row2-b-${item.id || idx}-${idx}`} item={item} onSelect={setSelectedImageIndex} />
              ))}
            </div>
          </div>
        </div>
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
    </Section>
  );
}

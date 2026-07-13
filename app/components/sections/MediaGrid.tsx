'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { Image as ImageType, GridColumns } from '@/app/types';
import { GALLERY_ITEM_WIDTHS } from '@/app/lib/constants';
import { SectionHeader } from '@/app/components/ui/SectionHeader';
import { Overlay, Modal, Dialog } from '@/app/components/ui/overlay';

function GalleryItem({ item, index, widthClass, onOpen }: { item: ImageType; index: number; widthClass: string; onOpen: (i: number) => void }) {
  const [errored, setErrored] = useState(false);
  if (errored) return null;
  return (
    <button
      type="button"
      onClick={() => onOpen(index)}
      aria-label={`View photo: ${item.alt}`}
      className={`${widthClass} shrink-0 aspect-square rounded-xl overflow-hidden relative border border-line/80 hover:border-accent/50 cursor-pointer transition-all duration-200 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-surface`}
    >
      <Image
        src={item.src}
        alt={item.alt}
        fill
        sizes="(max-width: 768px) 50vw, 25vw"
        className="object-cover transition-opacity duration-300 group-hover:opacity-80"
        onError={() => setErrored(true)}
      />
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
        <span className="text-on-accent bg-accent px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-all duration-200">
          View Photo
        </span>
      </div>
    </button>
  );
}

interface MediaGridProps {
  items: ImageType[];
  columns?: GridColumns;
  /** Optional heading rendered above the grid via the shared SectionHeader primitive. */
  eyebrow?: string;
  heading?: string;
}

export default function MediaGrid({ items, columns = 3, eyebrow, heading }: MediaGridProps) {
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);

  const openLightbox = (index: number) => {
    setSelectedImageIndex(index);
  };

  const closeLightbox = () => {
    setSelectedImageIndex(null);
  };

  const navigateLightbox = (direction: 'next' | 'prev', e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedImageIndex === null) return;

    let newIndex = direction === 'next' ? selectedImageIndex + 1 : selectedImageIndex - 1;
    if (newIndex >= items.length) newIndex = 0;
    if (newIndex < 0) newIndex = items.length - 1;

    setSelectedImageIndex(newIndex);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') setSelectedImageIndex(i => i === null ? null : (i + 1) % items.length);
    if (e.key === 'ArrowLeft') setSelectedImageIndex(i => i === null ? null : (i - 1 + items.length) % items.length);
  };

  return (
    <section className="bg-surface text-foreground py-16 md:py-24 border-t border-line/30">
      <div className="container mx-auto px-4">
        {heading && <SectionHeader eyebrow={eyebrow} title={heading} />}
        <div className="flex flex-wrap justify-center gap-6">
          {items.map((item, index) => (
            <GalleryItem key={item.id || index} item={item} index={index} widthClass={GALLERY_ITEM_WIDTHS[columns]} onOpen={openLightbox} />
          ))}
        </div>
      </div>

      {/* Lightbox Modal — RAC ModalOverlay owns focus containment, Escape-to-close,
          outside-press dismissal, and body scroll locking. */}
      <Overlay
        isOpen={selectedImageIndex !== null}
        onOpenChange={(open) => !open && closeLightbox()}
        isDismissable
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm p-4 cursor-zoom-out animate-fade-in"
      >
        <Modal className="contents">
          {/* Dialog must stay a real (focusable) box, not display:contents — RAC's
              Escape-to-close and initial focus both depend on being able to focus
              this element; a `contents` box can never receive focus. */}
          <Dialog
            className="outline-none"
            aria-label={selectedImageIndex !== null ? items[selectedImageIndex]?.alt : 'Photo viewer'}
          >
            {/* Keyboard nav needs a real DOM element to attach to (Dialog/Modal don't expose onKeyDown). */}
            <div className="contents" onKeyDown={handleKeyDown}>
              {selectedImageIndex !== null && (
                <>
                  {/* Close Button */}
                  <button
                    onClick={closeLightbox}
                    className="absolute top-6 right-6 text-foreground hover:text-accent p-2 bg-surface-sunken/40 rounded-full border border-line/60 transition-colors cursor-pointer z-50"
                    aria-label="Close photo viewer"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>

                  {/* Navigation Controls */}
                  <button
                    onClick={(e) => navigateLightbox('prev', e)}
                    className="absolute left-4 md:left-8 top-1/2 -translate-y-1/2 text-foreground hover:text-accent p-3 bg-surface-sunken/40 rounded-full border border-line/60 transition-colors cursor-pointer z-50"
                    aria-label="Previous photo"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>

                  <button
                    onClick={(e) => navigateLightbox('next', e)}
                    className="absolute right-4 md:right-8 top-1/2 -translate-y-1/2 text-foreground hover:text-accent p-3 bg-surface-sunken/40 rounded-full border border-line/60 transition-colors cursor-pointer z-50"
                    aria-label="Next photo"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>

                  {/* Active Image */}
                  <div className="relative max-w-5xl max-h-[80vh] w-full h-full flex items-center justify-center cursor-default" onClick={(e) => e.stopPropagation()}>
                    <Image
                      src={items[selectedImageIndex].src}
                      alt={items[selectedImageIndex].alt}
                      width={1200}
                      height={800}
                      className="object-contain max-h-[80vh] w-auto h-auto rounded-lg shadow-2xl select-none"
                    />
                    <div id="lightbox-caption" className="absolute bottom-[-40px] left-0 right-0 text-center text-foreground-secondary text-sm">
                      {selectedImageIndex + 1} / {items.length} • {items[selectedImageIndex].alt}
                    </div>
                  </div>
                </>
              )}
            </div>
          </Dialog>
        </Modal>
      </Overlay>
    </section>
  );
}

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import useEmblaCarousel from 'embla-carousel-react';
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

export default function MediaGrid({ items, columns = 3, eyebrow, heading }: MediaGridProps) {
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scrollSnaps, setScrollSnaps] = useState<number[]>([]);
  const [visibleCount, setVisibleCount] = useState(3);
  const carouselRef = useRef<HTMLDivElement>(null);

  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: 'start',
    containScroll: 'trimSnaps',
    slidesToScroll: 1,
    dragFree: false,
  });

  useEffect(() => {
    if (!emblaApi) return;

    const syncState = () => {
      setScrollSnaps(emblaApi.scrollSnapList());
      setSelectedIndex(emblaApi.selectedScrollSnap());
    };

    syncState();
    emblaApi.on('select', syncState);
    emblaApi.on('reInit', syncState);

    return () => {
      emblaApi.off('select', syncState);
      emblaApi.off('reInit', syncState);
    };
  }, [emblaApi]);

  // Dynamically determine how many cards to show per slide based on screen width
  useEffect(() => {
    const updateVisibleCount = () => {
      const w = window.innerWidth;
      if (w < 640) {
        setVisibleCount(1);
      } else if (w < 1024) {
        setVisibleCount(2);
      } else {
        setVisibleCount(Math.min(columns, 3));
      }
    };
    updateVisibleCount();
    window.addEventListener('resize', updateVisibleCount);
    return () => window.removeEventListener('resize', updateVisibleCount);
  }, [columns]);

  const scrollPrev = useCallback(() => {
    if (!emblaApi) return;
    if (emblaApi.canScrollPrev()) {
      emblaApi.scrollPrev();
    } else {
      emblaApi.scrollTo(emblaApi.scrollSnapList().length - 1);
    }
  }, [emblaApi]);

  const nextSlide = useCallback(() => {
    if (!emblaApi) return;
    if (emblaApi.canScrollNext()) {
      emblaApi.scrollNext();
    } else {
      emblaApi.scrollTo(0);
    }
  }, [emblaApi]);

  const scrollTo = useCallback(
    (index: number) => {
      if (emblaApi) emblaApi.scrollTo(index);
    },
    [emblaApi]
  );

  // Preload upcoming images into browser memory so next slides render instantly
  useEffect(() => {
    if (typeof window === 'undefined' || !items || items.length === 0) return;
    const preloadAhead = 3;
    for (let i = 1; i <= preloadAhead; i++) {
      const nextIndex = (selectedIndex + visibleCount - 1 + i) % items.length;
      if (items[nextIndex]?.src) {
        const img = new window.Image();
        img.src = items[nextIndex].src;
      }
    }
  }, [selectedIndex, visibleCount, items]);

  // Keyboard navigation for main carousel when focused
  const handleCarouselKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      scrollPrev();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      nextSlide();
    }
  };

  // Lightbox keyboard controls
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

  const handleLightboxKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') setSelectedImageIndex((i) => (i === null ? null : (i + 1) % items.length));
    if (e.key === 'ArrowLeft') setSelectedImageIndex((i) => (i === null ? null : (i - 1 + items.length) % items.length));
  };

  if (!items || items.length === 0) return null;

  return (
    <Section tone="default" className="border-t border-line/30">
      {heading && <SectionHeader eyebrow={eyebrow} title={heading} />}

      {/* Carousel Wrapper */}
      <div
        ref={carouselRef}
        className="relative group outline-none"
        tabIndex={0}
        onKeyDown={handleCarouselKeyDown}
        aria-roledescription="carousel"
        aria-label={heading || 'Photo Gallery'}
      >
        {/* Main Flex Row: Left Arrow + Viewport + Right Arrow */}
        <div className="flex items-center gap-2 sm:gap-4 w-full">
          {/* Navigation Arrow Left */}
          {items.length > visibleCount && (
            <button
              type="button"
              onClick={scrollPrev}
              aria-label="Previous photos"
              className="shrink-0 z-20 w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-surface/90 border border-line text-foreground hover:text-accent hover:border-accent flex items-center justify-center shadow-lg transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}

          {/* Slide Viewport (Embla Carousel) */}
          <div className="overflow-hidden rounded-2xl p-1 flex-1 touch-pan-y" ref={emblaRef}>
            <div className="flex -ml-4 sm:-ml-6">
              {items.map((item, index) => (
                <div
                  key={item.id || index}
                  className="min-w-0 shrink-0 grow-0 pl-4 sm:pl-6 basis-full sm:basis-1/2 lg:basis-1/3 select-none"
                >
                  <div className="aspect-square rounded-2xl overflow-hidden relative border border-line/80 hover:border-accent/50 group/card transition-colors bg-surface-raised/40">
                    <button
                      type="button"
                      onClick={() => setSelectedImageIndex(index)}
                      aria-label={`View photo: ${item.alt}`}
                      className="w-full h-full relative block cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      <Image
                        src={item.src}
                        alt={item.alt}
                        fill
                        unoptimized
                        loading="lazy"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-cover transition-transform duration-500 group-hover/card:scale-105 pointer-events-none"
                      />

                      <div className="absolute inset-0 bg-black/0 group-hover/card:bg-black/25 transition-colors flex items-center justify-center">
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
              ))}
            </div>
          </div>

          {/* Navigation Arrow Right */}
          {items.length > visibleCount && (
            <button
              type="button"
              onClick={nextSlide}
              aria-label="Next photos"
              className="shrink-0 z-20 w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-surface/90 border border-line text-foreground hover:text-accent hover:border-accent flex items-center justify-center shadow-lg transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>

        {/* Carousel Pagination Controls & Position Counter */}
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3 px-2">
          <p className="text-xs font-medium text-foreground-secondary">
            Photo <span className="font-bold text-foreground">{selectedIndex + 1}</span>–
            <span className="font-bold text-foreground">{Math.min(selectedIndex + visibleCount, items.length)}</span> of{' '}
            <span className="font-bold text-foreground">{items.length}</span>
          </p>

          {/* Dots Indicator */}
          {scrollSnaps.length > 1 && (
            <div className="flex items-center gap-1.5" role="tablist" aria-label="Gallery slides">
              {scrollSnaps.map((_, dotIndex) => (
                <button
                  key={dotIndex}
                  type="button"
                  onClick={() => scrollTo(dotIndex)}
                  role="tab"
                  aria-selected={selectedIndex === dotIndex}
                  aria-label={`Go to slide group ${dotIndex + 1}`}
                  className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                    selectedIndex === dotIndex
                      ? 'w-6 bg-accent'
                      : 'w-2 bg-line hover:bg-foreground-secondary'
                  }`}
                />
              ))}
            </div>
          )}
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

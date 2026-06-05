'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { Image as ImageType, Theme, GridColumns } from '@/app/types';
import { THEME_CLASSES, GRID_COLUMNS } from '@/app/lib/constants';

interface MediaGridProps {
  items: ImageType[];
  columns?: GridColumns;
  theme?: Theme;
}

export default function MediaGrid({ items, columns = 3, theme = 'dark' }: MediaGridProps) {
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);

  const themeClasses = theme === 'dark' 
    ? `${THEME_CLASSES.dark.bg} ${THEME_CLASSES.dark.text}` 
    : `${THEME_CLASSES.light.bg} ${THEME_CLASSES.light.text}`;

  const openLightbox = (index: number) => {
    setSelectedImageIndex(index);
    document.body.style.overflow = 'hidden';
  };

  const closeLightbox = () => {
    setSelectedImageIndex(null);
    document.body.style.overflow = 'unset';
  };

  const navigateLightbox = (direction: 'next' | 'prev', e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedImageIndex === null) return;
    
    let newIndex = direction === 'next' ? selectedImageIndex + 1 : selectedImageIndex - 1;
    if (newIndex >= items.length) newIndex = 0;
    if (newIndex < 0) newIndex = items.length - 1;
    
    setSelectedImageIndex(newIndex);
  };

  return (
    <section className={`${themeClasses} py-16 md:py-24 border-t border-slate-900/40`}>
      <div className="container mx-auto px-4">
        <div className={`grid ${GRID_COLUMNS[columns]} gap-6`}>
          {items.map((item, index) => (
            <div 
              key={item.id || index} 
              onClick={() => openLightbox(index)}
              className="aspect-square rounded-xl overflow-hidden relative border border-slate-900 cursor-pointer transition-all duration-200 group"
            >
              <Image
                src={item.src}
                alt={item.alt}
                fill
                className="object-cover transition-opacity duration-300 group-hover:opacity-80"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                <span className="text-white bg-ez-pink px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-all duration-200">
                  View Photo
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Lightbox Modal */}
      {selectedImageIndex !== null && (
        <div 
          onClick={closeLightbox}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm p-4 cursor-zoom-out animate-fade-in"
        >
          {/* Close Button */}
          <button 
            onClick={closeLightbox}
            className="absolute top-6 right-6 text-white hover:text-ez-pink p-2 bg-slate-950/40 rounded-full border border-slate-800/60 transition-colors cursor-pointer z-50"
            aria-label="Close Gallery"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Navigation Controls */}
          <button 
            onClick={(e) => navigateLightbox('prev', e)}
            className="absolute left-4 md:left-8 top-1/2 -translate-y-1/2 text-white hover:text-ez-pink p-3 bg-slate-950/40 rounded-full border border-slate-800/60 transition-colors cursor-pointer z-50"
            aria-label="Previous Image"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <button 
            onClick={(e) => navigateLightbox('next', e)}
            className="absolute right-4 md:right-8 top-1/2 -translate-y-1/2 text-white hover:text-ez-pink p-3 bg-slate-950/40 rounded-full border border-slate-800/60 transition-colors cursor-pointer z-50"
            aria-label="Next Image"
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
            <div className="absolute bottom-[-40px] left-0 right-0 text-center text-slate-300 text-sm">
              {selectedImageIndex + 1} / {items.length} • {items[selectedImageIndex].alt}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}



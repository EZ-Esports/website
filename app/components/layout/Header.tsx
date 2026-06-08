'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { SITE_CONFIG } from '@/app/lib/constants';
import Navigation from './Navigation';
import GameSubHeader from './GameSubHeader';

export default function Header() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full bg-background/85 backdrop-blur-md border-b border-custom-border/60">
      <nav className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-4">
            <Link href="/" className="hover:opacity-85 transition-opacity flex items-center">
              <Image
                src="/images/logos/wordmark.png"
                alt={SITE_CONFIG.company}
                width={160}
                height={48}
                className="h-10 w-auto filter-none theme-pink-white:invert-[0.1]"
                priority
              />
            </Link>
            <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded-full bg-ez-pink/10 border border-ez-pink/20">
              <span className="w-1.5 h-1.5 rounded-full bg-ez-pink animate-pulse" />
              <span className="text-[10px] font-bold text-ez-pink uppercase tracking-widest">Live Every Week</span>
            </div>
          </div>
          
          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6">
            <Navigation />
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden text-foreground-secondary hover:text-foreground focus:outline-none p-1.5 cursor-pointer rounded border border-custom-border bg-background-secondary/40"
            aria-expanded={isOpen}
            aria-label="Toggle Navigation Menu"
          >
            {isOpen ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile Navigation Drawer */}
        {isOpen && (
          <div className="md:hidden py-4 border-t border-custom-border/40 animate-fade-in bg-background/95">
            <Navigation onNavigate={() => setIsOpen(false)} />
          </div>
        )}
      </nav>
      <GameSubHeader />
    </header>
  );
}

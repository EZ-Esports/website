'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { motion, useScroll, useTransform } from 'framer-motion';
import { SiTwitch } from 'react-icons/si';
import { SITE_CONFIG } from '@/app/lib/constants';
import Navigation from './Navigation';
import GameSubHeader from './GameSubHeader';

export default function Header() {
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const pathname = usePathname();

  const { scrollY } = useScroll();
  const headerBg = useTransform(scrollY, [0, 80], ['rgba(17,17,17,0)', 'rgba(17,17,17,0.92)']);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    // Set initial scroll state in case of reload
    handleScroll();

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Check if current page features a dark hero banner at the top
  const hasHero = pathname === '/' ||
                  pathname === '/about' ||
                  pathname === '/news' ||
                  pathname === '/valorant' ||
                  pathname === '/league-of-legends' ||
                  pathname === '/team-fight-tactics' ||
                  pathname === '/apply' ||
                  pathname === '/sponsors';

  const isDarkText = isScrolled || !hasHero;

  return (
    <motion.header
      style={{ backgroundColor: headerBg }}
      className={`sticky top-0 z-50 w-full transition-all duration-300 ease-in-out backdrop-blur-md ${
        isScrolled
          ? 'border-b border-custom-border/60 py-1 sm:py-2'
          : 'border-b-0 py-4 sm:py-6'
      }`}
    >
      <nav className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-4">
            <Link href="/" className="hover:opacity-85 transition-opacity flex items-center">
              <Image
                src="/images/logos/wordmark.png"
                alt={SITE_CONFIG.company}
                width={160}
                height={48}
                className="h-10 w-auto transition-all duration-300"
                priority
              />
            </Link>
            <Link
              href="https://www.twitch.tv/ezesportsNYC"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Watch EZ Esports live on Twitch (opens in new tab)"
              className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded-full bg-ez-pink/10 border border-ez-pink/20 hover:bg-ez-pink/20 transition-colors"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-ez-pink animate-pulse" aria-hidden="true" />
              <SiTwitch className="w-3 h-3 text-ez-pink" aria-hidden="true" />
              <span className="text-[10px] font-bold text-ez-pink uppercase tracking-widest" aria-hidden="true">Watch Live</span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6">
            <Navigation isDarkText={isDarkText} />
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className={`md:hidden focus:outline-none p-1.5 cursor-pointer rounded border transition-colors ${
              isDarkText
                ? 'text-foreground-secondary hover:text-foreground border-custom-border bg-background-secondary/40'
                : 'text-white/95 hover:text-ez-pink border-white/20 bg-white/10'
            }`}
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
          <div className={`md:hidden py-4 border-t border-custom-border/40 animate-fade-in rounded-b-xl px-2 ${
            isDarkText ? 'bg-background/95' : 'bg-zinc-950/95'
          }`}>
            <Navigation isDarkText={isDarkText} onNavigate={() => setIsOpen(false)} />
          </div>
        )}
      </nav>
      <GameSubHeader />
    </motion.header>
  );
}

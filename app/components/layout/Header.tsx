'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { FocusScope } from 'react-aria';
import { Dialog } from 'react-aria-components';
import { SiTwitch } from 'react-icons/si';
import { SITE_CONFIG, ROUTES } from '@/app/lib/constants';
import Button from '@/app/components/ui/Button';
import Navigation from './Navigation';
import GameSubHeader from './GameSubHeader';

export default function Header() {
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const pathname = usePathname();

  // Check if current page features a dark hero banner at the top
  const hasHero = pathname === '/' ||
                  pathname === '/about' ||
                  pathname === '/news' ||
                  pathname.startsWith('/news/') ||
                  pathname === '/valorant' ||
                  pathname === '/league-of-legends' ||
                  pathname === '/team-fight-tactics' ||
                  pathname === '/sponsors' ||
                  pathname === '/privacy';

  // Toggle solid dark background on scroll
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 40);
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close when route changes
  useEffect(() => {
    const id = setTimeout(() => setIsOpen(false), 0);
    return () => clearTimeout(id);
  }, [pathname]);

  const handleCloseMenu = () => {
    setIsOpen(false);
  };

  const showDarkBg = !hasHero || isScrolled;

  return (
    <>
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-accent focus:text-on-accent focus:font-bold focus:rounded-lg focus:shadow-lg"
    >
      Skip to main content
    </a>
    <header
      className={`z-50 w-full border-b transition-colors duration-300 fixed top-0 py-3 ${
        showDarkBg
          ? 'bg-[#111111]/95 border-white/10 backdrop-blur-md'
          : 'bg-transparent border-transparent'
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
              className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full border transition-all duration-300 bg-accent/10 border-accent/20 hover:bg-accent/20 shadow-sm active:scale-[0.98]"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse motion-reduce:animate-none" aria-hidden="true" />
              <SiTwitch className="w-3 h-3 text-accent" aria-hidden="true" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-accent" aria-hidden="true">Watch Live</span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-4 lg:gap-6">
            <Navigation />
            <Button 
              href={ROUTES.apply} 
              variant="primary" 
              className="py-1.5 px-4 text-xs font-black uppercase tracking-widest shadow-md shadow-accent/5 hover:shadow-accent/20 transition-all duration-300 shrink-0"
            >
              Apply Now
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden focus:outline-none p-1.5 cursor-pointer rounded border transition-all duration-300 min-h-[44px] min-w-[44px] flex items-center justify-center text-white/90 hover:text-accent border-white/15 bg-white/5 hover:bg-white/10 backdrop-blur-sm"
            aria-expanded={isOpen}
            aria-controls="mobile-nav"
            aria-label={isOpen ? 'Close navigation menu' : 'Open navigation menu'}
          >
            {isOpen ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile Navigation Drawer. React Aria's FocusScope traps Tab within the panel and restores focus on close. */}
        <FocusScope contain={isOpen} restoreFocus={true}>
          {isOpen && (
            <Dialog aria-label="Mobile navigation" className="outline-none">
              <div
                id="mobile-nav"
                className="md:hidden py-4 border-t border-line/40 rounded-b-xl px-4 bg-surface-raised/95 backdrop-blur-md"
              >
                <Navigation onNavigate={handleCloseMenu} />
                <div className="mt-4 pt-4 border-t border-line/30">
                  <Button
                    href={ROUTES.apply}
                    variant="primary"
                    className="w-full text-center py-2.5 font-bold uppercase tracking-wider"
                    onClick={handleCloseMenu}
                  >
                    Apply Now
                  </Button>
                </div>
              </div>
            </Dialog>
          )}
        </FocusScope>
      </nav>
      <GameSubHeader />
    </header>
    </>
  );
}

'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
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
  const toggleRef = useRef<HTMLButtonElement>(null);

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

  const { scrollY } = useScroll();
  const bgTransform = useTransform(scrollY, [0, 120], ['rgba(17,17,17,0)', 'rgba(17,17,17,0.95)']);
  const headerBg = hasHero ? bgTransform : 'rgba(17,17,17,0.95)';

  // Scroll-linked backdrop filter blur transition
  const blurTransform = useTransform(scrollY, [0, 120], ['blur(0px)', 'blur(16px)']);
  const headerBlur = hasHero ? blurTransform : 'blur(16px)';

  // Scroll-linked border bottom color transition
  const borderTransform = useTransform(scrollY, [0, 120], ['rgba(39,39,42,0)', 'rgba(39,39,42,0.6)']);
  const headerBorderColor = hasHero ? borderTransform : 'rgba(39,39,42,0.6)';

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 60);
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Deferred focus return: FocusScope's containment reclaims focus synchronously (via
  // a document 'focusin' listener) while `contain` is still true. Deferring one tick
  // lets the re-render with contain={false} land before we attempt focus().
  const returnFocusToToggle = useCallback(() => {
    setTimeout(() => toggleRef.current?.focus(), 0);
  }, []);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        returnFocusToToggle();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, returnFocusToToggle]);

  // Close when route changes (deferred to avoid synchronous setState in effect body)
  useEffect(() => {
    const id = setTimeout(() => setIsOpen(false), 0);
    return () => clearTimeout(id);
  }, [pathname]);

  const handleCloseMenu = () => {
    setIsOpen(false);
    returnFocusToToggle();
  };

  return (
    <>
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-accent focus:text-on-accent focus:font-bold focus:rounded-lg focus:shadow-lg"
    >
      Skip to main content
    </a>
    <motion.header
      style={{ 
        backgroundColor: headerBg, 
        backdropFilter: headerBlur, 
        WebkitBackdropFilter: headerBlur,
        borderBottomColor: headerBorderColor
      }}
      className={`z-50 w-full border-b transition-all duration-500 ease-out ${
        hasHero
          ? 'fixed top-0'
          : 'sticky top-0'
      } ${
        isScrolled
          ? 'py-1.5 sm:py-2'
          : 'py-2.5 sm:py-3.5'
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
            ref={toggleRef}
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

        {/* Mobile Navigation Drawer. React Aria's FocusScope (contain, no restoreFocus)
            traps Tab within the panel without blocking outside clicks, so the toggle
            button below (outside the scope) still closes the menu on click.
            FocusScope wraps AnimatePresence (rather than being wrapped by it) so
            `contain` flips off the instant isOpen changes, instead of staying
            mounted+active for the ~150ms exit animation and fighting the manual
            focus-return below. Escape-to-close and focus-return to the toggle stay
            on the app's own handlers above — RAC's Dialog only adds the dialog
            role/label. */}
        <FocusScope contain={isOpen} restoreFocus={false}>
          <AnimatePresence>
            {isOpen && (
              <Dialog aria-label="Mobile navigation" className="outline-none">
                <motion.div
                  id="mobile-nav"
                  key="mobile-nav"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
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
                </motion.div>
              </Dialog>
            )}
          </AnimatePresence>
        </FocusScope>
      </nav>
      <GameSubHeader />
    </motion.header>
    </>
  );
}

'use client';

import Image from 'next/image';
import { motion, useScroll, useTransform } from 'framer-motion';
import Button from '@/app/components/ui/Button';

interface CTA {
  label: string;
  href: string;
}

interface HeroProps {
  title: string;
  subtitle?: string;
  backgroundImage: string;
  size?: 'large' | 'medium';
  primaryCTA?: CTA;
  secondaryCTA?: CTA;
}

export default function Hero({ 
  title, 
  subtitle, 
  backgroundImage, 
  size = 'medium',
  primaryCTA,
  secondaryCTA
}: HeroProps) {
  const isLarge = size === 'large';
  
  const { scrollY } = useScroll();
  const contentOpacity = useTransform(scrollY, [0, 300], [1, 0]);
  const contentY = useTransform(scrollY, [0, 300], [0, -40]);
  const backgroundY = useTransform(scrollY, [0, 500], ['0%', '20%']);

  // Helper to dynamically color brand words "EZ" and "Esports" pink
  const renderTitle = (text: string) => {
    const parts = text.split(/(Esports|EZ)/g);
    return parts.map((part, i) => {
      if (part === 'Esports' || part === 'EZ') {
        return <span key={i} className="text-ez-pink font-extrabold">{part}</span>;
      }
      return part;
    });
  };
  
  return (
    <section className={`relative overflow-hidden w-full ${isLarge ? 'h-[80vh]' : 'h-[35vh]'} flex items-center`}>
      {/* Background Image */}
      <motion.div 
        style={{ y: backgroundY }}
        className="absolute inset-0 select-none pointer-events-none z-0"
      >
        <Image
          src={backgroundImage}
          alt={`${title} hero background`}
          fill
          priority
          className="object-cover object-center scale-110"
        />
        {/* Theme Responsive Overlay */}
        <div 
          className="absolute inset-0 bg-[linear-gradient(to_bottom,var(--hero-overlay-from),var(--hero-overlay-via),var(--background))]" 
        />
      </motion.div>

      {/* Hero Content Container */}
      <motion.div 
        style={{ opacity: contentOpacity, y: contentY }}
        className="relative z-10 w-full flex items-center justify-center px-4"
      >
        {isLarge ? (
          <div className="max-w-3xl mx-auto glass-panel rounded-3xl p-8 sm:p-12 border border-custom-border/20 shadow-2xl relative overflow-hidden text-center">
            {/* Soft internal card glow */}
            <div className="absolute -top-20 -left-20 w-40 h-40 bg-ez-pink/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-ez-purple/10 rounded-full blur-3xl pointer-events-none" />
            
            <div className="relative z-10 flex flex-col items-center">
              {/* Division Badge */}
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-ez-pink/10 border border-ez-pink/20 text-ez-pink text-xs font-bold uppercase tracking-widest mb-6 select-none">
                <span className="w-1.5 h-1.5 rounded-full bg-ez-pink animate-pulse" />
                NYC Division
              </span>

              {/* Heading */}
              <motion.h1
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.05, ease: 'easeOut' }}
                className="font-black tracking-tight text-foreground select-none text-3xl sm:text-4xl md:text-5xl leading-tight"
              >
                {renderTitle(title)}
              </motion.h1>

              {/* Subtitle */}
              {subtitle && (
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.1, ease: 'easeOut' }}
                  className="text-foreground-secondary font-medium max-w-xl mx-auto leading-relaxed mt-6 text-sm sm:text-base md:text-lg"
                >
                  {subtitle}
                </motion.p>
              )}

              {/* CTAs */}
              {(primaryCTA || secondaryCTA) && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.15, ease: 'easeOut' }}
                  className="flex flex-wrap items-center justify-center gap-4 mt-8"
                >
                  {primaryCTA && (
                    <Button href={primaryCTA.href} variant="primary" className="min-w-[160px]">
                      {primaryCTA.label}
                    </Button>
                  )}
                  {secondaryCTA && (
                    <Button href={secondaryCTA.href} variant="secondary" className="min-w-[160px]">
                      {secondaryCTA.label}
                    </Button>
                  )}
                </motion.div>
              )}
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto flex flex-col items-center text-center">
            {/* Heading */}
            <motion.h1
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.05, ease: 'easeOut' }}
              className="font-black tracking-tight text-white select-none text-2xl sm:text-3xl md:text-4xl"
            >
              {renderTitle(title)}
            </motion.h1>

            {/* Subtitle */}
            {subtitle && (
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1, ease: 'easeOut' }}
                className="text-slate-200 font-medium max-w-xl mx-auto leading-relaxed mt-4 text-xs sm:text-sm"
              >
                {subtitle}
              </motion.p>
            )}
          </div>
        )}
      </motion.div>
    </section>
  );
}

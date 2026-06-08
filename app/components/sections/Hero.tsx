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
  
  return (
    <section className={`relative overflow-hidden w-full ${isLarge ? 'h-[75vh]' : 'h-[35vh]'}`}>
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
        className="relative z-10 h-full flex items-center justify-center text-center px-4"
      >
        <div className="max-w-4xl mx-auto flex flex-col items-center">
          {/* Heading */}
          <motion.h1
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05, ease: 'easeOut' }}
            className={`font-extrabold tracking-tight text-white select-none ${
              isLarge 
                ? 'text-4xl sm:text-5xl md:text-6xl leading-none' 
                : 'text-3xl sm:text-4xl md:text-4xl'
            }`}
          >
            {title}
          </motion.h1>

          {/* Subtitle */}
          {subtitle && (
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1, ease: 'easeOut' }}
              className={`text-slate-200 font-medium max-w-xl mx-auto leading-relaxed mt-6 ${
                isLarge ? 'text-base md:text-lg' : 'text-sm md:text-base'
              }`}
            >
              {subtitle}
            </motion.p>
          )}

          {/* CTAs */}
          {(primaryCTA || secondaryCTA) && isLarge && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15, ease: 'easeOut' }}
              className="flex flex-wrap items-center justify-center gap-4 mt-10"
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
      </motion.div>
    </section>
  );
}

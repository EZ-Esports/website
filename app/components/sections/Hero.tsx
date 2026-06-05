'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';

interface HeroProps {
  title: string;
  subtitle?: string;
  backgroundImage: string;
  size?: 'large' | 'medium';
}

export default function Hero({ 
  title, 
  subtitle, 
  backgroundImage, 
  size = 'medium' 
}: HeroProps) {
  const isLarge = size === 'large';
  
  return (
    <section className={`relative overflow-hidden w-full ${isLarge ? 'h-[85vh]' : 'h-[45vh]'}`}>
      {/* Background Image with Zoom Effect */}
      <div className="absolute inset-0 select-none pointer-events-none z-0">
        <Image
          src={backgroundImage}
          alt={`${title} hero background`}
          fill
          priority
          className="object-cover object-center scale-105"
        />
        {/* Rich Dark Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/40 to-[#080c14]" />
      </div>

      {/* Hero Content Container */}
      <div className="relative z-10 h-full flex items-center justify-center text-center px-4">
        <div className="max-w-4xl mx-auto flex flex-col items-center">
          {isLarge && (
            <motion.span
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="text-xs md:text-sm font-bold tracking-widest text-ez-pink uppercase mb-4 px-3 py-1 rounded-full bg-ez-pink/10 border border-ez-pink/20"
            >
              Official League Hub
            </motion.span>
          )}

          {/* Glowing Animated Heading */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }}
            className={`font-black tracking-tight text-white drop-shadow-md select-none ${
              isLarge 
                ? 'text-4xl sm:text-5xl md:text-7xl leading-none' 
                : 'text-3xl sm:text-4xl md:text-5xl'
            }`}
          >
            {title}
          </motion.h1>

          {/* Accent Line */}
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.8, delay: 0.3, ease: 'easeInOut' }}
            className="h-1 w-20 bg-gradient-to-r from-ez-pink to-ez-purple my-6 rounded-full"
          />

          {/* Animated Subtitle */}
          {subtitle && (
            <motion.p
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2, ease: 'easeOut' }}
              className={`text-slate-300 font-medium max-w-2xl mx-auto leading-relaxed ${
                isLarge ? 'text-base md:text-xl' : 'text-sm md:text-base'
              }`}
            >
              {subtitle}
            </motion.p>
          )}
        </div>
      </div>

      {/* Animated Scroll Indicator (only for large homepage hero) */}
      {isLarge && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center pointer-events-none select-none">
          <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-2">Scroll Down</span>
          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
            className="w-5 h-8 border-2 border-slate-500 rounded-full flex justify-center pt-1"
          >
            <div className="w-1 h-2 bg-ez-pink rounded-full" />
          </motion.div>
        </div>
      )}
    </section>
  );
}


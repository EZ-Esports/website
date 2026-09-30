'use client';

import { motion } from 'framer-motion';
import { ReactNode } from 'react';
import { usePrefersReducedMotion } from '@/app/lib/hooks/usePrefersReducedMotion';
import { EASE_REVEAL, DUR } from '@/app/lib/motion';

interface ScrollRevealProps {
  children: ReactNode;
  delay?: number;
  direction?: 'up' | 'down' | 'left' | 'right' | 'none';
}

export default function ScrollReveal({
  children,
  delay = 0,
  direction = 'up'
}: ScrollRevealProps) {
  const prefersReducedMotion = usePrefersReducedMotion();

  // When the user prefers reduced motion, the hidden state already matches the
  // visible state, so the content simply appears with no slide/fade.
  const variants = {
    hidden: {
      opacity: prefersReducedMotion ? 1 : 0,
      y: prefersReducedMotion ? 0 : (direction === 'up' ? 30 : direction === 'down' ? -30 : 0),
      x: prefersReducedMotion ? 0 : (direction === 'left' ? 30 : direction === 'right' ? -30 : 0)
    },
    visible: {
      opacity: 1,
      y: 0,
      x: 0,
      transition: {
        duration: prefersReducedMotion ? 0 : DUR.slow,
        delay: prefersReducedMotion ? 0 : delay,
        ease: EASE_REVEAL as any
      }
    }
  };

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-100px" }}
      variants={variants}
    >
      {children}
    </motion.div>
  );
}

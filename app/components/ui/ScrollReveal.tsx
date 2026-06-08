'use client';

import { motion } from 'framer-motion';
import { ReactNode } from 'react';

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
  const variants = {
    hidden: { 
      opacity: 0, 
      y: direction === 'up' ? 30 : direction === 'down' ? -30 : 0,
      x: direction === 'left' ? 30 : direction === 'right' ? -30 : 0
    },
    visible: { 
      opacity: 1, 
      y: 0,
      x: 0,
      transition: { 
        duration: 0.8, 
        delay,
        ease: [0.21, 0.47, 0.32, 0.98] as any // Apple-style cubic bezier
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

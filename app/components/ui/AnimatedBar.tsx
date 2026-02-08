import { motion } from 'framer-motion';
import { LOADING_SCREEN_ANIMATIONS } from '@/app/lib/constants';

interface AnimatedBarProps {
  letter: string;
  backgroundColor: string;
  initialX: string;
  slideDirection: 'left' | 'right';
  phase: number;
}

/**
 * Animated bar component for LoadingScreen.
 * Displays a skewed bar with a letter that extends vertically and slides off-screen.
 */
export default function AnimatedBar({
  letter,
  backgroundColor,
  initialX,
  slideDirection,
  phase,
}: AnimatedBarProps) {
  const slideOffset = slideDirection === 'left' ? '-120vw' : '120vw';
  const slideX = phase >= 3 
    ? `calc(${initialX} ${slideDirection === 'left' ? '-' : '+'} ${slideOffset})`
    : initialX;

  return (
    <motion.div
      aria-hidden="true"
      className={`${backgroundColor} absolute top-1/2 left-1/2 w-[clamp(100px,12vw,160px)] overflow-hidden z-[15]`}
      initial={{ height: 0, opacity: 0, x: initialX, y: '-50%', skewX: -35 }}
      animate={{
        height: phase >= 2 ? '300vh' : 0,
        opacity: phase >= 2 ? 1 : 0,
        x: slideX,
      }}
      transition={
        phase >= 3
          ? { x: { duration: LOADING_SCREEN_ANIMATIONS.slide.duration, ease: LOADING_SCREEN_ANIMATIONS.slide.ease } }
          : { 
              height: { duration: LOADING_SCREEN_ANIMATIONS.extend.duration, ease: LOADING_SCREEN_ANIMATIONS.extend.ease }, 
              opacity: { duration: LOADING_SCREEN_ANIMATIONS.opacity.duration } 
            }
      }
    >
      <div
        className="absolute inset-0 flex items-center justify-center font-black text-gray-200"
        style={{ transform: 'skewX(35deg)', fontSize: 'clamp(4rem, 10vw, 7rem)' }}
      >
        {letter}
      </div>
    </motion.div>
  );
}

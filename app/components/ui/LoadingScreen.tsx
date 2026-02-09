import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { LoadingScreenProps } from "@/app/types";
import { LOADING_SCREEN_TIMINGS, LOADING_SCREEN_ANIMATIONS } from "@/app/lib/constants";
import { setAriaBusy, setMainContentInert } from "@/app/lib/utils";
import { usePrefersReducedMotion } from "@/app/lib/hooks/usePrefersReducedMotion";
import AnimatedBar from "./AnimatedBar";

/**
 * EZesports Loading Screen
 *
 * Phases:
 *  0 → Small slanted E & Z bars + "esports" text visible
 *  1 → "esports" slides left into Z bar and disappears behind it
 *  2 → Bars extend vertically to full screen
 *  3 → Overlay fades out, unmount
 */
export default function LoadingScreen({ onComplete, reducedMotion }: LoadingScreenProps) {
  const [phase, setPhase] = useState(0);
  const [visible, setVisible] = useState(true);
  const prefersReduced = usePrefersReducedMotion(reducedMotion);

  const finish = useCallback(() => {
    setAriaBusy(false);
    setMainContentInert(false);
    setVisible(false);
    onComplete?.();
  }, [onComplete]);

  useEffect(() => {
    setAriaBusy(true);
    setMainContentInert(true);

    if (prefersReduced) {
      finish();
      return;
    }

    const timeouts: NodeJS.Timeout[] = [];
    let t = 0;
    const after = (ms: number, fn: () => void) => {
      t += ms;
      timeouts.push(setTimeout(fn, t));
    };

    after(LOADING_SCREEN_TIMINGS.showLogo, () => setPhase(1));
    after(LOADING_SCREEN_TIMINGS.esportsSlide, () => setPhase(2));
    after(LOADING_SCREEN_TIMINGS.barsExtend, () => setPhase(3));
    after(LOADING_SCREEN_TIMINGS.cleanup, finish);

    return () => {
      timeouts.forEach(clearTimeout);
      setAriaBusy(false);
      setMainContentInert(false);
    };
  }, [prefersReduced, finish]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="loader"
          role="status"
          aria-live="polite"
          aria-label="Loading EZesports"
          className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900"
          initial={{ opacity: 1 }}
          exit={{
            opacity: 0,
            transition: { duration: LOADING_SCREEN_ANIMATIONS.overlayFade.duration },
          }}
        >
          <span className="sr-only">
            {phase < 3 ? "Loading, please wait…" : "Content loaded."}
          </span>

          <motion.div
            className="absolute z-[10] font-black text-gray-800 overflow-visible whitespace-nowrap"
            style={{
              fontSize: "clamp(3rem, 8vw, 5rem)",
              left: "50%",
              marginLeft: "clamp(50px, 6vw, 80px)",
            }}
            initial={{ x: 0, opacity: 1 }}
            animate={{
              x: phase >= 1 ? "clamp(-200px, -20vw, -120px)" : 0,
              opacity: phase >= 2 ? 0 : 1,
            }}
            transition={{
              x: {
                duration: LOADING_SCREEN_ANIMATIONS.esportsSlide.duration,
                ease: LOADING_SCREEN_ANIMATIONS.esportsSlide.ease,
              },
              opacity: { duration: 0.01 },
            }}
            aria-hidden="true"
          >
            esports
          </motion.div>

          <AnimatedBar
            letter="E"
            backgroundColor="bg-rose-300"
            offsetX="calc(-6vw - 52px)"
            phase={phase}
          />

          <AnimatedBar
            letter="Z"
            backgroundColor="bg-white"
            offsetX="2px"
            phase={phase}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
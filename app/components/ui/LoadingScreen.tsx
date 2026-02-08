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
 * Props:
 *  - onComplete?: () => void  — fires when animation ends and component unmounts
 *  - reducedMotion?: boolean  — force reduced motion (auto-detects by default)
 *
 * Phases:
 *  0 → "EZesports" visible
 *  1 → "esports" fades out
 *  2 → bars extend vertically
 *  3 → bars slide off-screen
 *  4 → overlay fades out, unmount
 *
 * Accessibility:
 *  - role="status" + aria-live="polite" announces loading state
 *  - aria-busy on document.body while loading
 *  - Respects prefers-reduced-motion: skips to content instantly
 *  - Focus is trapped away from hidden content via inert
 *  - Announces completion to screen readers
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
    // Mark body as busy & inert main content while loading
    setAriaBusy(true);
    setMainContentInert(true);

    // Skip animation entirely if reduced motion preferred
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

    after(LOADING_SCREEN_TIMINGS.fade, () => setPhase(1));
    after(LOADING_SCREEN_TIMINGS.pause1, () => setPhase(2));
    after(LOADING_SCREEN_TIMINGS.extend, () => setPhase(3));
    after(LOADING_SCREEN_TIMINGS.slide, () => setPhase(4));
    after(LOADING_SCREEN_TIMINGS.cleanup, finish);

    return () => {
      timeouts.forEach(clearTimeout);
      // Cleanup on unmount
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-gray-200"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: LOADING_SCREEN_ANIMATIONS.exit.duration } }}
        >
          {/* Screen reader announcement */}
          <span className="sr-only">
            {phase < 4 ? "Loading, please wait…" : "Content loaded."}
          </span>

          {/* ---- Text logo ---- */}
          <motion.div
            className="absolute flex items-baseline font-black z-20"
            style={{ fontSize: "clamp(3rem, 8vw, 5rem)" }}
            animate={{ opacity: phase >= 2 ? 0 : 1 }}
            transition={{ duration: LOADING_SCREEN_ANIMATIONS.textFade.duration }}
            aria-hidden="true"
          >
            <span className="text-rose-300">E</span>
            <span className="text-gray-800">Z</span>
            <motion.span
              className="text-gray-800"
              animate={{ opacity: phase >= 1 ? 0 : 1 }}
              transition={{ duration: LOADING_SCREEN_ANIMATIONS.esportsFade.duration }}
            >
              esports
            </motion.span>
          </motion.div>

          {/* ---- E Bar (rose) ---- */}
          <AnimatedBar
            letter="E"
            backgroundColor="bg-rose-300"
            initialX="calc(-100% - 2px)"
            slideDirection="left"
            phase={phase}
          />

          {/* ---- Z Bar (white) ---- */}
          <AnimatedBar
            letter="Z"
            backgroundColor="bg-white"
            initialX="2px"
            slideDirection="right"
            phase={phase}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
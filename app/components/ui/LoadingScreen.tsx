import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { LoadingScreenProps } from "@/app/types";
import { LOADING_SCREEN_TIMINGS, LOADING_SCREEN_ANIMATIONS } from "@/app/lib/constants";
import { setAriaBusy, setMainContentInert } from "@/app/lib/utils";
import { usePrefersReducedMotion } from "@/app/lib/hooks/usePrefersReducedMotion";
import AnimatedBar from "./AnimatedBar";

/**
 * EZ Loading Screen
 *
 * Phases:
 *  0 → Small slanted E & Z bars visible
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

    const timeouts: NodeJS.Timeout[] = [];

    if (prefersReduced) {
      timeouts.push(setTimeout(finish, 0));
    } else {
      let t = 0;
      const after = (ms: number, fn: () => void) => {
        t += ms;
        timeouts.push(setTimeout(fn, t));
      };

      after(LOADING_SCREEN_TIMINGS.showLogo, () => setPhase(2));
      after(LOADING_SCREEN_TIMINGS.barsExtend, () => setPhase(3));
      after(LOADING_SCREEN_TIMINGS.cleanup, finish);
    }

    return () => {
      timeouts.forEach(clearTimeout);
      setAriaBusy(false);
      setMainContentInert(false);
    };
  }, [prefersReduced, finish]);

  return (
    <AnimatePresence>
      {visible && (
        // Phase 0: small E & Z bars | Phase 2: bars extend | Phase 3: exit triggers overlay fade
        <motion.div
          key="loader"
          role="status"
          aria-live="polite"
          aria-label="Loading EZ"
          className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900"
          initial={{ opacity: 1 }}
          exit={{
            /* Phase 3: overlay fade out */
            opacity: 0,
            transition: { duration: LOADING_SCREEN_ANIMATIONS.overlayFade.duration },
          }}
        >
          <span className="sr-only">
            {phase < 3 ? "Loading, please wait…" : "Content loaded."}
          </span>

          {/* Phase 0 & 2: E bar - extends when phase === 2 */}
          <AnimatedBar
            letter="E"
            backgroundColor="bg-rose-300"
            offsetX="calc(-6vw - 52px)"
            phase={phase}
          />

          {/* Phase 0 & 2: Z bar - extends when phase === 2 */}
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
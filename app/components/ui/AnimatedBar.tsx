import { useEffect } from "react";
import { motion, useAnimationControls } from "framer-motion";
import { LOADING_SCREEN_ANIMATIONS } from "@/app/lib/constants";

interface AnimatedBarProps {
  letter: string;
  backgroundColor: string;
  offsetX: string;
  phase: number;
}

export default function AnimatedBar({
  letter,
  backgroundColor,
  offsetX,
  phase,
}: AnimatedBarProps) {
  const controls = useAnimationControls();

  useEffect(() => {
    controls.set({
      height: "clamp(4rem, 10vw, 7rem)",
      x: offsetX,
      y: "-50%",
      opacity: 1,
    });
  }, [controls, offsetX]);

  useEffect(() => {
    if (phase === 2) {
      controls.start({
        height: "300vh",
        x: offsetX,
        y: "-50%",
        opacity: 1,
        transition: {
          duration: LOADING_SCREEN_ANIMATIONS.barsExtend.duration,
          ease: LOADING_SCREEN_ANIMATIONS.barsExtend.ease,
        },
      });
    }
  }, [phase, controls, offsetX]);

  return (
    <motion.div
      aria-hidden="true"
      className={`${backgroundColor} absolute top-1/2 left-1/2 w-[clamp(100px,12vw,160px)] overflow-hidden z-[15]`}
      style={{ skewX: "-35deg" }}
      animate={controls}
    >
      <div
        className="absolute inset-0 flex items-center justify-center font-black text-gray-200"
        style={{
          transform: "skewX(35deg)",
          fontSize: "clamp(4rem, 10vw, 7rem)",
        }}
      >
        {letter}
      </div>
    </motion.div>
  );
}
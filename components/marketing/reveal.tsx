"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { HTMLMotionProps } from "framer-motion";
import type { ReactNode } from "react";

type MarketingRevealProps = Omit<HTMLMotionProps<"div">, "children"> & {
  children: ReactNode;
  delay?: number;
};

export function MarketingReveal({
  delay = 0,
  children,
  ...props
}: MarketingRevealProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={shouldReduceMotion ? false : { opacity: 0, y: 18 }}
      whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={shouldReduceMotion ? undefined : { once: true, margin: "-80px" }}
      transition={
        shouldReduceMotion
          ? undefined
          : { duration: 0.45, ease: [0.22, 1, 0.36, 1], delay }
      }
      {...props}
    >
      {children}
    </motion.div>
  );
}

import { motion, type HTMLMotionProps } from "motion/react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type RevealProps = {
  children: ReactNode;
  delay?: number;
  className?: string;
  y?: number;
  once?: boolean;
} & Omit<HTMLMotionProps<"div">, "children">;

/**
 * Dreamy blur-in reveal used for page and section entrances.
 * Animates on mount (not on scroll) so freshly mounted routes always paint,
 * even when the intersection observer never fires during a route transition.
 */
export function Reveal({ children, delay = 0, className, y = 18, once: _once, ...rest }: RevealProps) {
  return (
    <motion.div
      initial={{ opacity: 0, filter: "blur(14px)", y }}
      animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
      className={cn(className)}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/** Staggered container: direct <RevealItem> children animate in sequence. */
export function RevealGroup({
  children,
  className,
  stagger = 0.07,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  stagger?: number;
  delay?: number;
}) {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: stagger, delayChildren: delay } },
      }}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}

export function RevealItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, filter: "blur(12px)", y: 16 },
        show: { opacity: 1, filter: "blur(0px)", y: 0 },
      }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}

/** Gentle floating wrapper for hero cards and trophies. */
export function Floaty({
  children,
  className,
  amount = 8,
  duration = 7,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  amount?: number;
  duration?: number;
  delay?: number;
}) {
  return (
    <motion.div
      animate={{ y: [0, -amount, 0] }}
      transition={{ duration, repeat: Infinity, ease: "easeInOut", delay }}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Scroll-triggered variants (marketing / landing sections)            */
/* ------------------------------------------------------------------ */

/** Blur-in reveal that fires when the block scrolls into view (once). */
export function ScrollReveal({ children, delay = 0, className, y = 28, once = true, ...rest }: RevealProps) {
  return (
    <motion.div
      initial={{ opacity: 0, filter: "blur(16px)", y }}
      whileInView={{ opacity: 1, filter: "blur(0px)", y: 0 }}
      viewport={{ once, amount: 0.25, margin: "0px 0px -12% 0px" }}
      transition={{ duration: 0.8, delay, ease: [0.22, 1, 0.36, 1] }}
      className={cn(className)}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/** Staggered container whose <RevealItem> children animate on scroll-in. */
export function ScrollRevealGroup({
  children,
  className,
  stagger = 0.09,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  stagger?: number;
  delay?: number;
}) {
  return (
    <motion.div
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.2 }}
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: stagger, delayChildren: delay } },
      }}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}

"use client";

import {
  motion,
  useInView,
  useMotionValue,
  useSpring,
  type Variants,
} from "framer-motion";
import { useEffect, useRef, useState } from "react";

export const EASE = [0.22, 1, 0.36, 1] as const;

/** Container that staggers its children's entrance. */
export const staggerContainer: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.06, delayChildren: 0.04 },
  },
};

/** A single item that fades + rises into place. */
export const riseItem: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: EASE },
  },
};

/**
 * Wrap a list/grid to stagger its direct <Item> children in on scroll/mount.
 * Usage:
 *   <Stagger className="grid ...">
 *     <Item key>…</Item>
 *   </Stagger>
 */
export function Stagger({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  return (
    <motion.div
      ref={ref}
      className={className}
      style={style}
      variants={staggerContainer}
      initial="hidden"
      animate={inView ? "show" : "hidden"}
    >
      {children}
    </motion.div>
  );
}

export function Item({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <motion.div variants={riseItem} className={className} style={style}>
      {children}
    </motion.div>
  );
}

/** Smoothly counts up to `value` when it scrolls into view. */
export function CountUp({
  value,
  duration = 1.1,
}: {
  value: number;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const mv = useMotionValue(0);
  const spring = useSpring(mv, {
    stiffness: 90,
    damping: 18,
    duration: duration * 1000,
  });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (inView) mv.set(value);
  }, [inView, value, mv]);

  useEffect(() => {
    return spring.on("change", (v) => setDisplay(Math.round(v)));
  }, [spring]);

  return (
    <span ref={ref} className="mono">
      {inView ? display : 0}
    </span>
  );
}

/** A bar that animates its fill width into place. */
export function ProgressBar({
  pct,
  color = "#475569",
  height = 8,
  delay = 0.1,
}: {
  pct: number;
  color?: string;
  height?: number;
  delay?: number;
}) {
  return (
    <div
      style={{
        height,
        background: "#eef2f7",
        borderRadius: 999,
        overflow: "hidden",
      }}
    >
      <motion.div
        initial={{ width: 0 }}
        whileInView={{ width: `${pct}%` }}
        viewport={{ once: true }}
        transition={{ duration: 0.9, ease: EASE, delay }}
        style={{ height: "100%", background: color, borderRadius: 999 }}
      />
    </div>
  );
}

export { motion };

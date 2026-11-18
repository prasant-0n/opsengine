"use client";

import React, { useState } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

/**
 * MagneticTooltip - Aceternity inspired magnetic spring tooltip with backdrop blur
 */
export function MagneticTooltip({
  children,
  content,
}: {
  children: React.ReactNode;
  content: string;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const x = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 100, damping: 15 });

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const halfWidth = event.currentTarget.offsetWidth / 2;
    x.set(event.nativeEvent.offsetX - halfWidth);
  };

  return (
    <div
      className="relative group inline-block"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        x.set(0);
      }}
      onMouseMove={handleMouseMove}
    >
      {isHovered && (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          style={{ x: springX }}
          className="absolute right-full mr-3.5 top-1/2 -translate-y-1/2 z-50 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#171B27]/95 border border-[#303744] shadow-2xl shadow-black/60 backdrop-blur-md whitespace-nowrap pointer-events-none"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#22D3EE] animate-pulse" />
          <span className="text-xs font-medium text-[#F3F4F6] tracking-wide">
            {content}
          </span>
          <span className="text-[10px] font-mono text-[#94A3B8] ml-1 px-1 rounded bg-white/5 border border-white/10">
            AI
          </span>
        </motion.div>
      )}
      {children}
    </div>
  );
}

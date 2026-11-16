"use client";

import React, { useMemo } from "react";

interface ShimmeringTextProps {
  children?: React.ReactNode;
  text?: string;
  className?: string;
  shimmerColor?: string;
  duration?: number;
}

/**
 * High-performance GPU-accelerated Shimmering Text.
 * Uses pure CSS keyframes with will-change: background-position to maximize 60/120fps smoothness
 * and avoid JS animation thread overhead.
 */
export function ShimmeringText({
  children,
  text,
  className = "",
  shimmerColor = "#e0f2fe",
  duration = 1.0,
}: ShimmeringTextProps) {
  const content = text || children;

  const style = useMemo(
    () => ({
      backgroundImage: `linear-gradient(115deg, #f8fafc 0%, #cbd5e1 32%, ${shimmerColor} 50%, #94a3b8 68%, #f8fafc 100%)`,
      backgroundSize: "220% 100%",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      animation: `textShimmer ${duration}s ease-in-out infinite`,
    }),
    [shimmerColor, duration]
  );

  return (
    <>
      <style>{`
        @keyframes textShimmer {
          0% { background-position: 120% 0; }
          100% { background-position: -120% 0; }
        }
      `}</style>
      <span
        className={`relative inline-block bg-clip-text text-transparent will-change-[background-position] ${className}`}
        style={style}
      >
        {content}
      </span>
    </>
  );
}

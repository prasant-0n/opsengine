"use client";

import React from "react";

interface ShimmeringTextProps {
  children?: React.ReactNode;
  text?: string;
  className?: string;
  shimmerColor?: string;
  duration?: number;
}

/**
 * Crisp high-contrast display text primitive.
 * Backward-compatible drop-in replacement for shimmering text.
 */
export function ShimmeringText({
  children,
  text,
  className = "",
}: ShimmeringTextProps) {
  const content = text || children;

  return (
    <span className={`inline-block text-foreground ${className}`}>
      {content}
    </span>
  );
}

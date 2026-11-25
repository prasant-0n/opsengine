"use client";

import React, { useState } from "react";

/**
 * Standard accessible tooltip component.
 */
export function MagneticTooltip({
  children,
  content,
}: {
  children: React.ReactNode;
  content: string;
}) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="relative group inline-block"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsHovered(true)}
      onBlur={() => setIsHovered(false)}
    >
      {isHovered && (
        <div
          role="tooltip"
          className="absolute right-full mr-2.5 top-1/2 -translate-y-1/2 z-50 flex items-center px-2.5 py-1 rounded-md bg-popover text-popover-foreground border border-border shadow-md text-xs font-medium whitespace-nowrap pointer-events-none transition-opacity duration-150"
        >
          {content}
        </div>
      )}
      {children}
    </div>
  );
}

"use client";

import React from "react";
import { cn } from "@/lib/utils";

/**
 * Standard tactile action button with high-craft surface elevation.
 * Backward-compatible drop-in replacement for the previous shimmer button.
 */
export const ShimmerButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    shimmerColor?: string;
    shimmerSize?: string;
    borderRadius?: string;
    shimmerDuration?: string;
    background?: string;
    className?: string;
    children?: React.ReactNode;
  }
>(
  (
    {
      borderRadius = "8px",
      background,
      className,
      children,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      shimmerColor,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      shimmerSize,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      shimmerDuration,
      style,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        style={{
          borderRadius,
          ...(background ? { backgroundColor: background } : {}),
          ...style,
        }}
        className={cn(
          "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-semibold transition-all duration-150 ease-out",
          "bg-primary text-primary-foreground hover:opacity-95 active:scale-[0.99]",
          "border border-white/10 px-4 py-2.5 shadow-sm",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:pointer-events-none disabled:opacity-50",
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

ShimmerButton.displayName = "ShimmerButton";
